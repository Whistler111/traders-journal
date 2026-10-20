import { backup, parseBackup, type Trade } from "./journal";
import { validatePractice, type Practice } from "./practice";
import {
  MAX_IMAGE_BYTES as MAX_BYTES,
  safeScreenshotName,
  validateScreenshot,
  type Screenshot,
  type ScreenshotRef,
} from "./image-model";
export {
  MAX_SCREENSHOTS,
  validateScreenshot,
  validateScreenshotRefs,
} from "./image-model";
export type { Screenshot, ScreenshotRef } from "./image-model";

const DB_NAME = "trade-notes-images-v1";
interface ScreenshotBackend {
  images: (refs: ScreenshotRef[]) => Promise<Screenshot[]>;
  writeImages: (images: Screenshot[]) => Promise<void>;
  deleteImages: (ids: string[]) => Promise<void>;
}
let backend: ScreenshotBackend | null = null;
export function setScreenshotBackend(next: ScreenshotBackend | null) {
  backend = next;
}
interface ImageJournalStore {
  trades: Trade[];
  repo?: ScreenshotBackend;
  save: (trade: Trade, editing: boolean) => Trade[] | Promise<Trade[]>;
  commit: (
    trades: Trade[],
    restore: boolean,
    practice?: Practice,
  ) => Trade[] | Promise<Trade[]>;
}

