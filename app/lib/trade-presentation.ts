import { money, outcome, rFormat, unpackNotes, type Trade } from "./journal";
export const priceFormat = (value: number) =>
  value.toLocaleString(undefined, { maximumSignificantDigits: 17 });
export function tradeDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function outcomeLabel(trade: Trade) {
  return { open: "Open", win: "Profit", loss: "Loss", breakeven: "Breakeven" }[
    outcome(trade)
  ];
}
export function tradeSummary(trade: Trade, includeNotes = false) {
  const details = unpackNotes(trade.lesson);
  return [
    `${trade.symbol} · ${trade.direction === "Long" ? "Buy / Long" : "Sell / Short"} · ${outcomeLabel(trade)}`,
    `Recorded ${tradeDate(trade.date)}`,
    `Entry: ${priceFormat(trade.entry)} · Original stop: ${priceFormat(trade.stop)}`,
    `Initial risk: ${money(trade.risk)} USD`,
    trade.status === "closed"
      ? `Net realized: ${money(trade.pnl)} USD · ${rFormat(trade.pnl! / trade.risk)}`
      : "Open trade · no realized result recorded.",
    ...(includeNotes
      ? [
          `Entry reason: ${trade.reason}`,
          ...(details.notes ? [`Reflection: ${details.notes}`] : []),
        ]
      : []),
    "Shared from Trade Notes.",
  ].join("\n");
}
