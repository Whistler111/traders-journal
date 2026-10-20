import { validateScreenshotRefs, type ScreenshotRef } from "./image-model";
import { validateReview, type TradeReview } from "./practice";
export const KEY = "trade-notes-v1";
export const options = {
  direction: ["Long", "Short"],
  session: ["London", "New York", "Asia", "London / New York overlap", "Other"],
  emotion: [
    "Calm",
    "Confident",
    "Anxious",
    "FOMO",
    "Frustrated",
    "calm",
    "confident",
    "anxious",
    "impatient",
    "revenge",
    "fomo",
  ],
  status: ["open", "closed"],
  followed: ["yes", "no", "unsure"],
} as const;
export interface Trade {
  id: string;
  date: string;
  symbol: string;
  setup: string;
  reason: string;
  lesson: string;
  direction: "Long" | "Short";
  session: (typeof options.session)[number];
  emotion: (typeof options.emotion)[number];
  status: "open" | "closed";
  followed: "yes" | "no" | "unsure";
  entry: number;
  stop: number;
  risk: number;
  pnl: number | null;
  volume?: number;
  volumeUnit?: string;
  closedAt?: string;
  closePrice?: number;
  followedPlan?: boolean;
  rating?: number;
  screenshots?: ScreenshotRef[];
  journalReview?: TradeReview;
  [key: string]: unknown;
}
export function validDate(value: string) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return false;
  const d = new Date(value);
  const parts = value.match(/\d+/g)!.map(Number);
  return (
    Number.isFinite(+d) &&
    d.getFullYear() === parts[0] &&
    d.getMonth() + 1 === parts[1] &&
    d.getDate() === parts[2] &&
    d.getHours() === parts[3] &&
    d.getMinutes() === parts[4]
  );
}
export function validate(value: unknown): Trade {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid trade record.");
  const t = value as Trade;
  for (const [key, max] of Object.entries({
    id: 100,
    date: 30,
    symbol: 30,
    setup: 100,
    reason: 4000,
    lesson: 4000,
  })) {
    if (
      typeof t[key] !== "string" ||
      (t[key] as string).length > max ||
      (key !== "lesson" && !(t[key] as string).trim())
    )
      throw Error(`Please provide a valid ${key}.`);
  }
  if (!validDate(t.date))
    throw Error("Enter a valid local trade date and time.");
  for (const [key, allowed] of Object.entries(options))
    if (!(allowed as readonly unknown[]).includes(t[key]))
      throw Error(`Invalid ${key}.`);
  for (const key of ["entry", "stop", "risk"] as const)
    if (typeof t[key] !== "number" || !Number.isFinite(t[key]) || t[key] <= 0)
      throw Error(
        "Entry, initial stop and initial cash risk must be positive finite numbers.",
      );
  if (
    (t.direction === "Long" && t.stop >= t.entry) ||
    (t.direction === "Short" && t.stop <= t.entry)
  )
    throw Error(
      "Long initial stop must be below entry; short initial stop must be above entry.",
    );
  if (
    t.status === "closed" &&
    (typeof t.pnl !== "number" ||
      !Number.isFinite(t.pnl) ||
      !Number.isFinite(t.pnl / t.risk))
  )
    throw Error(
      "Closed trades require a finite net P&L. Enter 0 for breakeven.",
    );
  if (t.status === "open" && t.pnl !== null)
    throw Error("Open trades cannot include realized P&L.");
  for (const key of ["volume", "closePrice"] as const)
    if (
      t[key] !== undefined &&
      (typeof t[key] !== "number" || !Number.isFinite(t[key]) || t[key]! <= 0)
    )
      throw Error(`Invalid ${key}.`);
  if (
    t.volumeUnit !== undefined &&
    (typeof t.volumeUnit !== "string" || t.volumeUnit.length > 40)
  )
    throw Error("Invalid volume unit.");
  if (
    t.closedAt !== undefined &&
    (typeof t.closedAt !== "string" ||
      t.closedAt.length > 40 ||
      !Number.isFinite(+new Date(t.closedAt)) ||
      +new Date(t.closedAt) <
        +new Date(
          typeof t.sourceTimestamp === "string" ? t.sourceTimestamp : t.date,
        ))
  )
    throw Error("Close time must follow open time.");
  if (t.followedPlan !== undefined && typeof t.followedPlan !== "boolean")
    throw Error("Invalid plan adherence.");
  if (
    t.rating !== undefined &&
    (!Number.isInteger(t.rating) || t.rating < 1 || t.rating > 5)
  )
    throw Error("Rating must be 1-5.");
  if (t.screenshots !== undefined) validateScreenshotRefs(t.screenshots);
  if (t.journalReview !== undefined) validateReview(t.journalReview);
  return t;
}
export function outcome(t: Trade) {
  return t.status === "open"
    ? "open"
    : t.pnl! > 0
      ? "win"
      : t.pnl! < 0
        ? "loss"
        : "breakeven";
}
function sum(values: number[]) {
  let total = 0,
    correction = 0;
  for (const value of values) {
    const next = total + value;
    correction +=
      Math.abs(total) >= Math.abs(value)
        ? total - next + value
        : value - next + total;
    total = next;
  }
  const result = total + correction;
  return Number.isFinite(result) ? result : null;
}
export function stats(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "closed"),
    n = closed.length;
  const total = sum(closed.map((t) => t.pnl! / t.risk));
  return {
    closed,
    n,
    cash: sum(closed.map((t) => t.pnl!)),
    total,
    avg: n && total !== null ? total / n : null,
    win: n ? closed.filter((t) => t.pnl! > 0).length / n : null,
    adherence: n ? closed.filter((t) => t.followed === "yes").length / n : null,
  };
}
export function cumulativeRealized(trades: Trade[]) {
  const ordered = trades
    .filter((t) => t.status === "closed")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let total = 0,
    correction = 0;
  const values = [0];
  for (const trade of ordered) {
    const value = trade.pnl!,
      next = total + value;
    correction +=
      Math.abs(total) >= Math.abs(value)
        ? total - next + value
        : value - next + total;
    total = next;
    const result = total + correction;
    if (!Number.isFinite(result)) return null;
    values.push(result);
  }
  return values;
}
export function parseBackup(data: unknown): Trade[] {
  if (
    !data ||
    typeof data !== "object" ||
    !("version" in data) ||
    data.version !== 1 ||
    !("trades" in data) ||
    !Array.isArray(data.trades) ||
    data.trades.length > 100000
  )
    throw Error("Choose a valid Trade Notes version-1 backup.");
  const ids = new Set<string>();
  const imageIds = new Set<string>();
  return data.trades.map((value) => {
    const t = validate(value);
    if (ids.has(t.id)) throw Error("Backup contains duplicate trade IDs.");
    ids.add(t.id);
    for (const image of t.screenshots ?? []) {
      if (imageIds.has(image.id))
        throw Error("Screenshot IDs must be unique to each trade.");
      imageIds.add(image.id);
    }
    return t;
  });
}
export const backup = (trades: Trade[]) => ({
  version: 1,
  exportedAt: new Date().toISOString(),
  trades,
});
export function weekCount(trades: Trade[], now = new Date()) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const next = new Date(monday);
  next.setDate(next.getDate() + 7);
  return trades.filter(
    (t) => new Date(t.date) >= monday && new Date(t.date) < next,
  ).length;
}
const start = "[Trade details]\n",
  end = "\n[/Trade details]\n\n";
