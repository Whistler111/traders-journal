import { beforeEach, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  commitWithScreenshots,
  exportWithScreenshots,
  getScreenshots,
  parseImageBackup,
  prepareScreenshot,
  restoreWithScreenshots,
  type Screenshot,
} from "../app/lib/screenshots";
import { validateScreenshot } from "../app/lib/image-model";
import { JournalStore } from "./helpers/legacy-journal-store";
import { KEY, validate, type Trade } from "../app/lib/journal";
const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
const image: Screenshot = { id: "image-a", name: "chart.png", dataUrl: pixel };
const base: Trade = {
  id: "trade-a",
  date: "2026-10-18T14:30",
  symbol: "XAUUSD",
  setup: "Sweep",
  reason: "Confirmation",
  lesson: "Legacy notes",
  direction: "Long",
  session: "London",
  emotion: "Calm",
  status: "closed",
  followed: "yes",
  entry: 2700,
  stop: 2690,
  risk: 25,
  pnl: 50,
};
const ref = { id: image.id, name: image.name };
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
it("persists image files separately and includes them in a lossless version-1 JSON backup", async () => {
  const store = new JournalStore(localStorage);
  store.load();
  await commitWithScreenshots(store, { ...base, screenshots: [ref] }, false, [
    image,
  ]);
  expect(JSON.parse(localStorage.getItem(KEY)!).trades[0].screenshots).toEqual([
    ref,
  ]);
  expect(localStorage.getItem(KEY)).not.toContain("data:image");
  expect(await getScreenshots([ref])).toEqual([image]);
  const exported = await exportWithScreenshots(store.trades);
  expect(exported.version).toBe(1);
  expect(parseImageBackup(JSON.parse(JSON.stringify(exported))).images).toEqual(
    [image],
  );
});
it("restores screenshots with fresh immutable IDs and keeps legacy backups working", async () => {
  const store = new JournalStore(localStorage);
  store.load();
  const imported = parseImageBackup({
    version: 1,
    trades: [{ ...base, screenshots: [ref] }],
    screenshots: [image],
  });
  await restoreWithScreenshots(store, imported.trades, imported.images);
  const restoredRef = store.trades[0].screenshots![0];
  expect(restoredRef.id).not.toBe(ref.id);
  expect((await getScreenshots([restoredRef]))[0].dataUrl).toBe(pixel);
  expect(parseImageBackup({ version: 1, trades: [base] })).toEqual({
    trades: [base],
    images: [],
  });
});
it("rolls back staged images when the trade record cannot be saved", async () => {
  const store = new JournalStore(localStorage);
  store.load();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("Quota exceeded");
  });
  await expect(
    commitWithScreenshots(store, { ...base, screenshots: [ref] }, false, [
      image,
    ]),
  ).rejects.toThrow("Quota exceeded");
  expect(store.trades).toEqual([]);
  expect(localStorage.getItem(KEY)).toBeNull();
  await expect(getScreenshots([ref])).rejects.toThrow(/missing/);
});
it("keeps the old trade and screenshot intact after a failed restore", async () => {
  const store = new JournalStore(localStorage);
  store.load();
  await commitWithScreenshots(store, { ...base, screenshots: [ref] }, false, [
    image,
  ]);
  const before = localStorage.getItem(KEY);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("Quota exceeded");
  });
  await expect(
    restoreWithScreenshots(
      store,
      [{ ...base, pnl: -25, screenshots: [ref] }],
      [image],
    ),
  ).rejects.toThrow("Quota exceeded");
  expect(localStorage.getItem(KEY)).toBe(before);
  expect((await getScreenshots([ref]))[0]).toEqual(image);
});
it("never saves an incomplete backup or a missing screenshot reference", async () => {
  const store = new JournalStore(localStorage);
  store.load();
  expect(() =>
    parseImageBackup({ version: 1, trades: [{ ...base, screenshots: [ref] }] }),
  ).toThrow(/missing/);
  expect(() =>
    parseImageBackup({
      version: 1,
      trades: [{ ...base, screenshots: [ref] }],
      screenshots: [image, image],
    }),
  ).toThrow(/duplicate/);
  expect(() =>
    parseImageBackup({ version: 1, trades: [base], screenshots: [image] }),
  ).toThrow(/without a trade/);
  await expect(
    commitWithScreenshots(store, { ...base, screenshots: [ref] }, false, []),
  ).rejects.toThrow(/missing/);
  expect(localStorage.getItem(KEY)).toBeNull();
});
it("rejects invalid file types, oversized files, invalid image payloads and excessive references", async () => {
  await expect(
    prepareScreenshot(
      new File(["svg"], "chart.svg", { type: "image/svg+xml" }),
    ),
  ).rejects.toThrow(/PNG, JPG or WebP/);
  const large = new File(["png"], "chart.png", { type: "image/png" });
  Object.defineProperty(large, "size", { value: 11 * 1024 * 1024 });
  await expect(prepareScreenshot(large)).rejects.toThrow(/10 MB/);
  expect(() =>
    validateScreenshot({ ...image, dataUrl: "javascript:alert(1)" }),
  ).toThrow();
  expect(() =>
    validate({
      ...base,
      screenshots: Array.from({ length: 4 }, (_, i) => ({
        ...ref,
        id: String(i),
      })),
    }),
  ).toThrow(/3 screenshots/);
});
it("retains existing images on ordinary edits and allows explicit screenshot removal", async () => {
  const store = new JournalStore(localStorage);
  store.load();
  await commitWithScreenshots(store, { ...base, screenshots: [ref] }, false, [
    image,
  ]);
  await commitWithScreenshots(
    store,
    { ...store.trades[0], lesson: "Updated review" },
    true,
    [],
  );
  expect((await getScreenshots([ref]))[0]).toEqual(image);
  expect(store.trades[0].risk).toBe(25);
  await commitWithScreenshots(
    store,
    { ...store.trades[0], screenshots: [] },
    true,
    [],
  );
  expect(store.trades[0].screenshots).toEqual([]);
});
it("does not save a trade if IndexedDB is unavailable", async () => {
  vi.stubGlobal("indexedDB", undefined);
  const store = new JournalStore(localStorage);
  store.load();
  await expect(
    commitWithScreenshots(store, { ...base, screenshots: [ref] }, false, [
      image,
    ]),
  ).rejects.toThrow(/unavailable/);
  expect(localStorage.getItem(KEY)).toBeNull();
});
