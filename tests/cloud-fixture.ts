import { vi } from "vitest";
import type { Trade } from "../app/lib/journal";
type Fields = Record<string, unknown>;
export const cloud = {
  documents: new Map<string, Fields>(),
  uid: "fictional-owner",
  failure: "",
  verified: true,
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
  query: (
    path: string,
    ...constraints: {
      kind: string;
      field?: string;
      op?: string;
      value?: unknown;
    }[]
  ) => ({ path, constraints }),
  where: (field: string, op: string, value: unknown) => ({
    kind: "where",
    field,
    op,
    value,
  }),
  orderBy: (field: string) => ({ kind: "order", field }),
  limit: (value: number) => ({ kind: "limit", value }),
  startAfter: (value: { id: string }) => ({ kind: "after", value }),
  doc: (_db: unknown, ...parts: string[]) => parts.join("/"),
  collection: (_db: unknown, ...parts: string[]) => parts.join("/"),
  getDocFromServer: async (path: string) => snapshot(path),
  getDocsFromServer: async (
    request:
      | string
      | {
          path: string;
          constraints: {
            kind: string;
            field?: string;
            op?: string;
            value?: unknown;
          }[];
        },
  ) => {
    const path = typeof request === "string" ? request : request.path;
    let docs = [...cloud.documents.keys()]
      .filter(
        (key) =>
          key.startsWith(path + "/") &&
          !key.slice(path.length + 1).includes("/"),
      )
      .map(snapshot)
      .sort(
        (a, b) =>
          String(a.data()?.date).localeCompare(String(b.data()?.date)) ||
          String(a.id).localeCompare(String(b.id)),
      );
    if (typeof request !== "string")
      for (const c of request.constraints) {
        if (c.kind === "where")
          docs = docs.filter((d) =>
            c.op === ">="
              ? String(d.data()?.[c.field!]) >= String(c.value)
              : String(d.data()?.[c.field!]) <= String(c.value),
          );
        if (c.kind === "after")
          docs = docs.slice(
            docs.findIndex((d) => d.id === (c.value as { id: string }).id) + 1,
          );
      }
    const cap =
      typeof request === "string"
        ? undefined
        : (request.constraints.find((c) => c.kind === "limit")?.value as
            number | undefined);
    return { docs: cap ? docs.slice(0, cap) : docs };
  },
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
  firebaseClient: () => ({
    db: {},
    auth: {
      currentUser: {
        uid: cloud.uid,
        emailVerified: cloud.verified,
        providerData: [],
      },
    },
  }),
};
export const authMock = {
  useAuth: () => ({
    user: {
      uid: cloud.uid,
      email: "fictional@example.invalid",
      emailVerified: cloud.verified,
      providerData: [],
    },
    signOut: vi.fn(),
  }),
};