export function packNotes(notes: string, exit: string, size: string) {
  const details: string[] = [];
  if (exit.trim()) details.push("Exit price: " + exit.trim());
  if (size.trim())
    details.push("Position size: " + size.trim().replace(/[\r\n]/g, " "));
  return details.length
    ? start + details.join("\n") + end + notes.trim()
    : notes.trim();
}
export function unpackNotes(notes: string) {
  const result = { notes, exit: "", size: "" };
  if (!notes.startsWith(start) || !notes.includes(end)) return result;
  const offset = notes.indexOf(end),
    lines = notes.slice(start.length, offset).split("\n");
  if (!lines.every((line) => /^(Exit price|Position size): .+/.test(line)))
    return result;
  for (const line of lines) {
    if (line.startsWith("Exit price: ")) result.exit = line.slice(12);
    if (line.startsWith("Position size: ")) result.size = line.slice(15);
  }
  result.notes = notes.slice(offset + end.length);
  return result;
}
export function planStreak(trades: Trade[]) {
  const closed = trades
    .filter((t) => t.status === "closed")
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  let n = 0;
  for (const t of closed) {
    if (t.followed !== "yes") break;
    n++;
  }
  return n;
}
export type Milestone = "ten" | "plan";
export function milestones(
  before: Trade[],
  after: Trade[],
  seen: Set<Milestone>,
): Milestone[] {
  const result: Milestone[] = [];
  if (!seen.has("ten") && before.length < 10 && after.length >= 10)
    result.push("ten");
  if (!seen.has("plan") && planStreak(before) < 5 && planStreak(after) >= 5)
    result.push("plan");
  return result;
}
export function filterTrades(trades: Trade[], query: string, filter: string) {
  return trades
    .filter(
      (t) =>
        (filter === "all" || outcome(t) === filter) &&
        [
          t.symbol,
          t.setup,
          t.reason,
          t.lesson,
          t.emotion,
          t.journalReview?.playbookName ?? "",
          ...(t.journalReview?.mistakes ?? []),
        ].some((v) => v.toLowerCase().includes(query.trim().toLowerCase())),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function csv(trades: Trade[]) {
  const keys = [
    "date",
    "symbol",
    "direction",
    "setup",
    "session",
    "entry",
    "stop",
    "risk",
    "status",
    "pnl",
    "resultR",
    "followed",
    "emotion",
    "reason",
    "lesson",
    "closedAt",
    "closePrice",
    "volume",
    "volumeUnit",
    "followedPlan",
    "rating",
    "journalReview",
  ];
  const cell = (v: unknown) => {
    let text = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      keys.join(","),
      ...trades.map((t) =>
        keys
          .map((k) =>
            cell(
              k === "resultR"
                ? t.status === "closed"
                  ? t.pnl! / t.risk
                  : ""
                : k === "date"
                  ? t.sourceTimestamp || t.date
                  : k === "journalReview"
                    ? t.journalReview
                      ? JSON.stringify(t.journalReview)
                      : ""
                    : t[k],
            ),
          )
          .join(","),
      ),
    ].join("\r\n")
  );
}
export const money = (v: number | null) =>
  v === null
    ? "Unavailable"
    : (Math.abs(v) < 0.005 ? 0 : v).toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
      });
export const rFormat = (v: number | null) =>
  v === null ? "—" : `${(Math.abs(v) < 0.005 ? 0 : v).toFixed(2)} R`;
export const percent = (v: number | null) =>
  v === null ? "—" : `${(v * 100).toFixed(2)}%`;
export const tone = (v: number | null) =>
  v && v > 0 ? "positive" : v && v < 0 ? "negative" : "";
