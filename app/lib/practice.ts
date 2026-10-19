export interface Playbook {
  id: string;
  name: string;
  description: string;
  rules: string[];
  archived?: boolean;
}
export interface DailyReflection {
  date: string;
  plan: string;
  worked: string;
  improve: string;
}
export interface Practice {
  playbooks: Playbook[];
  reflections: DailyReflection[];
}
export interface TradeReview {
  playbookId: string;
  playbookName: string;
  rules: { label: string; checked: boolean }[];
  mistakes: string[];
}
export const emptyPractice = (): Practice => ({
  playbooks: [],
  reflections: [],
});
export const emptyReview = (): TradeReview => ({
  playbookId: "",
  playbookName: "",
  rules: [],
  mistakes: [],
});
function text(
  value: unknown,
  max: number,
  required = false,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw Error("Invalid review text.");
}
function unique(values: string[]) {
  if (new Set(values).size !== values.length)
    throw Error("Duplicate review identifiers.");
}
export function validateReview(value: unknown): TradeReview {
  if (!value || typeof value !== "object") throw Error("Invalid trade review.");
  const review = value as TradeReview;
  text(review.playbookId, 100);
  text(review.playbookName, 100);
  if (
    !Array.isArray(review.rules) ||
    review.rules.length > 20 ||
    !Array.isArray(review.mistakes) ||
    review.mistakes.length > 12
  )
    throw Error("Invalid trade checklist or mistake tags.");
  for (const rule of review.rules) {
    if (!rule || typeof rule.checked !== "boolean")
      throw Error("Invalid checklist item.");
    text(rule.label, 200, true);
  }
  for (const tag of review.mistakes) text(tag, 40, true);
  unique(review.mistakes.map((tag) => tag.toLowerCase()));
  return review;
}
export function validatePractice(value: unknown): Practice {
  if (!value || typeof value !== "object")
    throw Error("Invalid playbooks or reflections.");
  const data = value as Practice;
  if (
    !Array.isArray(data.playbooks) ||
    data.playbooks.length > 200 ||
    !Array.isArray(data.reflections) ||
    data.reflections.length > 10000
  )
    throw Error("Invalid review collection.");
  for (const p of data.playbooks) {
    if (!p || typeof p !== "object") throw Error("Invalid playbook.");
    text(p.id, 100, true);
    text(p.name, 100, true);
    text(p.description, 2000);
    if (!Array.isArray(p.rules) || p.rules.length > 20)
      throw Error("Use at most 20 playbook rules.");
    for (const rule of p.rules) text(rule, 200, true);
    if (p.archived !== undefined && typeof p.archived !== "boolean")
      throw Error("Invalid archived playbook.");
  }
  for (const r of data.reflections) {
    if (!r || typeof r !== "object") throw Error("Invalid reflection.");
    text(r.date, 10, true);
    if (
      !/^\d{4}-\d\d-\d\d$/.test(r.date) ||
      new Date(r.date + "T12:00:00Z").toISOString().slice(0, 10) !== r.date
    )
      throw Error("Invalid reflection date.");
    for (const k of ["plan", "worked", "improve"] as const) text(r[k], 4000);
  }
  unique(data.playbooks.map((p) => p.id));
  unique(data.reflections.map((r) => r.date));
  return data;
}
export function tagsFromText(value: string) {
  return [
    ...new Map(
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => [s.toLowerCase(), s]),
    ).values(),
  ];
}