export function screenshotRefs(trade: Trade): ScreenshotRef[] {
  return Array.isArray(trade.screenshots)
    ? (trade.screenshots as ScreenshotRef[])
    : [];
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        Error(
          "Image storage is unavailable in this browser. Your form has been kept.",
        ),
      );
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("screenshots", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(Error("Could not open image storage. Your form has been kept."));
    request.onblocked = () =>
      reject(
        Error(
          "Image storage is busy in another tab. Close that tab and try again.",
        ),
      );
  });
}
export async function getScreenshots(
  refs: ScreenshotRef[],
): Promise<Screenshot[]> {
  if (backend) return backend.images(refs);
  return getLocalScreenshots(refs);
}
export async function getLocalScreenshots(
  refs: ScreenshotRef[],
): Promise<Screenshot[]> {
  if (!refs.length) return [];
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("screenshots", "readonly"),
        result: Screenshot[] = [];
      let missing = false;
      for (const ref of refs) {
        const request = tx.objectStore("screenshots").get(ref.id);
        request.onsuccess = () => {
          if (!request.result) {
            missing = true;
            return;
          }
          try {
            result.push({
              ...validateScreenshot(request.result),
              name: ref.name,
            });
          } catch {
            tx.abort();
          }
        };
      }
      tx.oncomplete = () =>
        missing
          ? reject(
              Error(
                "A saved screenshot is missing from this browser. Restore a backup containing the images.",
              ),
            )
          : resolve(
              refs.map((ref) => result.find((image) => image.id === ref.id)!),
            );
      tx.onerror = () => reject(Error("Could not read saved screenshots."));
      tx.onabort = () => reject(Error("Could not read saved screenshots."));
    });
  } finally {
    db.close();
  }
}
async function writeLocalScreenshots(images: Screenshot[]) {
  if (!images.length) return;
  images.forEach(validateScreenshot);
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("screenshots", "readwrite");
      // IDs are immutable. Never overwrite images referenced by an existing saved trade.
      for (const image of images) tx.objectStore("screenshots").add(image);
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          Error(
            "Could not save screenshots. Storage may be full. Your form has been kept.",
          ),
        );
      tx.onerror = () =>
        reject(
          Error(
            "Could not save screenshots. Storage may be full. Your form has been kept.",
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function deleteScreenshots(ids: string[]) {
  if (backend) return backend.deleteImages(ids);
  return deleteLocalScreenshots(ids);
}
async function deleteLocalScreenshots(ids: string[]) {
  if (!ids.length) return;
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("screenshots", "readwrite");
      for (const id of ids) tx.objectStore("screenshots").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(Error("Could not remove unused screenshots."));
      tx.onabort = () => reject(Error("Could not remove unused screenshots."));
    });
  } finally {
    db.close();
  }
}
export async function commitWithScreenshots(
  store: ImageJournalStore,
  trade: Trade,
  editing: boolean,
  drafts: Screenshot[],
) {
  const io = store.repo ?? {
    images: getLocalScreenshots,
    writeImages: writeLocalScreenshots,
    deleteImages: deleteLocalScreenshots,
  };
  const refs = screenshotRefs(trade),
    refIds = new Set(refs.map((ref) => ref.id));
  if (drafts.some((image) => !refIds.has(image.id)))
    throw Error("Screenshot does not belong to this trade.");
  const newIds = new Set(drafts.map((image) => image.id));
  const previous = store.trades.find((t) => t.id === trade.id);
  const removed = screenshotRefs(previous ?? trade)
    .filter((ref) => !refIds.has(ref.id))
    .map((ref) => ref.id);
  // Check retained files too. A partial save must not silently drop missing artwork.
  await io.images(refs.filter((ref) => !newIds.has(ref.id)));
  await io.writeImages(drafts);
  try {
    const next = await store.save(trade, editing);
    const retained = new Set(
      next.flatMap(screenshotRefs).map((image) => image.id),
    );
    void io
      .deleteImages(removed.filter((id) => !retained.has(id)))
      .catch(() => {});
    return next;
  } catch (error) {
    if (!store.repo) await io.deleteImages([...newIds]).catch(() => {});
    throw error;
  }
}
export async function exportWithScreenshots(trades: Trade[]) {
  const refs = trades.flatMap(screenshotRefs);
  const images = await getScreenshots(refs);
  return images.length
    ? { ...backup(trades), screenshots: images }
    : backup(trades);
}
export function parseImageBackup(data: unknown) {
  const trades = parseBackup(data),
    raw = (data as { screenshots?: unknown }).screenshots;
  if (raw !== undefined && !Array.isArray(raw))
    throw Error("Invalid backup screenshots.");
  const refs = trades.flatMap(screenshotRefs),
    ids = new Set<string>();
  const images = ((raw ?? []) as unknown[]).map((value) => {
    const image = validateScreenshot(value);
    if (ids.has(image.id))
      throw Error("Backup contains duplicate screenshot IDs.");
    ids.add(image.id);
    return image;
  });
  if (refs.some((ref) => !ids.has(ref.id)))
    throw Error(
      "Backup is missing screenshot files. Your current journal has not been changed.",
    );
  if (images.some((image) => !refs.some((ref) => ref.id === image.id)))
    throw Error("Backup contains screenshots without a trade.");
  const practice = (data as { practice?: unknown }).practice;
  return {
    trades,
    images,
    practice: practice === undefined ? undefined : validatePractice(practice),
  };
}
export async function restoreWithScreenshots(
  store: ImageJournalStore,
  trades: Trade[],
  images: Screenshot[],
  practice?: Practice,
) {
  const io = store.repo ?? {
    images: getLocalScreenshots,
    writeImages: writeLocalScreenshots,
    deleteImages: deleteLocalScreenshots,
  };
  // Stage images with new IDs first so failed restores cannot alter existing files.
  const remap = new Map(images.map((image) => [image.id, crypto.randomUUID()]));
  const staged = images.map((image) => ({
    ...image,
    id: remap.get(image.id)!,
  }));
  const next = trades.map((trade) =>
    screenshotRefs(trade).length
      ? {
          ...trade,
          screenshots: screenshotRefs(trade).map((ref) => ({
            ...ref,
            id: remap.get(ref.id)!,
          })),
        }
      : trade,
  );
  if (next.flatMap(screenshotRefs).some((ref) => !ref.id))
    throw Error("Backup is missing screenshot files.");
  const oldIds = store.trades.flatMap(screenshotRefs).map((ref) => ref.id);
  await io.writeImages(staged);
  try {
    const saved = await store.commit(next, true, practice);
    void io.deleteImages(oldIds).catch(() => {});
    return saved;
  } catch (error) {
    if (!store.repo)
      await io.deleteImages(staged.map((image) => image.id)).catch(() => {});
    throw error;
  }
}
function dataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
}
async function validateImageHeader(file: File) {
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(Error("Could not read this image."));
    reader.readAsArrayBuffer(file.slice(0, 12));
  });
  const prefix = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  const valid =
    file.type === "image/png"
      ? prefix(137, 80, 78, 71, 13, 10, 26, 10)
      : file.type === "image/jpeg"
        ? prefix(255, 216, 255)
        : prefix(82, 73, 70, 70) &&
          bytes[8] === 87 &&
          bytes[9] === 69 &&
          bytes[10] === 66 &&
          bytes[11] === 80;
  if (!valid)
    throw Error("This file does not match its PNG, JPG or WebP image type.");
}
export async function prepareScreenshot(file: File): Promise<Screenshot> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw Error("Choose a PNG, JPG or WebP image.");
  if (file.size > 10 * 1024 * 1024)
    throw Error("Choose an image smaller than 10 MB.");
  await validateImageHeader(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw Error("This file could not be opened as an image.");
    }
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 60_000_000
    )
      throw Error("This image is too large. Choose a smaller screenshot.");
    let blob: Blob = file;
    {
      const scale = Math.min(
          1,
          1600 / image.naturalWidth,
          1600 / image.naturalHeight,
        ),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw Error("Image processing is unavailable.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      formats: for (const format of ["image/webp", "image/jpeg"]) {
        for (const quality of [0.9, 0.8, 0.65, 0.5]) {
          blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (result) =>
                result
                  ? resolve(result)
                  : reject(Error("Could not resize this image.")),
              format,
              quality,
            ),
          );
          if (blob.size <= MAX_BYTES) break formats;
          // Unsupported encoders commonly return PNG. Try JPEG next.
          if (blob.type !== format) break;
        }
      }
      if (blob.size > MAX_BYTES)
        throw Error(
          "This image is too detailed. Crop it or choose a smaller screenshot.",
        );
    }
    return validateScreenshot({
      id: crypto.randomUUID(),
      name: safeScreenshotName(file.name),
      dataUrl: await dataUrl(blob),
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
