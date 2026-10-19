import { afterEach, expect, it, vi } from "vitest";
import {
  AlphaVantageProvider,
  PriceService,
  type BudgetStore,
  type PriceProvider,
} from "../app/lib/prices.server";
import { loader } from "../app/routes/api.price";
const now = +new Date("2026-10-19T12:00:00Z");
afterEach(() => vi.unstubAllEnvs());
it("adapts provider gold prices and timestamps using a server-only key", async () => {
  const request = vi.fn<typeof fetch>(async () =>
    Response.json({
      symbol: "XAU",
      price: "2378.60",
      timestamp: "2026-10-19T12:00:00Z",
    }),
  );
  const provider = new AlphaVantageProvider(
    "test-server-key",
    request,
    () => now,
  );
  const quote = await provider.getPrice("XAU/USD");
  expect(quote.price).toBe(2378.6);
  expect(quote.asOf).toBe(now);
  const url = new URL(String(request.mock.calls[0][0]));
  expect(url.hostname).toBe("www.alphavantage.co");
  expect(url.searchParams.get("function")).toBe("GOLD_SILVER_SPOT");
  expect(JSON.stringify(quote)).not.toContain("test-server-key");
});
it("adapts forex exchange-rate data without calculating profit or changing trades", async () => {
  const request = vi.fn(async () =>
    Response.json({
      "Realtime Currency Exchange Rate": {
        "1. From_Currency Code": "EUR",
        "3. To_Currency Code": "USD",
        "5. Exchange Rate": "1.12345",
        "6. Last Refreshed": "2026-10-19 12:00:00",
        "7. Time Zone": "UTC",
      },
    }),
  );
  expect(
    (
      await new AlphaVantageProvider("test-key", request, () => now).getPrice(
        "EUR/USD",
      )
    ).price,
  ).toBe(1.12345);
});
it("handles provider rate limits, malformed responses and wrong symbols safely", async () => {
  const limited = new AlphaVantageProvider(
    "key",
    async () => Response.json({ Information: "limit reached" }),
    () => now,
  );
  await expect(limited.getPrice("XAU/USD")).rejects.toMatchObject({
    status: 429,
  });
  for (const value of [
    { symbol: "XAG", price: 20, timestamp: "2026-10-19T12:00Z" },
    { symbol: "XAU", price: "invalid", timestamp: "now" },
    { symbol: "XAU", price: 2400 },
  ])
    await expect(
      new AlphaVantageProvider(
        "key",
        async () => Response.json(value),
        () => now,
      ).getPrice("XAU/USD"),
    ).rejects.toThrow();
});
function memoryBudget(): BudgetStore & {
  value: { requests: number[]; nextAt: number };
} {
  return {
    value: { requests: [], nextAt: 0 },
    async read() {
      return structuredClone(this.value);
    },
    async write(value) {
      this.value = structuredClone(value);
    },
  };
}
it("coalesces same-pair requests across tabs and enforces a shared hourly budget across pairs", async () => {
  const budget = memoryBudget(),
    getPrice = vi.fn(async (pair: "XAU/USD" | "EUR/USD") => ({
      pair,
      price: 2400,
      asOf: now,
      receivedAt: now,
      provider: "Mock",
    }));
  let time = now;
  const service = new PriceService(
    { getPrice } as PriceProvider,
    budget,
    () => time,
  );
  await Promise.all([
    service.getPrice("XAU/USD"),
    service.getPrice("XAU/USD"),
    service.getPrice("XAU/USD"),
  ]);
  expect(getPrice).toHaveBeenCalledTimes(1);
  await expect(service.getPrice("EUR/USD")).rejects.toMatchObject({
    status: 429,
  });
  time += 121000;
  await expect(service.getPrice("XAU/USD")).rejects.toMatchObject({
    status: 429,
  });
  time = now + 3600000;
  await service.getPrice("EUR/USD");
  expect(getPrice).toHaveBeenCalledTimes(2);
});
it("preserves the quota across service instances and refuses to fetch if budget persistence fails", async () => {
  const budget = memoryBudget(),
    getPrice = vi.fn(async () => ({
      pair: "XAU/USD" as const,
      price: 2400,
      asOf: now,
      receivedAt: now,
      provider: "Mock",
    }));
  await new PriceService({ getPrice }, budget, () => now).getPrice("XAU/USD");
  await expect(
    new PriceService({ getPrice }, budget, () => now).getPrice("EUR/USD"),
  ).rejects.toMatchObject({ status: 429 });
  expect(getPrice).toHaveBeenCalledTimes(1);
  const failing: BudgetStore = {
    read: async () => ({ requests: [], nextAt: 0 }),
    write: async () => {
      throw Error("Read-only disk");
    },
  };
  await expect(
    new PriceService({ getPrice }, failing, () => now).getPrice("XAU/USD"),
  ).rejects.toThrow("Read-only disk");
  expect(getPrice).toHaveBeenCalledTimes(1);
});
it("never exceeds the daily 25-request allowance", async () => {
  const budget = memoryBudget();
  budget.value.requests = Array.from(
    { length: 25 },
    (_, i) => now - 25000 + i * 1000,
  );
  const getPrice = vi.fn();
  await expect(
    new PriceService({ getPrice }, budget, () => now).getPrice("XAU/USD"),
  ).rejects.toMatchObject({ status: 429 });
  expect(getPrice).not.toHaveBeenCalled();
});
it("price API returns safe setup and validation errors without making an upstream request", async () => {
  vi.stubEnv("PRICE_PROVIDER", "");
  vi.stubEnv("ALPHA_VANTAGE_API_KEY", "");
  const invalid = await loader({
    request: new Request("http://localhost/api/price?pair=arbitrary"),
  });
  expect(invalid.status).toBe(400);
  const missing = await loader({
    request: new Request("http://localhost/api/price?pair=XAUUSD"),
  });
  expect(missing.status).toBe(503);
  expect(missing.headers.get("Retry-After")).toBe("3600");
  expect(await missing.json()).toMatchObject({
    error: expect.stringContaining("not configured"),
  });
});
