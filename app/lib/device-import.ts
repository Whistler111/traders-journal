import { KEY, parseBackup, type Trade } from "./journal";
import { emptyPractice, validatePractice, type Practice } from "./practice";
import { getLocalScreenshots, screenshotRefs } from "./screenshots";
import type { CloudJournalStore } from "./trades-repo";
export interface DeviceSource {
  storage: Storage;
  raw: string;
}
export function deviceSources() {
  return [localStorage, sessionStorage].flatMap((storage) => {
    const raw = storage.getItem(KEY);
    return raw === null ? [] : [{ storage, raw }];
  });
}
function mergeById<T>(
  cloud: T[],
  incoming: T[],
  id: (value: T) => string,
): T[] {
  const merged = new Map(cloud.map((value) => [id(value), value]));
  for (const value of incoming) {
    const previous = merged.get(id(value));
    if (previous && comparable(previous) !== comparable(value))
      throw Error(
        "Device and cloud records have a conflicting ID. Download a device backup and resolve the conflict before importing. Neither copy was changed.",
      );
    merged.set(id(value), value);
  }
  return [...merged.values()];
}
function comparable(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === "object" && !Array.isArray(item))
      return Object.fromEntries(
        Object.keys(item)
          .sort()
          .map((key) => [key, item[key]]),
      );
    return item;
  });
}
export async function importDevice(
  store: CloudJournalStore,
  sources: DeviceSource[],
) {
  // Explicit device import needs all IDs to detect conflicts beyond the active range.
  const priorRevision = store.revision;
  await store.load();
  if (store.revision !== priorRevision) {
    store.failed = true;
    throw Error(
      "Your journal changed on another device. Reload before importing.",
    );
  }
  let trades: Trade[] = [],
    practice: Practice = emptyPractice();
  for (const { raw } of sources) {
    const parsed = JSON.parse(raw);
    trades = mergeById(trades, parseBackup(parsed), (t) => t.id);
    const next = validatePractice(parsed.practice ?? emptyPractice());
    practice = {
      playbooks: mergeById(practice.playbooks, next.playbooks, (p) => p.id),
      reflections: mergeById(
        practice.reflections,
        next.reflections,
        (r) => r.date,
      ),
    };
  }
  const bytes = new TextEncoder().encode(sources.map((s) => s.raw).join("\n"));
  const fingerprint = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  if (await store.repo.hasImport(fingerprint)) {
    await store.load();
    for (const { storage, raw } of sources)
      if (storage.getItem(KEY) === raw) storage.removeItem(KEY);
    return 0;
  }
  const nextTrades = mergeById(store.trades, trades, (t) => t.id);
  const nextPractice = {
    ...store.practice,
    playbooks: mergeById(
      store.practice.playbooks,
      practice.playbooks,
      (p) => p.id,
    ),
    reflections: mergeById(
      store.practice.reflections,
      practice.reflections,
      (r) => r.date,
    ),
  };
  const images = await getLocalScreenshots(trades.flatMap(screenshotRefs));
  await store.repo.writeImages(images);
  await store.commit(nextTrades, false, nextPractice, fingerprint);
  // Never remove a newer device write or clear anything before server acknowledgement.
  for (const { storage, raw } of sources)
    if (storage.getItem(KEY) === raw) storage.removeItem(KEY);
  return trades.length;
}
