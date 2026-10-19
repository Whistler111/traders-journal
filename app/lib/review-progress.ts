import { unpackNotes, type Trade } from "./journal";
import type { DailyReflection } from "./practice";
export const hasTradeReview = (trade: Trade) =>
  trade.status === "closed" &&
  trade.followed !== "unsure" &&
  !!unpackNotes(trade.lesson).notes.trim();
export const hasDailyReview = (reflection: DailyReflection | undefined) =>
  !!reflection?.worked.trim() && !!reflection?.improve.trim();
