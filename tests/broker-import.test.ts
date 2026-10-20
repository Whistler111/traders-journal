import { expect, it } from "vitest";
import {
  inferColumns,
  parseCsv,
  previewCsv,
  tradeIdentity,
} from "../app/lib/csv-import";
const text =
  "open time,close time,symbol,type,volume,open price,close price,profit,stop,risk,reason\n2026.10.18 10:00,2026.10.18 11:00,EURUSD,buy,0.1,1.1,1.2,20,1.0,10,Recorded plan";
it("maps broker columns, preserves volume/close instant, and dedupes by stable fill", () => {
  const rows = parseCsv(text),
    map = inferColumns(rows[0]);
  const result = previewCsv(rows, map, "UTC", "iso", [])[0];
  expect(result.error).toBeUndefined();
  expect(result.trade).toMatchObject({
    volume: 0.1,
    closedAt: "2026-10-18T11:00:00.000Z",
    closePrice: 1.2,
    pnl: 20,
  });
  const edited = { ...result.trade!, pnl: 100 };
  expect(tradeIdentity(edited)).toBe(tradeIdentity(result.trade!));
  expect(previewCsv(rows, map, "UTC", "iso", [edited])[0].duplicate).toBe(true);
});
it("flags invalid volume and missing required journal context", () => {
  const rows = parseCsv(text.replace(",0.1,", ",-1,"));
  expect(
    previewCsv(rows, inferColumns(rows[0]), "UTC", "iso", [])[0].error,
  ).toContain("volume");
  const missing = parseCsv(text.replace(",1.0,10,", ",,10,"));
  expect(
    previewCsv(missing, inferColumns(missing[0]), "UTC", "iso", [])[0].error,
  ).toContain("stop");
});
it("caps CSV at five MB", () => {
  expect(() => parseCsv("x".repeat(5 * 1024 * 1024 + 1))).toThrow("5 MB");
});
it("exports optional journaling fields and restores them through column mapping", async () => {
  const { csv } = await import("../app/lib/journal");
  const rows = parseCsv(text),
    map = inferColumns(rows[0]);
  const base = previewCsv(rows, map, "UTC", "iso", [])[0].trade!;
  const original = {
    ...base,
    rating: 4,
    followedPlan: true,
    journalReview: {
      playbookId: "p",
      playbookName: "Sweep",
      rules: [{ label: "Waited", checked: true }],
      mistakes: [],
    },
  };
  const exported = parseCsv(csv([original]));
  const roundtrip = previewCsv(
    exported,
    inferColumns(exported[0]),
    "UTC",
    "iso",
    [],
  )[0];
  expect(roundtrip.error).toBeUndefined();
  expect(roundtrip.trade).toMatchObject({
    rating: 4,
    followedPlan: true,
    volume: 0.1,
    closedAt: original.closedAt,
    journalReview: original.journalReview,
  });
});
it("reads semicolon-delimited broker exports", () => {
  const rows = parseCsv(text.replaceAll(",", ";"));
  expect(
    previewCsv(rows, inferColumns(rows[0]), "UTC", "iso", [])[0].trade?.symbol,
  ).toBe("EURUSD");
});
