const KEY = "trade-notes-clipboard-seen-v1";
const supported = ["image/png", "image/webp", "image/jpeg"];
export async function imageFingerprint(blob: Blob) {
  const bytes = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return `${blob.type}:${blob.size}:${hash.toString(16)}`;
}
export function pastedImages(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.items)
    .filter((item) => item.kind === "file" && supported.includes(item.type))
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file);
}
export class ClipboardSession {
  private seen = new Set<string>();
  constructor(private storage?: Pick<Storage, "getItem" | "setItem">) {
    try {
      const values: unknown = JSON.parse(storage?.getItem(KEY) ?? "[]");
      if (Array.isArray(values))
        for (const value of values)
          if (typeof value === "string") this.seen.add(value);
    } catch {
      /* Session dedupe remains available in memory when storage is blocked. */
    }
  }
  claim(hash: string) {
    if (this.seen.has(hash)) return false;
    this.seen.add(hash);
    try {
      this.storage?.setItem(KEY, JSON.stringify([...this.seen]));
    } catch {
      /* Clipboard content is never stored here, only fingerprints. */
    }
    return true;
  }
}
export async function readClipboardImage(): Promise<File | null> {
  if (!globalThis.isSecureContext || !navigator.clipboard?.read) return null;
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = supported.find((type) => item.types.includes(type));
    if (type) {
      const blob = await item.getType(type);
      return new File(
        [blob],
        `clipboard.${type === "image/jpeg" ? "jpg" : type.split("/")[1]}`,
        { type },
      );
    }
  }
  return null;
}
