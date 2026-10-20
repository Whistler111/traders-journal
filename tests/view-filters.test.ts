import { expect, it } from "vitest";
import {
  comparisonWindow,
  initialFilters,
  periodRange,
  previousRange,
} from "../app/lib/view-filters";
it("builds inclusive presets and previous periods across month/year boundaries", () => {
  const now = new Date(2026, 0, 3, 12);
  expect(periodRange("7D", now)).toEqual({
    from: "2025-12-28",
    to: "2026-01-03",
  });
  expect(periodRange("This month", now)).toEqual({
    from: "2026-01-01",
    to: "2026-01-03",
  });
  expect(previousRange({ from: "2026-01-01", to: "2026-01-03" })).toEqual({
    from: "2025-12-29",
    to: "2025-12-31",
  });
  expect(comparisonWindow({ from: "2026-01-01", to: "2026-01-03" })).toEqual({
    from: "2025-12-29",
    to: "2026-01-03",
  });
});
it("prefers URL choices over the session and rejects invalid periods/dates", () => {
  const saved = JSON.stringify({
    from: "2026-10-01",
    to: "2026-10-20",
    period: "Custom",
    pair: "EURUSD",
    setup: "Sweep",
  });
  expect(initialFilters("?pair=XAUUSD", saved)).toMatchObject({
    pair: "XAUUSD",
    setup: "Sweep",
    from: "2026-10-01",
  });
  expect(initialFilters("?from=2026-02-30", saved).from).not.toBe("2026-02-30");
  expect(initialFilters("?period=Forever", saved).period).toBe("30D");
  expect(initialFilters("?from=2026-11-01&to=2026-10-01", saved).period).toBe(
    "30D",
  );
});
