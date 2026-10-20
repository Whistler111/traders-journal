import { unpackNotes, type Trade } from "./journal";
import { timeParts, tradeInstant } from "./analytics";
import { BEHAVIOR_THRESHOLDS as config, type RiskRules } from "./risk-config";
const unit = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^(lots|shares|units)$/, (s) => s.slice(0, -1));
export function position(t: Trade) {
  if (t.volume) return { amount: t.volume, unit: unit(t.volumeUnit || "lot") };
  const match = unpackNotes(t.lesson).size.match(
    /^\s*(\d+(?:\.\d*)?|\.\d+)\s+(.+)$/,
  );
  return match ? { amount: Number(match[1]), unit: unit(match[2]) } : null;
}
function bigger(t: Trade, previous: Trade) {
  const a = position(t),
    b = position(previous);
  return !!(
    a &&
    b &&
    t.symbol.toUpperCase() === previous.symbol.toUpperCase() &&
    a.unit === b.unit &&
    a.amount > b.amount * config.sizeIncreaseRatio
  );
}
export function behaviorFlags(trades: Trade[], rules: RiskRules, zone: string) {
  const result = new Map<string, string[]>(),
    counts = new Map<string, number>();
  const ordered = [...trades].sort(
    (a, b) => +tradeInstant(a) - +tradeInstant(b) || a.id.localeCompare(b.id),
  );
  const closures = trades
    .filter((t) => t.status === "closed" && t.closedAt)
    .sort(
      (a, b) =>
        a.closedAt!.localeCompare(b.closedAt!) || a.id.localeCompare(b.id),
    );
  let cursor = 0;
  const realized: Trade[] = [];
  for (const t of ordered) {
    const flags: string[] = [],
      day = timeParts(t, zone).day;
    const count = (counts.get(day) ?? 0) + 1;
    counts.set(day, count);
    if (rules.maxTrades && count > rules.maxTrades) flags.push("Overtrading");
    // A loss must have been realized before this entry. Unknown legacy close times are not guessed.
    while (
      cursor < closures.length &&
      +new Date(closures[cursor].closedAt!) <= +tradeInstant(t)
    )
      realized.push(closures[cursor++]);
    const prior = realized
      .slice(-config.tiltLosses - 1)
      .reverse()
      .filter((p) => p.id !== t.id);
    const last = prior[0];
    if (
      last &&
      last.pnl! < 0 &&
      (+tradeInstant(t) - +new Date(last.closedAt!)) / 60000 <=
        config.revengeMinutes &&
      bigger(t, last)
    )
      flags.push("Revenge trade");
    if (
      prior.length >= config.tiltLosses &&
      prior.slice(0, config.tiltLosses).every((p) => p.pnl! < 0) &&
      bigger(t, prior[0])
    )
      flags.push("Tilt streak");
    result.set(t.id, flags);
  }
  return result;
}
export function riskWarnings(
  trades: Trade[],
  rules: RiskRules,
  zone: string,
  now = new Date(),
) {
  const day = timeParts({ date: now.toISOString() } as Trade, zone).day;
  const today = trades.filter((t) => timeParts(t, zone).day === day);
  const closed = trades.filter(
    (t) =>
      t.status === "closed" &&
      timeParts(
        { ...t, sourceTimestamp: t.closedAt || t.sourceTimestamp },
        zone,
      ).day === day,
  );
  const net = closed.reduce((s, t) => s + t.pnl!, 0),
    warnings: string[] = [];
  const limit =
    rules.dailyLossMode === "percent"
      ? (rules.dailyLoss! * (rules.referenceBalance ?? 0)) / 100
      : rules.dailyLoss;
  if (limit && net <= -limit)
    warnings.push(
      "Daily loss limit reached. Take a moment to review before the next decision.",
    );
  if (rules.maxTrades && today.length >= rules.maxTrades)
    warnings.push("Daily trade limit reached. Your journal remains available.");
  let streak = 0;
  for (const t of trades
    .filter((t) => t.status === "closed")
    .sort((a, b) =>
      (b.closedAt || b.date).localeCompare(a.closedAt || a.date),
    )) {
    if (t.pnl! >= 0) break;
    streak++;
  }
  if (rules.maxLosses && streak >= rules.maxLosses)
    warnings.push(
      "Consecutive loss limit reached. A pause may help you reset.",
    );
  return warnings;
}
