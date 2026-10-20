import { expect, it } from "vitest";
import { behaviorFlags, riskWarnings } from "../app/lib/behavior";
import { validateRisk } from "../app/lib/risk-config";
import type { Trade } from "../app/lib/journal";
function trade(
  id: string,
  open: string,
  close: string,
  pnl: number,
  volume: number,
): Trade {
  return {
    setup: "Test",
    reason: "Test",
    direction: "Long",
    session: "Other",
    emotion: "Calm",
    followed: "unsure",
    entry: 1.1,
    stop: 1,
    risk: 10,
    id,
    date: `2026-10-20T${open}`,
    sourceTimestamp: `2026-10-20T${open}:00Z`,
    closedAt: `2026-10-20T${close}:00Z`,
    status: "closed",
    pnl,
    volume,
    volumeUnit: "lot",
    symbol: "EURUSD",
    lesson: "",
  };
}
it("flags revenge only after a realized loss, within 15 minutes, with comparable larger size", () => {
  const a = trade("a", "08:00", "09:00", -10, 0.1),
    b = trade("b", "09:15", "09:30", -10, 0.2);
  expect(behaviorFlags([a, b], {}, "UTC").get("b")).toEqual(["Revenge trade"]);
  expect(behaviorFlags([a, { ...b, volume: 0.1 }], {}, "UTC").get("b")).toEqual(
    [],
  );
  expect(
    behaviorFlags(
      [a, { ...b, sourceTimestamp: "2026-10-20T09:16:00Z" }],
      {},
      "UTC",
    ).get("b"),
  ).toEqual([]);
  expect(
    behaviorFlags([{ ...a, closedAt: undefined }, b], {}, "UTC").get("b"),
  ).toEqual([]);
  expect(
    behaviorFlags([a, { ...b, symbol: "XAUUSD" }], {}, "UTC").get("b"),
  ).toEqual([]);
});
it("flags tilt and overtrading after thresholds, but not at the trade limit", () => {
  const rows = [
    trade("a", "06:00", "06:10", -10, 0.1),
    trade("b", "07:00", "07:10", -10, 0.1),
    trade("c", "08:00", "08:10", -10, 0.1),
    trade("d", "09:00", "09:10", 0, 0.2),
  ];
  expect(behaviorFlags(rows, { maxTrades: 3 }, "UTC").get("c")).toEqual([]);
  expect(behaviorFlags(rows, { maxTrades: 3 }, "UTC").get("d")).toEqual([
    "Overtrading",
    "Tilt streak",
  ]);
  expect(
    riskWarnings(
      rows.slice(0, 3),
      {
        dailyLoss: 3,
        dailyLossMode: "percent",
        referenceBalance: 1000,
        maxTrades: 3,
        maxLosses: 3,
      },
      "UTC",
      new Date("2026-10-20T10:00Z"),
    ),
  ).toHaveLength(3);
  expect(riskWarnings([], {}, "UTC")).toEqual([]);
});
it("validates disabled and percentage settings", () => {
  expect(validateRisk({})).toEqual({});
  expect(() =>
    validateRisk({ dailyLoss: 2, dailyLossMode: "percent" }),
  ).toThrow();
  expect(() => validateRisk({ maxTrades: 1.5 })).toThrow();
});
