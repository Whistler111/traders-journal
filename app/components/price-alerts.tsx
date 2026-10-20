import { useEffect, useRef, useState } from "react";
import {
  AlertQueue,
  DEFAULT_SETTINGS,
  deliveredState,
  normalizePair,
  parseRuntime,
  parseSettings,
  priceAlert,
  type AlertRuntime,
  type AlertSettings,
  type Pair,
  type PriceAlert,
  type PriceQuote,
} from "../lib/alerts";
import type { Trade } from "../lib/journal";
import { useJournal } from "./provider";
import { Bell } from "lucide-react";
import { HeaderMenu } from "./header-menu";
import { useAuth } from "./auth/AuthProvider";
export function PriceAlerts({
  onOpenTrade,
}: {
  onOpenTrade: (trade: Trade) => void;
}) {
  const { user } = useAuth();
  const SETTINGS_KEY = `trade-notes-alert-settings-v1:${user!.uid}`,
    RUNTIME_KEY = `trade-notes-alert-runtime-v1:${user!.uid}`,
    LEASE_KEY = `trade-notes-alert-leader-v1:${user!.uid}`;
  const { trades: filteredTrades, loadedTrades, ready } = useJournal();
  // Display filters must not silence monitoring for other loaded open trades.
  const trades=loadedTrades ?? filteredTrades;
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_SETTINGS),
    [loaded, setLoaded] = useState(false),
    [runtime, setRuntime] = useState<AlertRuntime>({
      states: {},
      history: [],
      lastReleasedAt: 0,
    });
  const [status, setStatus] = useState(""),
    [permission, setPermission] = useState<
      NotificationPermission | "unsupported"
    >("unsupported"),
    [toast, setToast] = useState<PriceAlert | null>(null),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [intervalDraft, setIntervalDraft] = useState<string | null>(null);
  const live = useRef({ trades, settings }),
    runtimeRef = useRef(runtime),
    queue = useRef(new AlertQueue()),
    cursor = useRef(0),
    panel = useRef<HTMLDetailsElement>(null),
    openTrade = useRef(onOpenTrade);
  live.current = { trades, settings };
  runtimeRef.current = runtime;
  openTrade.current = onOpenTrade;
  const pairs = [
    ...new Set(
      trades
        .filter((t) => t.status === "open")
        .map((t) => normalizePair(t.symbol))
        .filter((p): p is Pair => !!p),
    ),
  ].sort();
  const pairKey = pairs.join("|");
  useEffect(() => {
    try {
      setSettings(
        parseSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null")),
      );
      const saved = parseRuntime(
        JSON.parse(localStorage.getItem(RUNTIME_KEY) ?? "null"),
      );
      setRuntime(saved);
      queue.current.lastReleasedAt = saved.lastReleasedAt;
    } catch {
      setStatus(
        "Alert preferences could not be read. Alerts stay off until you enable them.",
      );
    }
    setPermission(
      "Notification" in window ? Notification.permission : "unsupported",
    );
    setLoaded(true);
    function sync(event: StorageEvent) {
      try {
        if (event.key === SETTINGS_KEY) {
          setSettings(parseSettings(JSON.parse(event.newValue ?? "null")));
          setDrafts({});
          setIntervalDraft(null);
        }
        if (event.key === RUNTIME_KEY) {
          const saved = parseRuntime(JSON.parse(event.newValue ?? "null"));
          runtimeRef.current = saved;
          setRuntime(saved);
          queue.current.lastReleasedAt = saved.lastReleasedAt;
        }
      } catch {
        /* Invalid optional alert metadata never changes journal records. */
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 10_000);
    return () => clearTimeout(timer);
  }, [toast]);
  function showTrade(id: string) {
    const trade = live.current.trades.find((t) => t.id === id);
    if (!trade) {
      setStatus("This trade is no longer in your journal.");
      return;
    }
    if (panel.current) panel.current.open = false;
    setToast(null);
    openTrade.current(trade);
  }
  const showRef = useRef(showTrade);
  showRef.current = showTrade;
  useEffect(() => {
    if (!loaded || !ready || !settings.enabled || !pairKey) return;
    const controller = new AbortController(),
      owner = crypto.randomUUID();
    let attempting = false,
      nextPollAt = 0,
      polling = false,
      halted = false;
    const signal = controller.signal;
    function deliver(alert: PriceAlert) {
      const current = runtimeRef.current,
        next = {
          states: {
            ...current.states,
            [alert.tradeId]: deliveredState(
              alert,
              current.states[alert.tradeId],
            ),
          },
          history: [alert, ...current.history].slice(0, 50),
          lastReleasedAt: Date.now(),
        };
      try {
        localStorage.setItem(RUNTIME_KEY, JSON.stringify(next));
      } catch {
        halted = true;
        setStatus(
          "Alert history could not be saved. Monitoring is paused; your journal is unchanged.",
        );
        return;
      }
      runtimeRef.current = next;
      setRuntime(next);
      setToast(alert);
      if ("Notification" in window && Notification.permission === "granted")
        try {
          const notification = new Notification("Trade price alert", {
            body: alert.message,
            tag: `trade-notes-${alert.tradeId}`,
          });
          notification.onclick = () => {
            window.focus();
            showRef.current(alert.tradeId);
            notification.close();
          };
        } catch {
          /* Some mobile browsers only support service-worker notifications. In-app delivery remains available. */
        }
    }
    async function tick() {
      if (signal.aborted || halted || !live.current.settings.enabled) return;
      const now = Date.now(),
        { trades, settings } = live.current,
        interval = settings.intervalMinutes * 60_000;
      const pending = queue.current.release(now, interval, trades, settings);
      if (pending) {
        const trade = trades.find((t) => t.id === pending.tradeId);
        if (trade) {
          const valid = priceAlert(
            trade,
            pending.quote,
            settings.thresholds[pending.pair] ?? 0.5,
            runtimeRef.current.states[trade.id],
            now,
            interval,
          );
          if (valid) deliver(valid);
        }
      }
      if (polling || now < nextPollAt) return;
      const active = [
        ...new Set(
          trades
            .filter((t) => t.status === "open")
            .map((t) => normalizePair(t.symbol))
            .filter((pair): pair is Pair => !!pair),
        ),
      ].sort();
      if (!active.length) return;
      const pair = active[cursor.current++ % active.length];
      polling = true;
      try {
        const response = await fetch(
          `/api/price?pair=${encodeURIComponent(pair)}`,
          { signal },
        );
        const body = await response.json();
        if (signal.aborted) return;
        if (!response.ok) {
          const retry =
            typeof body.retryAfter === "number" &&
            Number.isFinite(body.retryAfter)
              ? Math.max(60, Math.min(86400, body.retryAfter))
              : 3600;
          nextPollAt = Date.now() + retry * 1000;
          setStatus(
            typeof body.error === "string"
              ? body.error
              : "Price check failed. Monitoring will retry later.",
          );
          return;
        }
        const quote = body.quote as PriceQuote;
        if (
          !quote ||
          quote.pair !== pair ||
          !Number.isFinite(quote.price) ||
          quote.price <= 0 ||
          !Number.isFinite(quote.asOf)
        )
          throw Error("Invalid price response.");
        nextPollAt =
          typeof body.nextPollAt === "number" &&
          Number.isFinite(body.nextPollAt)
            ? Math.max(Date.now() + 120_000, body.nextPollAt)
            : Date.now() + 3_600_000;
        setStatus(
          `Last ${pair} quote: ${quote.price.toLocaleString()} · ${new Date(quote.asOf).toLocaleString()}. ${Date.now() - quote.asOf > 600_000 ? "Quote is stale; no alert sent." : "Next price check follows the free-plan schedule."}`,
        );
        for (const trade of live.current.trades.filter(
          (t) => t.status === "open" && normalizePair(t.symbol) === pair,
        )) {
          const alert = priceAlert(
            trade,
            quote,
            live.current.settings.thresholds[pair] ?? 0.5,
            runtimeRef.current.states[trade.id],
            Date.now(),
            live.current.settings.intervalMinutes * 60_000,
          );
          if (alert) queue.current.enqueue(alert);
        }
      } catch {
        if (!signal.aborted) {
          nextPollAt = Date.now() + 3_600_000;
          setStatus("Price service unavailable. Monitoring will retry later.");
        }
      } finally {
        polling = false;
      }
    }
    async function monitor() {
      await new Promise<void>((resolve) => {
        const timer = setInterval(() => void tick(), 1000);
        void tick();
        signal.addEventListener(
          "abort",
          () => {
            clearInterval(timer);
            resolve();
          },
          { once: true },
        );
        if (signal.aborted) {
          clearInterval(timer);
          resolve();
        }
      });
    }
    async function attempt() {
      if (signal.aborted || attempting) return;
      attempting = true;
      try {
        if (navigator.locks) {
          await navigator.locks.request(
            `trade-notes-price-alert-leader:${user!.uid}`,
            { ifAvailable: true },
            async (lock) => {
              if (lock && !signal.aborted) await monitor();
            },
          );
        } else {
          // Lease fallback for browsers without Web Locks; shared runtime also deduplicates delivered alerts.
          let lease: { owner: string; expiresAt: number } | null = null;
          try {
            lease = JSON.parse(localStorage.getItem(LEASE_KEY) ?? "null");
          } catch {
            /* Expired/malformed lease can be replaced. */
          }
          if (lease && lease.owner !== owner && lease.expiresAt > Date.now())
            return;
          localStorage.setItem(
            LEASE_KEY,
            JSON.stringify({ owner, expiresAt: Date.now() + 15_000 }),
          );
          const heartbeat = setInterval(() => {
            try {
              localStorage.setItem(
                LEASE_KEY,
                JSON.stringify({ owner, expiresAt: Date.now() + 15_000 }),
              );
            } catch {
              controller.abort();
            }
          }, 5000);
          await monitor();
          clearInterval(heartbeat);
          try {
            const own = JSON.parse(localStorage.getItem(LEASE_KEY) ?? "null");
            if (own?.owner === owner) localStorage.removeItem(LEASE_KEY);
          } catch {
            /* Lease expires without deletion. */
          }
        }
      } catch {
        if (!signal.aborted)
          setStatus("This browser could not start price monitoring.");
      } finally {
        attempting = false;
      }
    }
    void attempt();
    const retryLeader = setInterval(() => void attempt(), 5000);
    return () => {
      controller.abort();
      clearInterval(retryLeader);
    };
  }, [loaded, ready, settings.enabled, pairKey]);
  function update(next: AlertSettings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      setSettings(next);
      setStatus("");
      return true;
    } catch {
      setStatus(
        "Alert settings could not be saved. Your journal is unchanged.",
      );
      return false;
    }
  }
  function requestNotifications() {
    if ("Notification" in window && Notification.permission === "default")
      void Notification.requestPermission()
        .then(setPermission)
        .catch(() => setPermission("denied"));
  }
  return (
    <>
      <HeaderMenu className="alerts-menu" menuRef={panel}>
        <summary>
          <Bell size={16} aria-hidden="true" />
          <span>Alerts</span>
          {runtime.history.length > 0 && (
            <span className="count">{runtime.history.length}</span>
          )}
        </summary>
        <div className="alerts-panel">
          <h2>Price alerts</h2>
          <p className="footnote">
            While this app is open. Only your open trades are monitored.
          </p>
          <details className="alert-settings">
            <summary>Alert Settings</summary>
            <label className="alert-toggle">
              <input
                type="checkbox"
                checked={settings.enabled}
                disabled={!loaded}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  if (update({ ...settings, enabled }) && enabled)
                    requestNotifications();
                }}
              />
              Enable price alerts
            </label>
            <label>
              Minimum time between alerts (minutes)
              <input
                type="number"
                min="1"
                max="120"
                value={intervalDraft ?? String(settings.intervalMinutes)}
                onChange={(e) => setIntervalDraft(e.target.value)}
                onBlur={() => {
                  if (intervalDraft === null) return;
                  const n = Number(intervalDraft);
                  if (
                    !intervalDraft.trim() ||
                    !Number.isFinite(n) ||
                    n < 1 ||
                    n > 120
                  ) {
                    setStatus(
                      "Choose an alert interval from 1 to 120 minutes.",
                    );
                    return;
                  }
                  if (update({ ...settings, intervalMinutes: n }))
                    setIntervalDraft(null);
                }}
              />
            </label>
            {pairs.map((pair) => (
              <label key={pair}>
                {pair} move threshold (%)
                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={
                    drafts[pair] ?? String(settings.thresholds[pair] ?? 0.5)
                  }
                  onChange={(e) =>
                    setDrafts((old) => ({ ...old, [pair]: e.target.value }))
                  }
                  onBlur={() => {
                    const raw = drafts[pair];
                    if (raw === undefined) return;
                    const n = Number(raw);
                    if (
                      !raw.trim() ||
                      !Number.isFinite(n) ||
                      n < 0.01 ||
                      n > 100
                    ) {
                      setStatus("Choose a move threshold from 0.01% to 100%.");
                      return;
                    }
                    if (
                      update({
                        ...settings,
                        thresholds: { ...settings.thresholds, [pair]: n },
                      })
                    )
                      setDrafts((old) => {
                        const next = { ...old };
                        delete next[pair];
                        return next;
                      });
                  }}
                />
              </label>
            ))}
            {!pairs.length && (
              <p className="footnote">
                Open a supported gold or major forex trade to set its threshold.
              </p>
            )}
            <p className="footnote">
              Alpha Vantage free plan: up to 25 price checks per day. This app
              samples hourly across all pairs; the 2-minute default controls
              notification spacing, not quote frequency.
            </p>
            <p className="footnote">
              Browser notifications:{" "}
              {permission === "granted"
                ? "allowed"
                : permission === "denied"
                  ? "blocked; in-app alerts still work"
                  : permission === "unsupported"
                    ? "unavailable; in-app alerts still work"
                    : "not enabled"}
              .{" "}
              {settings.enabled && permission === "default" && (
                <button type="button" onClick={requestNotifications}>
                  Enable browser notifications
                </button>
              )}
            </p>
          </details>
          {status && (
            <p className="alert-status" role="status">
              {status}
            </p>
          )}
          {settings.enabled &&
            trades.some(
              (t) => t.status === "open" && !normalizePair(t.symbol),
            ) && (
              <p className="footnote">
                Some assets are unsupported. Supported: XAU/USD and the seven
                major forex pairs.
              </p>
            )}
          <div className="alert-history">
            <h3>Recent alerts</h3>
            {!runtime.history.length ? (
              <p>No price alerts yet.</p>
            ) : (
              <ul>
                {runtime.history.map((alert) => (
                  <li key={alert.id}>
                    <button
                      type="button"
                      onClick={() => showTrade(alert.tradeId)}
                    >
                      {alert.message}
                      <small>
                        {new Date(alert.createdAt).toLocaleString()} · View
                        trade
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </HeaderMenu>
      {toast && (
        <div className="price-alert-toast" role="status">
          <button type="button" onClick={() => showTrade(toast.tradeId)}>
            {toast.message}
            <small>View trade</small>
          </button>
          <button
            type="button"
            aria-label="Dismiss price alert"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
