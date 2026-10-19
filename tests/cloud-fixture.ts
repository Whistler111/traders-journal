import { vi } from "vitest";
import type { Trade } from "../app/lib/journal";
type Fields = Record<string, unknown>;
export const cloud = {
  documents: new Map<string, Fields>(),
  uid: "fictional-owner",
  failure: "",
};
const snapshot = (path: string) => ({
  id: path.split("/").at(-1),
  exists: () => cloud.documents.has(path),
  data: () => cloud.documents.get(path),
});
export function seedTrades(trades: Trade[]) {
  for (const trade of trades)
    cloud.documents.set(
      `users/${cloud.uid}/trades/${trade.id}`,
      structuredClone(trade),
    );
}
export function storedTrades() {
  return [...cloud.documents.entries()]
    .filter(([path]) => path.startsWith(`users/${cloud.uid}/trades/`))
    .map(([, value]) => value);
}
export const firestoreMock = {
  doc: (_db: unknown, ...parts: string[]) => parts.join("/"),
  collection: (_db: unknown, ...parts: string[]) => parts.join("/"),
  getDocFromServer: async (path: string) => snapshot(path),
  getDocsFromServer: async (path: string) => ({
    docs: [...cloud.documents.keys()]
      .filter(
        (key) =>
          key.startsWith(path + "/") &&
          key.slice(path.length + 1).indexOf("/") === -1,
      )
      .map(snapshot),
  }),
  serverTimestamp: () => "fictional-server-timestamp",
  deleteDoc: async (path: string) => {
    cloud.documents.delete(path);
  },
  onSnapshot: () => () => {},
  runTransaction: async (
    _db: unknown,
    work: (tx: unknown) => Promise<unknown>,
  ) => {
    if (cloud.failure) throw Error(cloud.failure);
    const writes: Array<() => void> = [];
    const result = await work({
      get: async (path: string) => snapshot(path),
      set: (path: string, value: Fields, options?: { merge: boolean }) =>
        writes.push(() =>
          cloud.documents.set(path, {
            ...(options?.merge ? cloud.documents.get(path) : {}),
            ...structuredClone(value),
          }),
        ),
      delete: (path: string) =>
        writes.push(() => {
          cloud.documents.delete(path);
        }),
    });
    writes.forEach((write) => write());
    return result;
  },
};
export const firebaseMock = {
  firebaseClient: () => ({ db: {}, auth: { currentUser: { uid: cloud.uid } } }),
};
export const authMock = {
  useAuth: () => ({
    user: { uid: cloud.uid, email: "fictional@example.invalid" },
    signOut: vi.fn(),
  }),
};
