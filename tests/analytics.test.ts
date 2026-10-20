import { describe, expect, it } from "vitest";
import { metrics, groupedMetrics } from "../app/lib/analytics";
import type { Trade } from "../app/lib/journal";
const rows = [100, -50, -25, 0, 200].map(
  (pnl, i) =>
    ({
      id: String(i),
      date: `2026-10-0${i + 1}T10:00`,
      status: "closed",
      pnl,
      risk: 50,
      setup: i % 2 ? "B" : "A",
    }) as Trade,
);
describe("report calculations", () => {
  it("handles empty and single results", () => {
    expect(metrics([]).winRate).toBeNull();
    expect(metrics([rows[0]]).noLosses).toBe(true);
    expect(metrics([rows[0]]).drawdown).toBe(0);
  });
  it("computes known results including breakeven and drawdown", () => {
    expect(metrics(rows)).toMatchObject({
      net: 225,
      winRate: 0.4,
      profitFactor: 4,
      averageR: 0.9,
      expectancy: 45,
      averageWin: 150,
      averageLoss: -37.5,
      largestWin: 200,
      largestLoss: -50,
      drawdown: 75,
      winStreak: 1,
      lossStreak: 2,
    });
  });
  it("sorts groups by profit and does not mutate input", () => {
    expect(groupedMetrics(rows, (t) => t.setup)[0].label).toBe("A");
    expect(rows[0].pnl).toBe(100);
  });
  it("requires a nonempty fully checked checklist for discipline", () => {
    expect(
      metrics([
        {
          ...rows[0],
          journalReview: {
            playbookId: "p",
            playbookName: "P",
            rules: [{ label: "Wait", checked: true }],
            mistakes: [],
          },
        },
        rows[1],
      ]).discipline,
    ).toBe(0.5);
  });
});
