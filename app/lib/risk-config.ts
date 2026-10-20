export const BEHAVIOR_THRESHOLDS = {
  revengeMinutes: 15,
  tiltLosses: 3,
  sizeIncreaseRatio: 1,
} as const;
export interface RiskRules {
  dailyLoss?: number;
  dailyLossMode?: "amount" | "percent";
  referenceBalance?: number;
  maxTrades?: number;
  maxLosses?: number;
}
export function validateRisk(value: RiskRules) {
  if (!value || typeof value !== "object")
    throw Error("Invalid risk settings.");
  for (const key of [
    "dailyLoss",
    "referenceBalance",
    "maxTrades",
    "maxLosses",
  ] as const) {
    const n = value[key];
    if (
      n !== undefined &&
      (!Number.isFinite(n) ||
        n <= 0 ||
        (["maxTrades", "maxLosses"].includes(key) && !Number.isInteger(n)))
    )
      throw Error(
        "Risk limits must be positive; trade and loss counts must be whole numbers.",
      );
  }
  if (
    value.dailyLossMode !== undefined &&
    !["amount", "percent"].includes(value.dailyLossMode)
  )
    throw Error("Invalid loss limit mode.");
  if (
    value.dailyLossMode === "percent" &&
    value.dailyLoss &&
    (!value.referenceBalance || value.dailyLoss > 100)
  )
    throw Error(
      "Percentage loss limits need a reference balance and a percentage up to 100.",
    );
  return value;
}
