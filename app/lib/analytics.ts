import type { Trade } from "./journal";

export function metrics(trades: Trade[]) {
  const closed = trades
    .filter((t) => t.status === "closed")
    .sort(
      (a, b) =>
        +new Date(a.closedAt || tradeInstant(a)) -
          +new Date(b.closedAt || tradeInstant(b)) || a.id.localeCompare(b.id),
    );
  const wins = closed.filter((t) => t.pnl! > 0),
    losses = closed.filter((t) => t.pnl! < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl!, 0),
    grossLoss = -losses.reduce((s, t) => s + t.pnl!, 0);
  const net = grossWin - grossLoss;
  let equity = 0,
    peak = 0,
    drawdown = 0,
    w = 0,
    l = 0,
    winStreak = 0,
    lossStreak = 0;
  for (const t of closed) {
    equity += t.pnl!;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, peak - equity);
    w = t.pnl! > 0 ? w + 1 : 0;
    l = t.pnl! < 0 ? l + 1 : 0;
    winStreak = Math.max(winStreak, w);
    lossStreak = Math.max(lossStreak, l);
  }
  const completed = trades.filter(
    (t) =>
      t.journalReview?.rules.length &&
      t.journalReview.rules.every((r) => r.checked),
  ).length;
  return {
    count: closed.length,
    net,
    winRate: closed.length ? wins.length / closed.length : null,
    profitFactor: grossLoss ? grossWin / grossLoss : null,
    noLosses: !grossLoss && grossWin > 0,
    averageR: closed.length
      ? closed.reduce((s, t) => s + t.pnl! / t.risk, 0) / closed.length
      : null,
    expectancy: closed.length ? net / closed.length : null,
    averageWin: wins.length ? grossWin / wins.length : null,
    averageLoss: losses.length ? -grossLoss / losses.length : null,
    largestWin: wins.length ? Math.max(...wins.map((t) => t.pnl!)) : null,
    largestLoss: losses.length ? Math.min(...losses.map((t) => t.pnl!)) : null,
    drawdown,
    winStreak,
    lossStreak,
    discipline: trades.length ? completed / trades.length : null,
  };
}
export function groupedMetrics(trades: Trade[], key: (t: Trade) => string) {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const label = key(t);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(t);
  }
  return [...groups]
    .map(([label, rows]) => ({ label, ...metrics(rows) }))
    .sort((a, b) => b.net - a.net || a.label.localeCompare(b.label));
}

export function tradeInstant(t: Trade) {
  const source =
    typeof t.sourceTimestamp === "string" ? new Date(t.sourceTimestamp) : null;
  return source && Number.isFinite(+source) ? source : new Date(t.date);
}
export function timeParts(t: Trade, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  }).formatToParts(tradeInstant(t));
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    weekday: get("weekday"),
  };
}
export function sessionAt(hour: number) {
  return hour < 8
    ? "Asia"
    : hour < 13
      ? "London"
      : hour < 22
        ? "New York"
        : "Outside sessions";
}
export function holdGroup(t: Trade) {
  if (t.status !== "closed" || typeof t.closedAt !== "string")
    return "Unknown / open";
  const minutes = (+new Date(t.closedAt) - +tradeInstant(t)) / 60000;
  return minutes < 60
    ? "Under 1 hour"
    : minutes < 240
      ? "1-4 hours"
      : minutes < 1440
        ? "4-24 hours"
        : "1+ days";
}
