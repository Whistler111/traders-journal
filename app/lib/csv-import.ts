import { unpackNotes, validate, type Trade } from "./journal";
export const importFields = [
  "date",
  "symbol",
  "direction",
  "entry",
  "stop",
  "risk",
  "status",
  "pnl",
  "reason",
  "setup",
  "session",
  "emotion",
  "followed",
  "lesson",
  "sourceId",
  "currency",
  "closedAt",
  "closePrice",
  "volume",
  "volumeUnit",
  "rating",
  "followedPlan",
  "journalReview",
] as const;
export type ImportField = (typeof importFields)[number];
export type ColumnMap = Record<ImportField, string>;
export type DateOrder = "iso" | "dmy" | "mdy";
export interface CsvRow {
  line: number;
  trade?: Trade;
  duplicate: boolean;
  error?: string;
}
export function parseCsv(input: string): string[][] {
  if (input.length > 5 * 1024 * 1024)
    throw Error("CSV exceeds 5 MB. Split it into smaller files.");
  const text = input.replace(/^\uFEFF/, "");
  const headerLine = text.split(/\r?\n/, 1)[0];
  const delimiter = [",", ";", "\t"].sort(
    (a, b) => headerLine.split(b).length - headerLine.split(a).length,
  )[0];
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw Error("Unexpected quote in CSV.");
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
      closed = false;
      if (rows.length > 5001)
        throw Error("Import at most 5,000 rows at a time.");
    } else {
      if (closed && c.trim())
        throw Error("Unexpected text after a quoted CSV value.");
      if (!closed) cell += c;
    }
  }
  if (quoted) throw Error("CSV has an unclosed quoted field.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length < 2)
    throw Error("CSV needs a header row and at least one trade.");
  const headers = rows[0].map((h) => h.trim());
  if (new Set(headers).size !== headers.length || headers.some((h) => !h))
    throw Error("CSV column names must be present and unique.");
  rows[0] = headers;
  if (rows.some((r) => r.length !== headers.length))
    throw Error(
      "CSV rows have different column counts. Check quotes and commas.",
    );
  if (rows.length > 5001) throw Error("Import at most 5,000 rows at a time.");
  return rows;
}
const aliases: Partial<Record<ImportField, string[]>> = {
  date: ["date", "datetime", "entrytime", "opentime", "openedat", "tradetime"],
  symbol: ["symbol", "asset", "pair", "instrument", "ticker"],
  direction: ["direction", "side", "action", "type"],
  entry: ["entry", "entryprice", "openprice"],
  stop: ["stop", "stopprice", "stoploss", "initialstop"],
  risk: ["risk", "riskusd", "initialrisk", "amountrisked"],
  status: ["status", "tradestatus"],
  pnl: ["profit", "pnl", "netpnl", "netprofit", "netprofitloss", "profitloss"],
  reason: ["reason", "entryreason", "notes"],
  sourceId: ["sourceid", "tradeid", "positionid", "id"],
  closedAt: ["closetime", "closedat", "exittime"],
  closePrice: ["closeprice", "exitprice"],
  volume: ["volume", "lots", "size"],
  volumeUnit: ["volumeunit", "sizeunit"],
  currency: ["currency", "accountcurrency"],
};
export function inferColumns(headers: string[]): ColumnMap {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return Object.fromEntries(
    importFields.map((field) => [
      field,
      headers.find((h) =>
        (aliases[field] ?? [normalize(field)]).includes(normalize(h)),
      ) ?? "",
    ]),
  ) as ColumnMap;
}
function calendar(value: string) {
  const m = value.match(
    /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)(?::(\d\d)(?:\.(\d{1,3}))?)?$/,
  );
  if (!m) throw Error("Use a date and time, for example 2026-10-18 14:30.");
  const p = m.slice(1, 7).map((n) => Number(n ?? 0));
  const [y, mo, d, h, mi, s] = p;
  const utc = Date.UTC(
    y,
    mo - 1,
    d,
    h,
    mi,
    s,
    Number((m[7] ?? "").padEnd(3, "0")),
  );
  const dt = new Date(utc);
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d ||
    h > 23 ||
    mi > 59 ||
    s > 59
  )
    throw Error("Invalid calendar date or time.");
  return {
    utc,
    key: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${String(s).padStart(2, "0")}`,
  };
}
export function csvInstant(
  raw: string,
  zone: string,
  order: DateOrder = "iso",
): Date {
  let value = raw.trim().replace(/^(\d{4})\.(\d\d)\.(\d\d)/, "$1-$2-$3");
  if (order !== "iso") {
    const m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})([ T].+)$/);
    if (!m) throw Error("Date does not match the selected day/month order.");
    value = `${m[3]}-${(order === "dmy" ? m[2] : m[1]).padStart(2, "0")}-${(order === "dmy" ? m[1] : m[2]).padStart(2, "0")}${m[4]}`;
  }
  const suffix = value.match(/(Z|[+-]\d\d:\d\d)$/i)?.[1];
  const { utc, key } = calendar(
    suffix ? value.slice(0, -suffix.length) : value,
  );
  if (suffix) {
    const result = new Date(value.replace(" ", "T"));
    if (!Number.isFinite(+result)) throw Error("Invalid UTC offset.");
    return result;
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = (stamp: number) => {
    const p = Object.fromEntries(
      formatter.formatToParts(stamp).map((p) => [p.type, p.value]),
    );
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  };
  // Sampling both sides of a DST boundary finds both possible offsets. Reject
  // ambiguous or nonexistent wall times rather than quietly moving a trade.
  const offsets = new Set(
    [-36, 0, 36].map((hours) => {
      const stamp = Math.floor((utc + hours * 3600000) / 1000) * 1000;
      return Date.parse(parts(stamp) + "Z") - stamp;
    }),
  );
  const candidates = [...offsets]
    .map((offset) => utc - offset)
    .filter((stamp) => parts(stamp) === key);
  if (candidates.length !== 1)
    throw Error(
      candidates.length
        ? "Ambiguous daylight-saving time; include an explicit UTC offset."
        : "This local time does not exist in the selected timezone.",
    );
  return new Date(candidates[0]);
}
export function tradeIdentity(t: Trade) {
  const raw =
    typeof t.sourceTimestamp === "string"
      ? new Date(t.sourceTimestamp)
      : new Date(t.date);
  const instant = Number.isFinite(+raw)
    ? raw.toISOString()
    : new Date(t.date).toISOString();
  const legacySize = Number.parseFloat(unpackNotes(t.lesson).size);
  return JSON.stringify([
    t.symbol.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    instant,
    t.entry,
    t.volume ?? (Number.isFinite(legacySize) ? legacySize : null),
  ]);
}
function numeric(value: string) {
  const clean = value.replace(/^'(?=[+-]?\d)/, "").trim();
  if (!clean || !/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(clean))
    throw Error(
      "Use plain numeric values without currency signs or separators.",
    );
  const n = Number(clean);
  if (!Number.isFinite(n)) throw Error("Number exceeds the supported range.");
  return n;
}
export function previewCsv(
  rows: string[][],
  map: ColumnMap,
  zone: string,
  order: DateOrder,
  existing: Trade[],
): CsvRow[] {
  // Validate timezone even for files whose dates include offsets.
  new Intl.DateTimeFormat("en", { timeZone: zone }).format();
  const seen = new Set(existing.map(tradeIdentity)),
    sourceIds = new Set(existing.map((t) => t.importSourceId).filter(Boolean));
  return rows.slice(1).map((row, index) => {
    try {
      const get = (field: ImportField) => {
        const col = rows[0].indexOf(map[field]);
        return col < 0 ? "" : row[col].trim();
      };
      if (
        !get("date") ||
        !get("symbol") ||
        !get("entry") ||
        !get("stop") ||
        !get("risk")
      )
        throw Error(
          "Missing date, symbol, entry, original stop or initial cash risk. Order-history rows alone cannot establish a complete trade.",
        );
      if (get("currency") && get("currency").toUpperCase() !== "USD")
        throw Error(
          "Only USD cash results are supported; currency conversion is not inferred.",
        );
      if (!get("reason"))
        throw Error(
          "An entry reason is required; add a reason column before importing.",
        );
      const direction = get("direction").toLowerCase();
      if (!["long", "short", "buy", "sell"].includes(direction))
        throw Error("Direction must be Buy/Long or Sell/Short.");
      const rawStatus =
        get("status").toLowerCase() || (get("closedAt") ? "closed" : "");
      if (!["open", "closed"].includes(rawStatus))
        throw Error("Status must explicitly be open or closed.");
      const instant = csvInstant(get("date"), zone, order),
        date = new Date(+instant - instant.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16),
        sourceId = get("sourceId");
      const trade = validate({
        id: crypto.randomUUID(),
        date,
        symbol: get("symbol").toUpperCase(),
        direction:
          direction === "long" || direction === "buy" ? "Long" : "Short",
        entry: numeric(get("entry")),
        stop: numeric(get("stop")),
        risk: numeric(get("risk")),
        status: rawStatus,
        pnl: rawStatus === "closed" ? numeric(get("pnl")) : null,
        reason: get("reason")
          .replace(/^'(?=[=+@-])/, "")
          .trim(),
        lesson: get("lesson")
          .replace(/^'(?=[=+@-])/, "")
          .trim(),
        setup: get("setup") || "Imported",
        session: get("session") || "Other",
        emotion: get("emotion") || "Calm",
        followed: get("followed") || "unsure",
        ...(get("rating") ? { rating: numeric(get("rating")) } : {}),
        ...(get("followedPlan")
          ? {
              followedPlan:
                get("followedPlan") === "true"
                  ? true
                  : get("followedPlan") === "false"
                    ? false
                    : get("followedPlan"),
            }
          : {}),
        ...(get("journalReview")
          ? { journalReview: JSON.parse(get("journalReview")) }
          : {}),
        ...(get("volume")
          ? {
              volume: numeric(get("volume")),
              volumeUnit: get("volumeUnit") || "lot",
            }
          : {}),
        ...(get("closePrice")
          ? { closePrice: numeric(get("closePrice")) }
          : {}),
        ...(get("closedAt")
          ? { closedAt: csvInstant(get("closedAt"), zone, order).toISOString() }
          : {}),
        sourceTimestamp: instant.toISOString(),
        importTimestamp: new Date().toISOString(),
        ...(sourceId ? { importSourceId: sourceId } : {}),
        importTimezone: zone,
      });
      if (rawStatus === "open" && get("pnl"))
        throw Error("Open trades must not include a realized result.");
      const key = tradeIdentity(trade),
        duplicate = seen.has(key) || (!!sourceId && sourceIds.has(sourceId));
      seen.add(key);
      if (sourceId) sourceIds.add(sourceId);
      return { line: index + 2, trade, duplicate };
    } catch (e) {
      return { line: index + 2, duplicate: false, error: (e as Error).message };
    }
  });
}
export const CSV_TEMPLATE =
  "open time,close time,symbol,type,volume,open price,close price,profit,stop,risk,reason,currency,sourceId\r\n";
