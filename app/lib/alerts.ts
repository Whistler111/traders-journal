import type { Trade } from "./journal";
export const PAIRS = [
  "XAU/USD",
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "AUD/USD",
  "USD/CAD",
  "NZD/USD",
] as const;
export type Pair = (typeof PAIRS)[number];
export function normalizePair(symbol: string): Pair | null {
  const clean = symbol.toUpperCase().replace(/[\s/_-]/g, "");
  return PAIRS.find((pair) => pair.replace("/", "") === clean) ?? null;
}
export interface PriceQuote {
  pair: Pair;
  price: number;
  asOf: number;
  receivedAt: number;
  provider: string;
}
export interface AlertSettings {
  enabled: boolean;
  intervalMinutes: number;
  thresholds: Partial<Record<Pair, number>>;
}
export const DEFAULT_SETTINGS: AlertSettings = {
  enabled: false,
  intervalMinutes: 2,
  thresholds: {},
};
export function parseSettings(raw: unknown): AlertSettings {
  if (!raw || typeof raw !== "object")
    return { ...DEFAULT_SETTINGS, thresholds: {} };
  const value = raw as Partial<AlertSettings>,
    thresholds: AlertSettings["thresholds"] = {};
  if (value.thresholds && typeof value.thresholds === "object")
    for (const pair of PAIRS) {
      const n = value.thresholds[pair];
      if (typeof n === "number" && Number.isFinite(n) && n >= 0.01 && n <= 100)
        thresholds[pair] = n;
    }
  return {
    enabled: value.enabled === true,
    intervalMinutes:
      typeof value.intervalMinutes === "number" &&
      Number.isFinite(value.intervalMinutes) &&
      value.intervalMinutes >= 1 &&
      value.intervalMinutes <= 120
        ? value.intervalMinutes
        : 2,
    thresholds,
  };
}
export interface AlertState {
  signature: string;
  maxFavor: number;
  maxAgainst: number;
  lastAt: number;
  quoteAt: number;
}
export interface PriceAlert {
  id: string;
  tradeId: string;
  signature: string;
  message: string;
  pair: Pair;
  favor: boolean;
  step: number;
  quote: PriceQuote;
  createdAt: number;
}
export function tradeSignature(t: Trade, threshold: number) {
  return [t.id, t.symbol, t.direction, t.entry, t.date, threshold].join("|");
}
export function priceAlert(
  t: Trade,
  quote: PriceQuote,
  threshold: number,
  previous: AlertState | undefined,
  now: number,
  cooldownMs: number,
): PriceAlert | null {
  const pair = normalizePair(t.symbol),
    opened = +new Date(t.date);
  if (
    t.status !== "open" ||
    !pair ||
    pair !== quote.pair ||
    !Number.isFinite(t.entry) ||
    t.entry <= 0 ||
    !Number.isFinite(threshold) ||
    threshold <= 0 ||
    !Number.isFinite(quote.price) ||
    quote.price <= 0 ||
    !Number.isFinite(opened) ||
    !Number.isFinite(quote.asOf) ||
    quote.asOf < opened ||
    quote.asOf > now + 60_000 ||
    now - quote.asOf > 10 * 60_000
  )
    return null;
  const raw = ((quote.price - t.entry) / t.entry) * 100,
    step = Math.floor((Math.abs(raw) + 1e-10) / threshold),
    favor = (t.direction === "Long" ? raw : -raw) > 0;
  if (step < 1 || !Number.isFinite(raw)) return null;
  const signature = tradeSignature(t, threshold),
    state = previous?.signature === signature ? previous : undefined;
  if (
    state &&
    (quote.asOf <= state.quoteAt ||
      (step <= (favor ? state.maxFavor : state.maxAgainst) &&
        now - state.lastAt < cooldownMs))
  )
    return null;
  const digits = pair === "XAU/USD" || pair === "USD/JPY" ? 2 : 5,
    format = (n: number) =>
      n.toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
  const difference = quote.price - t.entry;
  return {
    id: `${t.id}:${quote.asOf}:${signature}`,
    tradeId: t.id,
    signature,
    pair,
    favor,
    step,
    quote,
    createdAt: now,
    message: `${pair} is ${raw >= 0 ? "up" : "down"} ${Math.abs(raw).toFixed(2)}% since your ${t.direction === "Long" ? "BUY" : "SELL"} at ${format(t.entry)}. Now ${format(quote.price)} (${difference >= 0 ? "+" : "−"}${format(Math.abs(difference))}), ${favor ? "in your favor" : "against you"}.`,
  };
}
export function deliveredState(
  alert: PriceAlert,
  previous?: AlertState,
): AlertState {
  const prior = previous?.signature === alert.signature ? previous : undefined;
  return {
    signature: alert.signature,
    maxFavor: Math.max(prior?.maxFavor ?? 0, alert.favor ? alert.step : 0),
    maxAgainst: Math.max(prior?.maxAgainst ?? 0, alert.favor ? 0 : alert.step),
    lastAt: alert.createdAt,
    quoteAt: alert.quote.asOf,
  };
}
export class AlertQueue {
  private items = new Map<string, PriceAlert>();
  constructor(public lastReleasedAt = 0) {}
  enqueue(alert: PriceAlert) {
    this.items.set(alert.tradeId, alert);
  }
  release(
    now: number,
    intervalMs: number,
    trades: Trade[],
    settings: AlertSettings,
  ) {
    for (const [id, item] of this.items) {
      const trade = trades.find((t) => t.id === id);
      if (
        !trade ||
        trade.status !== "open" ||
        tradeSignature(trade, settings.thresholds[item.pair] ?? 0.5) !==
          item.signature ||
        now - item.quote.asOf > 10 * 60_000
      )
        this.items.delete(id);
    }
    if (now - this.lastReleasedAt < intervalMs) return null;
    const first = this.items.entries().next().value as
      [string, PriceAlert] | undefined;
    if (!first) return null;
    this.items.delete(first[0]);
    this.lastReleasedAt = now;
    return { ...first[1], createdAt: now };
  }
  get size() {
    return this.items.size;
  }
}
export interface AlertRuntime {
  states: Record<string, AlertState>;
  history: PriceAlert[];
  lastReleasedAt: number;
}
export function parseRuntime(value: unknown): AlertRuntime {
  const empty: AlertRuntime = { states: {}, history: [], lastReleasedAt: 0 };
  if (!value || typeof value !== "object") return empty;
  const raw = value as Partial<AlertRuntime>;
  if (raw.states && typeof raw.states === "object")
    for (const [id, state] of Object.entries(raw.states))
      if (
        state &&
        typeof state.signature === "string" &&
        [state.maxFavor, state.maxAgainst, state.lastAt, state.quoteAt].every(
          (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
        )
      )
        empty.states[id] = state;
  if (Array.isArray(raw.history))
    empty.history = raw.history
      .filter(
        (a) =>
          a &&
          typeof a.id === "string" &&
          typeof a.tradeId === "string" &&
          typeof a.message === "string" &&
          a.message.length < 1000 &&
          typeof a.createdAt === "number" &&
          Number.isFinite(a.createdAt),
      )
      .slice(0, 50);
  if (
    typeof raw.lastReleasedAt === "number" &&
    Number.isFinite(raw.lastReleasedAt)
  )
    empty.lastReleasedAt = Math.max(0, raw.lastReleasedAt);
  return empty;
}
