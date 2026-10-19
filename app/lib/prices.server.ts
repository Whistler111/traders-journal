import { loadEnvFile } from "node:process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { normalizePair, type Pair, type PriceQuote } from "./alerts";
try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT")
    throw Error("Could not load the server environment file.", {
      cause: error,
    });
}
export class PriceError extends Error {
  constructor(
    message: string,
    public status = 503,
    public retryAfter = 3600,
  ) {
    super(message);
  }
}
export interface PriceProvider {
  getPrice(pair: Pair): Promise<PriceQuote>;
}
export class AlphaVantageProvider implements PriceProvider {
  constructor(
    private key: string,
    private request: typeof fetch = fetch,
    private clock = Date.now,
  ) {}
  async getPrice(pair: Pair): Promise<PriceQuote> {
    if (!this.key)
      throw new PriceError(
        "Price alerts need ALPHA_VANTAGE_API_KEY on the server.",
      );
    const url = new URL("https://www.alphavantage.co/query");
    url.searchParams.set("apikey", this.key);
    if (pair === "XAU/USD") {
      url.searchParams.set("function", "GOLD_SILVER_SPOT");
      url.searchParams.set("symbol", "XAU");
    } else {
      const [base, quote] = pair.split("/");
      url.searchParams.set("function", "CURRENCY_EXCHANGE_RATE");
      url.searchParams.set("from_currency", base);
      url.searchParams.set("to_currency", quote);
    }
    let response: Response;
    let data: Record<string, unknown>;
    try {
      response = await this.request(url, { signal: AbortSignal.timeout(8000) });
      data = await response.json();
    } catch {
      throw new PriceError(
        "Price provider is unavailable. Alerts will retry later.",
      );
    }
    if (response.status === 429 || data.Information || data.Note)
      throw new PriceError(
        "Provider rate limit or account restriction. Alerts will retry later.",
        429,
        3600,
      );
    if (!response.ok || data["Error Message"])
      throw new PriceError(
        "Provider could not supply this pair. Check your API access.",
      );
    let price: number, asOf: number;
    if (pair === "XAU/USD") {
      if (data.symbol !== "XAU" && data.symbol !== "GOLD")
        throw new PriceError("Provider returned the wrong gold symbol.");
      price =
        typeof data.price === "number" || typeof data.price === "string"
          ? Number(data.price)
          : NaN;
      asOf =
        typeof data.timestamp === "string"
          ? Date.parse(
              /(?:Z|[+-]\d\d:\d\d)$/.test(data.timestamp)
                ? data.timestamp
                : data.timestamp.replace(" ", "T") + "Z",
            )
          : NaN;
    } else {
      const rate = data["Realtime Currency Exchange Rate"] as
        Record<string, unknown> | undefined;
      if (
        !rate ||
        `${rate["1. From_Currency Code"]}/${rate["3. To_Currency Code"]}` !==
          pair ||
        !["UTC", "GMT"].includes(String(rate["7. Time Zone"]))
      )
        throw new PriceError(
          "Provider returned an unrecognized exchange-rate response.",
        );
      price = Number(rate["5. Exchange Rate"]);
      asOf = Date.parse(
        String(rate["6. Last Refreshed"]).replace(" ", "T") + "Z",
      );
    }
    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(asOf) ||
      asOf > this.clock() + 60_000
    )
      throw new PriceError("Provider returned an invalid price or timestamp.");
    return {
      pair,
      price,
      asOf,
      receivedAt: this.clock(),
      provider: "Alpha Vantage",
    };
  }
}
interface Budget {
  requests: number[];
  nextAt: number;
}
export interface BudgetStore {
  read(): Promise<Budget>;
  write(value: Budget): Promise<void>;
}
export class FileBudgetStore implements BudgetStore {
  constructor(private directory: string) {}
  async read() {
    try {
      const value: unknown = JSON.parse(
        await readFile(join(this.directory, "budget.json"), "utf8"),
      );
      if (
        !value ||
        typeof value !== "object" ||
        !("requests" in value) ||
        !Array.isArray(value.requests) ||
        !value.requests.every(
          (n) => typeof n === "number" && Number.isFinite(n),
        ) ||
        !("nextAt" in value) ||
        typeof value.nextAt !== "number" ||
        !Number.isFinite(value.nextAt)
      )
        throw Error("invalid");
      return value as Budget;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { requests: [], nextAt: 0 };
      throw new PriceError(
        "Price quota state could not be read. Polling is paused to protect the API allowance.",
      );
    }
  }
  async write(value: Budget) {
    try {
      await mkdir(this.directory, { recursive: true });
      const temp = join(this.directory, "budget.tmp");
      await writeFile(temp, JSON.stringify(value), "utf8");
      await rename(temp, join(this.directory, "budget.json"));
    } catch {
      throw new PriceError(
        "Price quota state could not be saved. Polling is paused.",
      );
    }
  }
}
export class PriceService {
  private cache = new Map<Pair, { quote: PriceQuote; expires: number }>();
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private provider: PriceProvider,
    private budget: BudgetStore,
    private clock = Date.now,
  ) {}
  getPrice(pair: Pair): Promise<{ quote: PriceQuote; nextPollAt: number }> {
    // One serialized shared budget across all pairs/tabs in this Node process. Persist before fetching.
    const work = this.tail.then(async () => {
      const now = this.clock(),
        ledger = await this.budget.read(),
        cached = this.cache.get(pair);
      if (cached && cached.expires > now)
        return {
          quote: cached.quote,
          nextPollAt: Math.max(now + 120_000, ledger.nextAt),
        };
      ledger.requests = ledger.requests.filter(
        (time) => time > now - 86_400_000,
      );
      if (ledger.requests.length >= 25)
        throw new PriceError(
          "Free daily price allowance reached. Alerts will resume automatically.",
          429,
          Math.max(
            60,
            Math.ceil((ledger.requests[0] + 86_400_000 - now) / 1000),
          ),
        );
      if (ledger.nextAt > now)
        throw new PriceError(
          "Free-plan price sampling is hourly across all pairs. Waiting for the next check.",
          429,
          Math.max(1, Math.ceil((ledger.nextAt - now) / 1000)),
        );
      ledger.requests.push(now);
      ledger.nextAt = now + 3_600_000;
      await this.budget.write(ledger);
      const quote = await this.provider.getPrice(pair);
      this.cache.set(pair, { quote, expires: now + 120_000 });
      return { quote, nextPollAt: ledger.nextAt };
    });
    this.tail = work.catch(() => {});
    return work;
  }
}
let service: PriceService | undefined;
export function priceService() {
  if (process.env.PRICE_PROVIDER !== "alphavantage")
    throw new PriceError(
      "Price alerts are not configured. Set PRICE_PROVIDER=alphavantage on the server.",
    );
  if (!process.env.ALPHA_VANTAGE_API_KEY)
    throw new PriceError(
      "Price alerts need ALPHA_VANTAGE_API_KEY on the server.",
    );
  return (service ??= new PriceService(
    new AlphaVantageProvider(process.env.ALPHA_VANTAGE_API_KEY),
    new FileBudgetStore(resolve(process.env.PRICE_STATE_DIR ?? ".price-state")),
  ));
}
export function requestedPair(value: string | null) {
  const pair = value && normalizePair(value);
  if (!pair)
    throw new PriceError(
      "Unsupported pair. Choose gold/USD or a supported major forex pair.",
      400,
      3600,
    );
  return pair;
}
