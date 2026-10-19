import { expect, it } from "vitest";
import { hasDailyReview, hasTradeReview } from "../app/lib/review-progress";
import type { Trade } from "../app/lib/journal";
it("recognizes explicit closed-trade reflections regardless of the outcome", () => {
  const trade = {
    status: "closed",
    followed: "no",
    lesson: "I chased the move; next time wait.",
    pnl: -25,
  } as Trade;
  expect(hasTradeReview(trade)).toBe(true);
  expect(hasTradeReview({ ...trade, pnl: 25 })).toBe(true);
  expect(hasTradeReview({ ...trade, followed: "unsure" })).toBe(false);
  expect(hasTradeReview({ ...trade, status: "open" })).toBe(false);
  expect(hasTradeReview({ ...trade, lesson: " " })).toBe(false);
});
it("recognizes a daily review only when both reflection prompts are answered", () => {
  expect(
    hasDailyReview({
      date: "2026-10-19",
      plan: "",
      worked: "I waited.",
      improve: "Check the session.",
    }),
  ).toBe(true);
  expect(
    hasDailyReview({
      date: "2026-10-19",
      plan: "Focus",
      worked: "I waited.",
      improve: " ",
    }),
  ).toBe(false);
  expect(hasDailyReview(undefined)).toBe(false);
});
