/** Only small, self-contained vector compositions are accepted. Artwork is optional. */
export function validAnimation(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const root = data as Record<string, unknown>;
  if (
    !Array.isArray(root.layers) ||
    typeof root.fr !== "number" ||
    !Number.isFinite(root.fr) ||
    root.fr <= 0 ||
    typeof root.op !== "number" ||
    !Number.isFinite(root.op) ||
    root.op <= 0 ||
    root.fonts
  )
    return false;
  function safe(value: unknown): boolean {
    if (!value || typeof value !== "object") return true;
    if (Array.isArray(value)) return value.every(safe);
    const object = value as Record<string, unknown>;
    if (
      typeof object.x === "string" ||
      typeof object.p === "string" ||
      object.u ||
      object.fPath
    )
      return false;
    return Object.values(object).every(safe);
  }
  return safe(root);
}
