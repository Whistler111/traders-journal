import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  backup,
  cumulativeRealized,
  csv,
  filterTrades,
  KEY,
  milestones,
  money,
  outcome,
  packNotes,
  parseBackup,
  planStreak,
  stats,
  unpackNotes,
  validate,
  weekCount,
  type Trade,
} from "../app/lib/journal";
import { JournalStore } from "./helpers/legacy-journal-store";
export const base: Trade = {
  id: "a",
  date: "2026-10-18T14:30",
  symbol: "XAUUSD",
  setup: "Sweep",
  reason: "Confirmation after a liquidity sweep",
  lesson: "Legacy notes",
  direction: "Long",
  session: "London",
  emotion: "Calm",
  status: "closed",
  followed: "yes",
  entry: 2700,
  stop: 2690,
  risk: 25,
  pnl: 50,
};
describe("financial calculations and reference compatibility", () => {
  it("orders the curve by trade date, starts at zero, excludes open trades, and keeps calculation precision", () => {
    const trades = [
      { ...base, date: "2026-10-18T15:00", pnl: -25 },
      { ...base, id: "b", date: "2026-10-18T14:00", pnl: 50 },
      { ...base, id: "c", status: "open" as const, pnl: null },
    ];
    expect(cumulativeRealized(trades)).toEqual([0, 50, 25]);
    expect(money(-0.001)).toBe(money(0));
    expect(money(-0.005)).toContain("0.01");
  });
  it("matches +2R, -1R and 0R with an open trade excluded", () => {
    const trades = [
      base,
      { ...base, id: "b", pnl: -25 },
      { ...base, id: "c", pnl: 0 },
      { ...base, id: "d", status: "open" as const, pnl: null },
    ];
    const s = stats(trades);
    expect(trades.slice(0, 3).map((t) => t.pnl! / t.risk)).toEqual([2, -1, 0]);
    expect(s.cash).toBe(25);
    expect(s.total).toBe(1);
    expect(s.avg).toBeCloseTo(1 / 3, 12);
    expect(s.win).toBeCloseTo(1 / 3, 12);
    expect(s.n).toBe(3);
    expect(stats([]).avg).toBeNull();
    expect(outcome(trades[2])).toBe("breakeven");
  });
  it("reads the supplied fictional backup for testing only", () => {
    const data = JSON.parse(
      readFileSync("tests/sample-backup.FICTIONAL.json", "utf8"),
    );
    const trades = parseBackup(data);
    expect(stats(trades).cash).toBe(25);
    expect(parseBackup(JSON.parse(JSON.stringify(backup(trades))))).toEqual(
      trades,
    );
  });
  it("keeps unknown fields and does not mutate notes", () => {
    const t = { ...base, customField: { keep: true } };
    expect(parseBackup({ version: 1, trades: [t] })).toEqual([t]);
    const notes = "Exit price: legacy text\nKeep this.";
    expect(unpackNotes(notes)).toEqual({ notes, exit: "", size: "" });
    expect(unpackNotes(packNotes(notes, "2720", "0.01 lot"))).toEqual({
      notes,
      exit: "2720",
      size: "0.01 lot",
    });
  });
  it.each([
    { risk: 0 },
    { risk: Infinity },
    { entry: NaN },
    { entry: 0 },
    { stop: 2710 },
    { pnl: NaN },
    { pnl: Infinity },
    { pnl: "" },
    { date: "2026-02-30T12:00" },
    { date: "invalid" },
    { status: "open", pnl: 50 },
  ])("rejects invalid numeric, date or stop input %j", (changes) => {
    expect(() => validate({ ...base, ...changes })).toThrow();
  });
  it("validates both directions and zero P&L", () => {
    expect(validate({ ...base, pnl: 0 }).pnl).toBe(0);
    expect(validate({ ...base, direction: "Short", stop: 2710 })).toBeTruthy();
    expect(() =>
      validate({ ...base, direction: "Short", stop: 2690 }),
    ).toThrow();
  });
  it("uses a mean of individual R values, not total cash divided by total risk", () => {
    expect(stats([base, { ...base, id: "b", risk: 100, pnl: -100 }]).avg).toBe(
      0.5,
    );
  });
  it("uses local Monday-Sunday dates", () => {
    const dates = [
      "2026-10-11T23:59",
      "2026-10-12T00:00",
      "2026-10-18T23:59",
      "2026-10-19T00:00",
    ];
    expect(
      weekCount(
        dates.map((date, i) => ({ ...base, date, id: String(i) })),
        new Date("2026-10-18T23:00"),
      ),
    ).toBe(2);
  });
  it("handles aggregate overflow without NaN or Infinity", () => {
    expect(
      stats([
        { ...base, pnl: 1e308, risk: 1e308 },
        { ...base, id: "b", pnl: 1e308, risk: 1e308 },
      ]).cash,
    ).toBeNull();
  });
  it("searches notes and filters outcomes", () => {
    const list = [
      base,
      { ...base, id: "b", pnl: -25 },
      { ...base, id: "c", pnl: 0 },
      { ...base, id: "d", status: "open" as const, pnl: null },
    ];
    expect(filterTrades(list, "sweep", "win")).toHaveLength(1);
    expect(filterTrades(list, "no match", "all")).toHaveLength(0);
    expect(filterTrades(list, "", "breakeven")[0].id).toBe("c");
    expect(filterTrades(list, "", "open")[0].id).toBe("d");
  });
  it.each([
    { version: 2, trades: [] },
    { version: 1, trades: [base, base] },
    { version: 1, trades: [base, { ...base, id: "b", risk: 0 }] },
    { version: 1, trades: "bad" },
  ])("rejects complete malformed backups %j", (data) =>
    expect(() => parseBackup(data)).toThrow(),
  );
  it("exports CSV with escaped notes and spreadsheet formula protection", () => {
    const output = csv([{ ...base, reason: '=RUN("x")' }]);
    expect(output).toContain('"\'=RUN(""x"")"');
    expect(output).toContain("resultR");
  });
});
describe("transactional browser storage", () => {
  it("creates, edits, reopens, closes, reloads and deletes without changing initial risk", () => {
    const store = new JournalStore(localStorage);
    store.load();
    store.save({ ...base, customField: "keep" }, false);
    store.save({ ...base, status: "open", pnl: null }, true);
    expect(store.trades[0].customField).toBe("keep");
    expect(store.trades[0].risk).toBe(25);
    store.save({ ...store.trades[0], status: "closed", pnl: -25 }, true);
    const reloaded = new JournalStore(localStorage);
    reloaded.load();
    expect(stats(reloaded.trades).avg).toBe(-1);
    reloaded.delete("a");
    expect(JSON.parse(localStorage.getItem(KEY)!).trades).toEqual([]);
  });
  it("rejects duplicate creation and keeps memory intact on save failure", () => {
    let raw: string | null = null;
    let fail = false;
    const store = new JournalStore({
      getItem: () => raw,
      setItem: (_, v) => {
        if (fail) throw Error("Storage full");
        raw = v;
      },
    });
    store.load();
    store.save(base, false);
    expect(() => store.save(base, false)).toThrow(/already/);
    fail = true;
    expect(() => store.save({ ...base, pnl: -25 }, true)).toThrow(
      /Storage full/,
    );
    expect(store.trades[0].pnl).toBe(50);
    expect(JSON.parse(raw!).trades[0].pnl).toBe(50);
  });
  it("protects unreadable records, malformed restores and stale tabs", () => {
    localStorage.setItem(KEY, "not-json");
    const store = new JournalStore(localStorage);
    expect(() => store.load()).toThrow();
    expect(() => store.save(base, false)).toThrow();
    expect(localStorage.getItem(KEY)).toBe("not-json");
    expect(() => store.commit([{ ...base, risk: 0 }], true)).toThrow();
    expect(localStorage.getItem(KEY)).toBe("not-json");
    store.commit([base], true);
    localStorage.setItem(KEY, JSON.stringify(backup([])));
    expect(() => store.save({ ...base, pnl: 0 }, true)).toThrow(/another tab/);
  });
});
describe("process milestones", () => {
  it("crosses once and recognizes plan consistency including losses", () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({
        ...base,
        id: String(i),
        followed: "unsure" as const,
      })),
      ten = [...nine, { ...base, id: "10", followed: "unsure" as const }];
    expect(milestones(nine, ten, new Set())).toEqual(["ten"]);
    expect(milestones(ten, ten, new Set())).toEqual([]);
    expect(milestones(nine, ten, new Set(["ten"]))).toEqual([]);
    const four = Array.from({ length: 4 }, (_, i) => ({
        ...base,
        id: String(i),
        date: `2026-10-0${i + 1}T12:00`,
      })),
      five = [
        ...four,
        { ...base, id: "5", date: "2026-10-05T12:00", pnl: -25 },
      ];
    expect(planStreak(five)).toBe(5);
    expect(milestones(four, five, new Set())).toEqual(["plan"]);
    expect(milestones(four, five, new Set(["plan"]))).toEqual([]);
  });
});
