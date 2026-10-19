import { expect, it } from "vitest";
import {
  AlertQueue,
  deliveredState,
  normalizePair,
  parseRuntime,
  parseSettings,
  priceAlert,
  type PriceQuote,
} from "../app/lib/alerts";
import type { Trade } from "../app/lib/journal";
const now = +new Date("2026-10-19T12:00:00Z");
const trade: Trade = {
  id: "open-a",
  date: "2026-10-18T14:30",
  symbol: "XAUUSD",
  direction: "Long",
  entry: 2350.4,
  stop: 2340,
  risk: 25,
  pnl: null,
  status: "open",
  setup: "Test",
  session: "Other",
  emotion: "Calm",
  followed: "yes",
  reason: "Fictional test",
  lesson: "",
};
const quote = (price: number, asOf = now): PriceQuote => ({
  pair: "XAU/USD",
  price,
  asOf,
  receivedAt: asOf,
  provider: "Test fixture",
});
it("normalizes only supported gold and major currency pairs", () => {
  expect(normalizePair("xauusd")).toBe("XAU/USD");
  expect(normalizePair("eur/usd")).toBe("EUR/USD");
  expect(normalizePair("US30")).toBeNull();
});
it("describes BUY price increases as favorable and SELL increases as adverse", () => {
  const buy = priceAlert(trade, quote(2378.6), 0.5, undefined, now, 120000)!;
  expect(buy.favor).toBe(true);
  expect(buy.message).toContain("BUY at 2,350.40");
  expect(buy.message).toContain("+28.20");
  expect(buy.message).toContain("up 1.20%");
  const sell = priceAlert(
    { ...trade, direction: "Short", stop: 2360 },
    quote(2378.6),
    0.5,
    undefined,
    now,
    120000,
  )!;
  expect(sell.favor).toBe(false);
  expect(sell.message).toContain("against you");
});
it("describes SELL price drops as favorable and BUY drops as adverse", () => {
  expect(
    priceAlert(
      { ...trade, direction: "Short", stop: 2360 },
      quote(2300),
      0.5,
      undefined,
      now,
      120000,
    )!.favor,
  ).toBe(true);
  expect(
    priceAlert(trade, quote(2300), 0.5, undefined, now, 120000)!.favor,
  ).toBe(false);
});
it("fires at the next threshold step, not repeatedly on the same quote or retreat", () => {
  const original = priceAlert(
      trade,
      quote(trade.entry * 1.006),
      0.5,
      undefined,
      now,
      120000,
    )!,
    state = deliveredState(original);
  expect(original.step).toBe(1);
  expect(
    priceAlert(
      trade,
      quote(trade.entry * 1.007, now + 1000),
      0.5,
      state,
      now + 1000,
      120000,
    ),
  ).toBeNull();
  const next = priceAlert(
    trade,
    quote(trade.entry * 1.011, now + 2000),
    0.5,
    state,
    now + 2000,
    120000,
  )!;
  expect(next.step).toBe(2);
  const higher = deliveredState(next, state);
  expect(
    priceAlert(
      trade,
      quote(trade.entry * 1.006, now + 3000),
      0.5,
      higher,
      now + 3000,
      120000,
    ),
  ).toBeNull();
  expect(
    priceAlert(
      trade,
      quote(trade.entry * 1.006, now + 130000),
      0.5,
      higher,
      now + 130000,
      120000,
    ),
  ).not.toBeNull();
  expect(
    priceAlert(trade, original.quote, 0.5, state, now + 130000, 120000),
  ).toBeNull();
});
it("recognizes an adverse crossing after a favorable crossing", () => {
  const alert = priceAlert(
    trade,
    quote(trade.entry * 1.006),
    0.5,
    undefined,
    now,
    120000,
  )!;
  expect(
    priceAlert(
      trade,
      quote(trade.entry * 0.994, now + 1000),
      0.5,
      deliveredState(alert),
      now + 1000,
      120000,
    )!.favor,
  ).toBe(false);
});
it("excludes closed trades, pre-entry quotes, stale quotes, future quotes and invalid prices", () => {
  expect(
    priceAlert(
      { ...trade, status: "closed", pnl: 50 },
      quote(2400),
      0.5,
      undefined,
      now,
      120000,
    ),
  ).toBeNull();
  for (const value of [
    quote(0),
    quote(Infinity),
    quote(2400, now - 700000),
    quote(2400, now + 120000),
    quote(2400, +new Date("2026-10-17T00:00Z")),
  ])
    expect(priceAlert(trade, value, 0.5, undefined, now, 120000)).toBeNull();
  expect(
    priceAlert(trade, quote(2351), 0.5, undefined, now, 120000),
  ).toBeNull();
});
it("re-evaluates edited entry/direction and threshold signatures without modifying the trade", () => {
  const before = JSON.stringify(trade),
    a = priceAlert(trade, quote(2400), 0.5, undefined, now, 120000)!;
  const state = deliveredState(a);
  expect(
    priceAlert(trade, quote(2400, now + 1000), 1, state, now + 1000, 120000),
  ).not.toBeNull();
  expect(JSON.stringify(trade)).toBe(before);
});
it("staggered queue releases at most one alert per interval and removes closed trades", () => {
  const settings = parseSettings({ enabled: true }),
    other = { ...trade, id: "open-b" };
  const q = new AlertQueue();
  q.enqueue(priceAlert(trade, quote(2400), 0.5, undefined, now, 120000)!);
  q.enqueue(priceAlert(other, quote(2400), 0.5, undefined, now, 120000)!);
  expect(q.release(now, 120000, [trade, other], settings)?.tradeId).toBe(
    trade.id,
  );
  expect(q.release(now + 119999, 120000, [trade, other], settings)).toBeNull();
  expect(
    q.release(now + 120000, 120000, [trade, other], settings)?.tradeId,
  ).toBe(other.id);
  q.enqueue(priceAlert(trade, quote(2400), 0.5, undefined, now, 120000)!);
  expect(
    q.release(
      now + 240000,
      120000,
      [{ ...trade, status: "closed", pnl: 50 }],
      settings,
    ),
  ).toBeNull();
  expect(q.size).toBe(0);
});
it("deduplicates queued alerts for one trade and restores persisted staggering state", () => {
  const q = new AlertQueue(now);
  q.enqueue(priceAlert(trade, quote(2400), 0.5, undefined, now, 120000)!);
  q.enqueue(
    priceAlert(
      trade,
      quote(2410, now + 1000),
      0.5,
      undefined,
      now + 1000,
      120000,
    )!,
  );
  expect(q.size).toBe(1);
  expect(q.release(now + 1000, 120000, [trade], parseSettings({}))).toBeNull();
});
it("validates settings and tolerates invalid optional alert metadata", () => {
  expect(
    parseSettings({
      enabled: true,
      intervalMinutes: 0,
      thresholds: { "XAU/USD": NaN },
    }),
  ).toEqual({ enabled: true, intervalMinutes: 2, thresholds: {} });
  expect(
    parseRuntime({
      states: { bad: { maxFavor: NaN } },
      history: [{ message: "invalid" }],
    }),
  ).toEqual({ states: {}, history: [], lastReleasedAt: 0 });
});
