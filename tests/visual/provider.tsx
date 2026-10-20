import { createContext, useContext, useState, useMemo } from "react";
import type { Trade } from "../../app/lib/journal";
import { emptyPractice, type Practice } from "../../app/lib/practice";
import { behaviorFlags } from "../../app/lib/behavior";
import { useViewFilters } from "../../app/components/view-filters";
import { previousRange } from "../../app/lib/view-filters";
const values = [120, -65, 180, 95, -45, 210, 75, -90, 145, 60, 240, -70];
const sample: Trade[] = Array.from({ length: 54 }, (_, i) => {
  const day = new Date(Date.UTC(2026, 8, 1 + i, 9 + (i % 7)));
  return {
    id: `fictional-${i}`,
    date: day.toISOString().slice(0, 16),
    sourceTimestamp: day.toISOString(),
    closedAt: new Date(+day + 3600000).toISOString(),
    symbol: ["EURUSD", "XAUUSD", "GBPUSD"][i % 3],
    direction: i % 3 ? "Long" : "Short",
    entry: 1.12,
    stop: i % 3 ? 1.1 : 1.14,
    risk: 50,
    pnl: values[i % values.length],
    status: "closed",
    session: "London",
    emotion: "Calm",
    followed: i % 5 ? "yes" : "no",
    setup: ["Liquidity sweep", "Break & retest", "London continuation"][i % 3],
    reason:
      "Fictional visual test: waited for price to reclaim the level before entry.",
    lesson:
      "Fictional fixture. Patient execution; review the first partial exit.",
    rating: 4,
    ...(i===49?{screenshots:[{id:"fixture-before",name:"before-entry.png"},{id:"fixture-after",name:"after-exit.png"}]}:{}),
    volume: 0.2,
    volumeUnit: "lot",
    journalReview: {
      playbookId: "sweep",
      playbookName: "Liquidity sweep",
      rules: [
        { label: "Waited for a sweep", checked: true },
        { label: "Stop below structure", checked: i % 4 !== 0 },
        { label: "Risk within daily plan", checked: true },
      ],
      mistakes: [],
    },
  };
});
const Context = createContext<ReturnType<typeof value> | null>(null);
function value(
  trades: Trade[],
  practice: Practice,
  filters: ReturnType<typeof useViewFilters>["filters"],
  setTrades: React.Dispatch<React.SetStateAction<Trade[]>>,
  setPractice: React.Dispatch<React.SetStateAction<Practice>>,
  range: { from: string; to: string },
  setRange: React.Dispatch<React.SetStateAction<{ from: string; to: string }>>,
) {
  const match = (t: Trade) => !filters.pair || t.symbol === filters.pair;
  const chosen = (t: Trade) =>
    match(t) && (!filters.setup || t.setup === filters.setup);
  const previous = previousRange(range);
  return {
    trades: trades.filter(
      (t) =>
        chosen(t) &&
        t.date.slice(0, 10) >= range.from &&
        t.date.slice(0, 10) <= range.to,
    ),
    loadedTrades: trades,
    comparisonTrades: trades.filter(
      (t) =>
        chosen(t) &&
        t.date.slice(0, 10) >= previous.from &&
        t.date.slice(0, 10) <= previous.to,
    ),
    practice,
    range,
    flags: behaviorFlags(trades, {}, "UTC"),
    ready: true,
    error: "",
    store: { current: null },
    notify: () => {},
    deviceImportAvailable: false,
    importFromDevice: async () => {},
    loadRange: async (next: { from: string; to: string }) => setRange(next),
    savePractice: async (p: Practice) => setPractice(p),
    save: async (trade: Trade, editing: boolean) =>
      setTrades((current) =>
        editing
          ? current.map((t) => (t.id === trade.id ? trade : t))
          : [...current, trade],
      ),
    remove: async (id: string) =>
      setTrades((current) => current.filter((t) => t.id !== id)),
    importTrades: async (next: Trade[]) => {
      setTrades((t) => [...t, ...next]);
      return { imported: next.length, skipped: 0 };
    },
    restore: async (next: Trade[]) => setTrades(next),
  };
}
export function JournalProvider({ children }: { children: React.ReactNode }) {
  const { filters } = useViewFilters(),
    [trades, setTrades] = useState(sample),
    [range, setRange] = useState({ from: filters.from, to: filters.to }),
    [practice, setPractice] = useState<Practice>({
      ...emptyPractice(),
      timezone: "UTC",
      playbooks: [
        {
          id: "sweep",
          name: "Liquidity sweep",
          description: "A patient entry after a clear liquidity sweep.",
          rules: [
            "Waited for a sweep",
            "Stop below structure",
            "Risk within daily plan",
          ],
        },
      ],
    });
  const state = useMemo(
    () =>
      value(trades, practice, filters, setTrades, setPractice, range, setRange),
    [trades, practice, filters, range],
  );
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useJournal() {
  return useContext(Context)!;
}
