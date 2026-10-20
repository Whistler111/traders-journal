import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useJournal } from "./provider";
import { useViewFilters } from "./view-filters";
import { periodRange, type Period } from "../lib/view-filters";
export function RangeFilter() {
  const { range, loadRange, notify, loadedTrades, trades } = useJournal(),
    { filters, update } = useViewFilters();
  const [from, setFrom] = useState(filters.from),
    [to, setTo] = useState(filters.to),
    [busy, setBusy] = useState(false),
    pending = useRef(false);
  useEffect(() => {
    setFrom(filters.from);
    setTo(filters.to);
    if (
      (filters.from !== range.from || filters.to !== range.to) &&
      !pending.current
    ) {
      pending.current = true;
      setBusy(true);
      void loadRange(filters)
        .catch((e) => notify((e as Error).message))
        .finally(() => {
          pending.current = false;
          setBusy(false);
        });
    }
  }, [filters.from, filters.to, range.from, range.to]);
  async function apply(period: Period, next = { from, to }) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      if (next.from !== range.from || next.to !== range.to)
        await loadRange(next);
      update({ ...next, period });
      setFrom(next.from);
      setTo(next.to);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const source = loadedTrades ?? trades;
  return (
    <section className="global-filters" aria-label="Global trade filters">
      <div className="filter-presets">
        <span className="filter-label">
          <SlidersHorizontal size={15} />
          Period
        </span>
        {(["Today", "7D", "30D", "This month", "Custom"] as Period[]).map(
          (p) => (
            <button
              key={p}
              disabled={busy}
              aria-pressed={filters.period === p}
              onClick={() =>
                p === "Custom"
                  ? update({ ...filters, period: p })
                  : void apply(p, periodRange(p))
              }
            >
              {p}
            </button>
          ),
        )}
      </div>
      <div className="filter-fields">
        {filters.period === "Custom" && (
          <form
            className="custom-range"
            onSubmit={(e) => {
              e.preventDefault();
              void apply("Custom");
            }}
          >
            <label>
              From
              <input
                type="date"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <button disabled={busy}>Apply</button>
          </form>
        )}
        <label>
          <span>Pair</span>
          <select
            disabled={busy}
            aria-label="Global pair"
            value={filters.pair}
            onChange={(e) => update({ ...filters, pair: e.target.value })}
          >
            <option value="">All pairs</option>
            {[
              ...new Set([
                ...source.map((t) => t.symbol),
                ...(filters.pair ? [filters.pair] : []),
              ]),
            ]
              .sort()
              .map((p) => (
                <option key={p}>{p}</option>
              ))}
          </select>
        </label>
        <label>
          <span>Setup</span>
          <select
            disabled={busy}
            aria-label="Global setup"
            value={filters.setup}
            onChange={(e) => update({ ...filters, setup: e.target.value })}
          >
            <option value="">All setups</option>
            {[
              ...new Set([
                ...source.map((t) => t.setup),
                ...(filters.setup ? [filters.setup] : []),
              ]),
            ]
              .sort()
              .map((p) => (
                <option key={p}>{p}</option>
              ))}
          </select>
        </label>
      </div>
      <span className="filter-caption" aria-live="polite">
        {busy ? "Loading range…" : `${range.from} — ${range.to}`}
      </span>
    </section>
  );
}
