export type Period = "Today" | "7D" | "30D" | "This month" | "Custom";
export interface ViewFilters {
  from: string;
  to: string;
  pair: string;
  setup: string;
  period: Period;
}
export const localDay = (d: Date) =>
  new Date(+d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export function periodRange(period: Period, now = new Date()) {
  const from = new Date(now);
  if (period === "7D") from.setDate(from.getDate() - 6);
  if (period === "30D") from.setDate(from.getDate() - 29);
  if (period === "This month") from.setDate(1);
  return { from: localDay(from), to: localDay(now) };
}
export function previousRange(range: { from: string; to: string }) {
  const start = new Date(range.from + "T00:00:00Z"),
    end = new Date(range.to + "T00:00:00Z");
  const days = Math.round((+end - +start) / 86400000) + 1;
  return {
    from: new Date(+start - days * 86400000).toISOString().slice(0, 10),
    to: new Date(+start - 86400000).toISOString().slice(0, 10),
  };
}
export const comparisonWindow = (range: { from: string; to: string }) => ({
  from: previousRange(range).from,
  to: range.to,
});
export function initialFilters(
  search: string,
  saved: string | null,
): ViewFilters {
  const fallback = {
    ...periodRange("30D"),
    pair: "",
    setup: "",
    period: "30D" as Period,
  };
  try {
    const params = new URLSearchParams(search),
      cached = saved ? JSON.parse(saved) : {},
      value = { ...fallback, ...cached };
    for (const key of ["from", "to", "pair", "setup", "period"] as const)
      if (params.has(key)) value[key] = params.get(key);
    if (!["Today", "7D", "30D", "This month", "Custom"].includes(value.period))
      return fallback;
    for (const key of ["from", "to"])
      if (
        !/^\d{4}-\d\d-\d\d$/.test(value[key]) ||
        new Date(value[key] + "T00:00Z").toISOString().slice(0, 10) !==
          value[key]
      )
        return fallback;
    if (
      value.from > value.to ||
      typeof value.pair !== "string" ||
      typeof value.setup !== "string" ||
      value.pair.length > 30 ||
      value.setup.length > 100
    )
      return fallback;
    return value;
  } catch {
    return fallback;
  }
}
