import { describe, it, expect } from "vitest";
import {
  emptyPractice,
  validatePractice,
  validateReview,
} from "../app/lib/practice";
import { JournalStore } from "./helpers/legacy-journal-store";
import { csv, type Trade } from "../app/lib/journal";
import {
  csvInstant,
  inferColumns,
  parseCsv,
  previewCsv,
} from "../app/lib/csv-import";
const base: Trade = {
  id: "old",
  date: "2026-10-18T14:30",
  symbol: "XAUUSD",
  direction: "Long",
  entry: 2700,
  stop: 2690,
  risk: 25,
  status: "closed",
  pnl: -25,
  reason: "Waited for confirmation",
  lesson: "Review the exit",
  setup: "Breakout",
  session: "London",
  emotion: "Calm",
  followed: "yes",
};
describe("review data and legacy backups", () => {
  it("stores playbooks and reflections atomically with trades and preserves them through edits", () => {
    const store = new JournalStore(localStorage);
    store.load();
    store.save(base, false);
    const practice = {
      playbooks: [
        {
          id: "p",
          name: "Breakout",
          description: "Wait",
          rules: ["Confirmation"],
        },
      ],
      reflections: [
        {
          date: "2026-10-18",
          plan: "Wait",
          worked: "Patience",
          improve: "Size",
        },
      ],
    };
    store.commit(store.trades, false, practice);
    store.save({ ...base, lesson: "Updated" }, true);
    const second = new JournalStore(localStorage);
    expect(second.load()[0].lesson).toBe("Updated");
    expect(second.practice).toEqual(practice);
    localStorage.setItem(
      "trade-notes-v1",
      JSON.stringify({ version: 1, trades: [] }),
    );
    expect(() => second.commit(second.trades, false, emptyPractice())).toThrow(
      "another tab",
    );
    expect(second.practice).toEqual(practice);
    second.load();
    expect(second.practice).toEqual(emptyPractice());
  });
  it("rejects invalid tags, malformed dates and collections before committing", () => {
    expect(() =>
      validateReview({
        playbookId: "",
        playbookName: "",
        rules: [],
        mistakes: ["FOMO", "fomo"],
      }),
    ).toThrow();
    expect(() =>
      validatePractice({
        playbooks: [],
        reflections: [
          { date: "2026-02-30", plan: "", worked: "", improve: "" },
        ],
      }),
    ).toThrow();
    expect(() =>
      validatePractice({
        playbooks: [
          { id: "p", name: "A", description: "", rules: ["x".repeat(201)] },
        ],
        reflections: [],
      }),
    ).toThrow();
  });
});
describe("CSV review and timezone conversion", () => {
  it("reads quotes/newlines, imports the existing export including protected negative P&L and detects duplicates", () => {
    const rows = parseCsv(
      csv([{ ...base, reason: 'A comma, and a "quote"\nNext line' }, base]),
    );
    const preview = previewCsv(
      rows,
      inferColumns(rows[0]),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      "iso",
      [],
    );
    expect(preview[0].trade).toMatchObject({
      pnl: -25,
      reason: 'A comma, and a "quote"\nNext line',
      risk: 25,
    });
    expect(preview[1].duplicate).toBe(true);
    const existing = previewCsv(
      rows,
      inferColumns(rows[0]),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      "iso",
      [base],
    );
    expect(existing.every((r) => r.duplicate)).toBe(true);
  });
  it("requires complete records, respects zero P&L, rejects non-USD currency and malformed CSV", () => {
    const rows = parseCsv(
      "date,symbol,direction,entry,stop,risk,status,pnl,reason,currency\n2026-10-18 14:30,EURUSD,Buy,1.1,1.09,25,closed,0,Test,USD\n2026-10-18 14:30,EURUSD,Buy,1.1,1.09,25,closed,,Test,USD\n2026-10-18 14:30,EURUSD,Buy,1.1,1.09,25,closed,5,Test,EUR",
    );
    const preview = previewCsv(rows, inferColumns(rows[0]), "UTC", "iso", []);
    expect(preview[0].trade?.pnl).toBe(0);
    expect(preview[1].error).toBeTruthy();
    expect(preview[2].error).toMatch(/USD/);
    expect(() => parseCsv('a,b\n"unfinished,b')).toThrow();
    expect(() => parseCsv("a,a\n1,2")).toThrow();
    expect(() => parseCsv("a,b\n1,2,3")).toThrow();
  });
  it("converts IANA timezones and explicit offsets, rejects DST ambiguity/gaps and invalid dates", () => {
    expect(csvInstant("2026-10-18 14:30", "Africa/Lagos").toISOString()).toBe(
      "2026-10-18T13:30:00.000Z",
    );
    expect(
      csvInstant("18/10/2026 14:30", "America/New_York", "dmy").toISOString(),
    ).toBe("2026-10-18T18:30:00.000Z");
    expect(
      csvInstant("2026-10-18T14:30:00.123+01:00", "UTC").toISOString(),
    ).toBe("2026-10-18T13:30:00.123Z");
    expect(() => csvInstant("2026-03-08 02:30", "America/New_York")).toThrow(
      "does not exist",
    );
    expect(() => csvInstant("2026-11-01 01:30", "America/New_York")).toThrow(
      "Ambiguous",
    );
    expect(
      csvInstant("2026-11-01T01:30-05:00", "America/New_York").toISOString(),
    ).toBe("2026-11-01T06:30:00.000Z");
    expect(() => csvInstant("2026-02-30 10:00", "UTC")).toThrow();
  });
});
