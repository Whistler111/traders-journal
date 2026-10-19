import { beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { cloud, seedTrades, storedTrades } from "./cloud-fixture";
import { CloudJournalStore, TradesRepo, safeId } from "../app/lib/trades-repo";
import { deviceSources, importDevice } from "../app/lib/device-import";
import { KEY, type Trade } from "../app/lib/journal";
import { emptyPractice } from "../app/lib/practice";
vi.mock(
  "firebase/firestore",
  async () => (await import("./cloud-fixture")).firestoreMock,
);
vi.mock(
  "../app/lib/firebase",
  async () => (await import("./cloud-fixture")).firebaseMock,
);
const trade: Trade = {
  id: "fictional-1",
  date: "2026-10-18T14:30",
  symbol: "XAUUSD",
  setup: "Test",
  reason: "Fictional confirmation",
  lesson: "",
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
beforeEach(() => {
  cloud.documents.clear();
  cloud.uid = "fictional-owner";
  cloud.failure = "";
});
it("isolates account paths and preserves server creation timestamps on update", async () => {
  const store = new CloudJournalStore(new TradesRepo(cloud.uid));
  await store.load();
  await store.save(trade, false);
  expect(
    cloud.documents.get(`users/${cloud.uid}/trades/${trade.id}`),
  ).toMatchObject({
    createdAt: "fictional-server-timestamp",
    updatedAt: "fictional-server-timestamp",
  });
  await store.save({ ...trade, pnl: 0 }, true);
  expect(storedTrades()[0].pnl).toBe(0);
  expect(localStorage.getItem(KEY)).toBeNull();
  cloud.uid = "another-owner";
  const other = new CloudJournalStore(new TradesRepo(cloud.uid));
  expect(await other.load()).toEqual([]);
  await expect(store.save(trade, true)).rejects.toThrow("account changed");
});
it("rejects stale-device writes and oversized imports without changing data", async () => {
  seedTrades([trade]);
  const a = new CloudJournalStore(new TradesRepo(cloud.uid)),
    b = new CloudJournalStore(new TradesRepo(cloud.uid));
  await a.load();
  await b.load();
  await a.save({ ...trade, pnl: 25 }, true);
  await expect(b.save({ ...trade, pnl: -25 }, true)).rejects.toThrow(
    "changed on another device",
  );
  expect(storedTrades()[0].pnl).toBe(25);
  await expect(
    a.commit(
      Array.from({ length: 401 }, (_, i) => ({ ...trade, id: `f-${i}` })),
    ),
  ).rejects.toThrow("too large");
  expect(storedTrades()).toHaveLength(1);
});
it("imports local and session records explicitly, marks once, and only clears after success", async () => {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, trades: [trade] }));
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ version: 1, trades: [{ ...trade, id: "fictional-2" }] }),
  );
  const sources = deviceSources(),
    store = new CloudJournalStore(new TradesRepo(cloud.uid));
  await store.load();
  expect(store.trades).toEqual([]);
  cloud.failure = "Fictional network failure";
  await expect(importDevice(store, sources)).rejects.toThrow("network failure");
  expect(deviceSources()).toHaveLength(2);
  expect(storedTrades()).toEqual([]);
  cloud.failure = "";
  expect(await importDevice(store, sources)).toBe(2);
  expect(deviceSources()).toEqual([]);
  expect(storedTrades()).toHaveLength(2);
  await store.save({ ...trade, pnl: 75 }, true);
  localStorage.setItem(KEY, sources[0].raw);
  sessionStorage.setItem(KEY, sources[1].raw);
  expect(await importDevice(store, deviceSources())).toBe(0);
  expect(storedTrades().find((t) => t.id === trade.id)?.pnl).toBe(75);
});
it("keeps device data when IDs conflict or records are malformed", async () => {
  seedTrades([trade]);
  const store = new CloudJournalStore(new TradesRepo(cloud.uid));
  await store.load();
  localStorage.setItem(
    KEY,
    JSON.stringify({ version: 1, trades: [{ ...trade, pnl: 999 }] }),
  );
  await expect(importDevice(store, deviceSources())).rejects.toThrow(
    "conflicting ID",
  );
  expect(localStorage.getItem(KEY)).not.toBeNull();
  expect(storedTrades()[0].pnl).toBe(50);
  localStorage.setItem(KEY, "broken");
  await expect(importDevice(store, deviceSources())).rejects.toThrow();
  expect(localStorage.getItem(KEY)).toBe("broken");
  expect(store.practice).toEqual(emptyPractice());
});
it("recognizes identical device records even when Firestore field order differs", async () => {
  seedTrades([Object.fromEntries(Object.entries(trade).reverse()) as Trade]);
  const store = new CloudJournalStore(new TradesRepo(cloud.uid));
  await store.load();
  localStorage.setItem(KEY, JSON.stringify({ version: 1, trades: [trade] }));
  await importDevice(store, deviceSources());
  expect(storedTrades()).toHaveLength(1);
  expect(localStorage.getItem(KEY)).toBeNull();
});
it("keeps owner-only rules and rejects IDs that could escape a document path", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  expect(rules).toContain("request.auth != null && request.auth.uid == uid");
  expect(rules).not.toContain("allow read, write: if true");
  expect(() => safeId("../other")).toThrow();
});
