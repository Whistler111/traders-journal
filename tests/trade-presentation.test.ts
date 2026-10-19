import { expect, it } from "vitest";
import {
  tradeSummary,
  outcomeLabel,
  priceFormat,
} from "../app/lib/trade-presentation";
import { packNotes, type Trade } from "../app/lib/journal";
const base: Trade = {
  id: "preview",
  date: "2026-10-18T14:30",
  symbol: "EURUSD",
  setup: "Test",
  reason: "Private entry reason",
  lesson: packNotes("Private reflection", "1.2", "0.1 lots"),
  direction: "Long",
  session: "Other",
  emotion: "Calm",
  followed: "yes",
  status: "closed",
  entry: 1.1,
  stop: 1.09,
  risk: 25,
  pnl: 50,
};
it("shares recorded results with initial risk while omitting private notes and screenshots by default", () => {
  const summary = tradeSummary({
    ...base,
    screenshots: [
      {
        id: "secret",
        name: "secret.png",
      },
    ],
  });
  expect(summary).toContain("$50.00 USD · 2.00 R");
  expect(summary).toContain("Initial risk: $25.00 USD");
  expect(summary).not.toMatch(/Private|secret|0.1 lots/);
  expect(tradeSummary(base, true)).toContain(
    "Entry reason: Private entry reason",
  );
  expect(tradeSummary(base, true)).toContain("Reflection: Private reflection");
});
it("keeps open trades and zero results distinct, and preserves small quoted prices", () => {
  const open = {
    ...base,
    status: "open" as const,
    pnl: null,
    direction: "Short" as const,
  };
  expect(tradeSummary(open)).toContain("Sell / Short · Open");
  expect(tradeSummary(open)).toContain("no realized result recorded");
  expect(tradeSummary(open)).not.toContain("Net realized");
  expect(outcomeLabel({ ...base, pnl: 0 })).toBe("Breakeven");
  expect(tradeSummary({ ...base, pnl: 0 })).toContain("$0.00 USD · 0.00 R");
  expect(priceFormat(0.00001234)).toContain("0.00001234");
  expect(priceFormat(0.0000000001234)).toContain("0.0000000001234");
});
