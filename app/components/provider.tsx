import { comparisonWindow, previousRange } from "../lib/view-filters";
import { useViewFilters } from "./view-filters";
import { behaviorFlags, riskWarnings } from "../lib/behavior";
import { tradeIdentity } from "../lib/csv-import";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Trade } from "../lib/journal";
import { hasTradeReview, hasDailyReview } from "../lib/review-progress";
import { CloudJournalStore, TradesRepo } from "../lib/trades-repo";
import { useAuth } from "./auth/AuthProvider";
import { dataMessage } from "../lib/firebase-errors";
import { deviceSources, importDevice } from "../lib/device-import";
import { emptyPractice, type Practice } from "../lib/practice";
import { FeedbackAnimation, type FeedbackType } from "./feedback";
import {
  commitWithScreenshots,
  setScreenshotBackend,
  restoreWithScreenshots,
  screenshotRefs,
  type Screenshot,
} from "../lib/screenshots";
const Context = createContext<{
  trades: Trade[];
  loadedTrades: Trade[];
  comparisonTrades: Trade[];
  flags: Map<string, string[]>;
  range: { from: string; to: string };
  loadRange: (range: { from: string; to: string }) => Promise<void>;
  ready: boolean;
  error: string;
  practice: Practice;
  savePractice: (practice: Practice) => Promise<void>;
  importTrades: (
    trades: Trade[],
  ) => Promise<{ imported: number; skipped: number }>;
  deviceImportAvailable: boolean;
  importFromDevice: () => Promise<void>;
  store: React.RefObject<CloudJournalStore | null>;
  save: (
    trade: Trade,
    editing: boolean,
    drafts?: Screenshot[],
  ) => void | Promise<void>;
  remove: (id: string) => Promise<void>;
  restore: (
    trades: Trade[],
    images?: Screenshot[],
    practice?: Practice,
  ) => void | Promise<void>;
  notify: (message: string) => void;
} | null>(null);
export function JournalProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { filters } = useViewFilters();
  const [deviceImportAvailable, setDeviceImportAvailable] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [practice, setPractice] = useState<Practice>(emptyPractice);
  const [message, setMessage] = useState(""),
    [feedback, setFeedback] = useState<{
      type: FeedbackType;
      text: string;
      id: number;
    } | null>(null);
  const [range, setRange] = useState(() => ({
    from: filters.from,
    to: filters.to,
  }));
  const rangeCache = useRef(
    new Map<string, { trades: Trade[]; revision: number }>(),
  );
  const store = useRef<CloudJournalStore | null>(null),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    serial = useRef(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const instance = new CloudJournalStore(new TradesRepo(user.uid));
    store.current = instance;
    setScreenshotBackend(instance.repo);
    setReady(false);
    setError("");
    instance
      .load(comparisonWindow(range))
      .then((loaded) => {
        if (!active) return;
        setTrades(loaded);
        setPractice(instance.practice);
        setReady(true);
        try {
          setDeviceImportAvailable(deviceSources().length > 0);
        } catch {
          /* Device storage can be blocked. */
        }
      })
      .catch((e) => {
        if (active) {
          setError(dataMessage(e));
          setReady(true);
        }
      });
    return () => {
      active = false;
      instance.trades = [];
      instance.practice = emptyPractice();
      instance.revision = 0;
      instance.failed = true;
      store.current = null;
      setScreenshotBackend(null);
      rangeCache.current.clear();
      timers.current.forEach(clearTimeout);
    };
  }, [user?.uid]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  function clearFeedback() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFeedback(null);
  }
  function show(type: FeedbackType, text: string) {
    setFeedback({ type, text, id: ++serial.current });
    timers.current.push(setTimeout(() => setFeedback(null), 2200));
  }
  async function save(
    trade: Trade,
    editing: boolean,
    drafts: Screenshot[] = [],
  ) {
    if (!store.current || !ready) throw Error("Journal is still loading.");
    rangeCache.current.clear();
    const previous = store.current.trades.find((t) => t.id === trade.id);
    if (
      drafts.length ||
      screenshotRefs(trade).length ||
      (previous && screenshotRefs(previous).length)
    ) {
      return commitWithScreenshots(store.current, trade, editing, drafts).then(
        (next) => saved(next),
      );
    }
    saved(await store.current.save(trade, editing));
    function saved(next: Trade[]) {
      setTrades(next);
      setError("");
      clearFeedback();
      const warnings = riskWarnings(
        next,
        store.current!.practice.riskRules ?? {},
        store.current!.practice.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        new Date(),
      );
      if (warnings.length || (trade.status === "closed" && trade.pnl! < 0)) {
        const text =
          warnings.join(" ") ||
          "Loss recorded. Take a breath and review your process when you are ready.";
        if (warnings.length) setMessage(text);
        show("loss", text);
      } else if (
        hasTradeReview(trade) &&
        (!previous || !hasTradeReview(previous))
      ) {
        show(
          "milestone",
          "Reflection saved. Taking time to review your decisions matters.",
        );
      } else {
        show("success", "Trade saved. Your journal is up to date.");
      }
    }
  }
  async function remove(id: string) {
    if (!store.current) throw Error("Journal is loading.");
    rangeCache.current.clear();
    const instance = store.current;
    const images = instance.trades
      .filter((t) => t.id === id)
      .flatMap(screenshotRefs);
    const next = await instance.delete(id);
    setTrades(next);
    const retained = new Set(
      next.flatMap(screenshotRefs).map((image) => image.id),
    );
    void instance.repo
      .deleteImages(
        images
          .filter((image) => !retained.has(image.id))
          .map((image) => image.id),
      )
      .catch(() => {});
    clearFeedback();
    setMessage("Trade deleted.");
  }
  async function restore(
    next: Trade[],
    images: Screenshot[] = [],
    practice?: Practice,
  ) {
    if (!store.current) throw Error("Journal is loading.");
    const revisionBeforeRestore = store.current.revision;
    await store.current.load();
    if (store.current.revision !== revisionBeforeRestore) {
      store.current.failed = true;
      throw Error(
        "Your journal changed on another device. Reload before replacing records.",
      );
    }
    rangeCache.current.clear();
    if (
      images.length ||
      store.current.trades.some((t) => screenshotRefs(t).length)
    )
      return restoreWithScreenshots(store.current, next, images, practice).then(
        (restored) => finished(restored),
      );
    finished(await store.current.commit(next, true, practice));
    function finished(next: Trade[]) {
      setTrades(next);
      setPractice(store.current!.practice);
      setError("");
      clearFeedback();
      setMessage(`Restored ${next.length} trades.`);
    }
  }
  const visibleTrades = useMemo(
    () =>
      trades.filter(
        (t) =>
          t.date.slice(0, 10) >= range.from &&
          t.date.slice(0, 10) <= range.to &&
          (!filters.pair || t.symbol === filters.pair) &&
          (!filters.setup || t.setup === filters.setup),
      ),
    [trades, range, filters.pair, filters.setup],
  );
  const comparisonTrades = useMemo(() => {
    const previous = previousRange(range);
    return trades.filter(
      (t) =>
        t.date.slice(0, 10) >= previous.from &&
        t.date.slice(0, 10) <= previous.to &&
        (!filters.pair || t.symbol === filters.pair) &&
        (!filters.setup || t.setup === filters.setup),
    );
  }, [trades, range, filters.pair, filters.setup]);
  const flags = useMemo(
    () =>
      behaviorFlags(
        trades.filter(
          (t) =>
            t.date.slice(0, 10) >= range.from &&
            t.date.slice(0, 10) <= range.to,
        ),
        practice.riskRules ?? {},
        practice.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      ),
    [trades, range, practice],
  );
  return (
    <Context.Provider
      value={{
        trades: visibleTrades,
        loadedTrades: trades,
        comparisonTrades,
        range,
        flags,
        loadRange: async (next) => {
          const instance = store.current;
          if (!instance) throw Error("Journal unavailable.");
          if (
            !/^\d{4}-\d\d-\d\d$/.test(next.from) ||
            !/^\d{4}-\d\d-\d\d$/.test(next.to) ||
            next.from > next.to
          )
            throw Error("Choose a valid date range.");
          const key = JSON.stringify(next),
            cached = rangeCache.current.get(key);
          if (cached && cached.revision === instance.revision)
            instance.trades = cached.trades;
          else {
            await instance.load(comparisonWindow(next));
            if (rangeCache.current.size >= 5)
              rangeCache.current.delete(
                rangeCache.current.keys().next().value!,
              );
            rangeCache.current.set(key, {
              trades: instance.trades,
              revision: instance.revision,
            });
          }
          setTrades([...instance.trades]);
          setRange(next);
          setPractice(instance.practice);
        },
        ready,
        error,
        practice,
        savePractice: async (next) => {
          if (!store.current || error) throw Error("Journal unavailable.");
          const before = store.current.practice;
          const addedReview = next.reflections.some(
            (reflection) =>
              hasDailyReview(reflection) &&
              !hasDailyReview(
                before.reflections.find(
                  (previous) => previous.date === reflection.date,
                ),
              ),
          );
          rangeCache.current.clear();
          await store.current.commit(store.current.trades, false, next);
          setPractice(next);
          if (addedReview) {
            clearFeedback();
            show(
              "milestone",
              "You recorded what worked and one adjustment. A useful moment of reflection.",
            );
          }
        },
        importTrades: async (next) => {
          const instance = store.current;
          if (!instance || error) throw Error("Journal unavailable.");
          if (!next.length) return { imported: 0, skipped: 0 };
          const dates = next.map((t) => t.date.slice(0, 10)).sort();
          // Explicit import-only range scan catches legacy IDs outside the visible window.
          const existing = await instance.repo.list({
            from: dates[0],
            to: dates.at(-1)!,
          });
          if (existing.revision !== instance.revision)
            throw Error(
              "Your journal changed on another device. Reload before importing.",
            );
          const seen = new Set(existing.trades.map(tradeIdentity));
          const sourceIds = new Set(
            existing.trades.map((t) => t.importSourceId).filter(Boolean),
          );
          const pending: Trade[] = [];
          for (const trade of next) {
            const key = tradeIdentity(trade);
            if (
              seen.has(key) ||
              (trade.importSourceId && sourceIds.has(trade.importSourceId))
            )
              continue;
            seen.add(key);
            if (trade.importSourceId) sourceIds.add(trade.importSourceId);
            const digest = await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(key),
            );
            const id =
              "csv-" +
              Array.from(new Uint8Array(digest), (v) =>
                v.toString(16).padStart(2, "0"),
              ).join("");
            pending.push({ ...trade, id });
          }
          let imported = 0;
          rangeCache.current.clear();
          try {
            for (let offset = 0; offset < pending.length; offset += 400) {
              const chunk = pending.slice(offset, offset + 400);
              await instance.commit([...instance.trades, ...chunk]);
              imported += chunk.length;
              setTrades([...instance.trades]);
            }
          } catch (e) {
            throw Error(
              `${imported} imported before this batch failed. Re-import safely to finish: ${(e as Error).message}`,
              { cause: e },
            );
          }
          const result = { imported, skipped: next.length - imported };
          setMessage(`${result.imported} imported, ${result.skipped} skipped.`);
          return result;
        },
        deviceImportAvailable,
        importFromDevice: async () => {
          if (!store.current || !ready || error)
            throw Error("Journal unavailable.");
          const count = await importDevice(store.current, deviceSources());
          setTrades([...store.current.trades]);
          setPractice(store.current.practice);
          setDeviceImportAvailable(deviceSources().length > 0);
          setMessage(`Imported ${count} device trades to your account.`);
        },
        store,
        save,
        remove,
        restore,
        notify: setMessage,
      }}
    >
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
      {feedback && (
        <div className="feedback" role="status">
          <FeedbackAnimation key={feedback.id} type={feedback.type} />
          <p>{feedback.text}</p>
        </div>
      )}
    </Context.Provider>
  );
}
export function useJournal() {
  const value = useContext(Context);
  if (!value) throw Error("Journal provider missing.");
  return value;
}
