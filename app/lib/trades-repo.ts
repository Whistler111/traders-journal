import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
  doc,
  getDocFromServer,
  getDocsFromServer,
  runTransaction,
  serverTimestamp,
  deleteDoc,
  type Firestore,
} from "firebase/firestore";
import { firebaseClient } from "./firebase";
import { parseBackup, validate, type Trade } from "./journal";
import { emptyPractice, validatePractice, type Practice } from "./practice";
import {
  validateScreenshot,
  type Screenshot,
  type ScreenshotRef,
} from "./image-model";
import { dataMessage } from "./firebase-errors";
import { requireVerifiedAccount } from "./account-security";
export function safeId(id: string) {
  if (
    !id ||
    id.includes("/") ||
    id === "." ||
    id === ".." ||
    /^__.*__$/.test(id) ||
    id.length > 200
  )
    throw Error(
      "This record has an unsupported ID. Export a backup before changing it.",
    );
  return id;
}
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export class TradesRepo {
  constructor(
    readonly uid: string,
    readonly db: Firestore = firebaseClient().db,
  ) {
    safeId(uid);
  }
  private path(group: string, id: string) {
    return doc(this.db, "users", this.uid, group, safeId(id));
  }
  private requireOwner() {
    if (firebaseClient().auth.currentUser?.uid !== this.uid)
      throw Error("Your account changed. Sign in again before saving.");
  }
  private meta() {
    return this.path("settings", "journal");
  }
  async list(range?: { from: string; to: string }) {
    this.requireOwner();
    // Compare revision around the query to avoid a torn collection snapshot.
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await getDocFromServer(this.meta());
      const docs: QueryDocumentSnapshot[] = [];
      let cursor: QueryDocumentSnapshot | undefined;
      do {
        const page = await getDocsFromServer(
          query(
            collection(this.db, "users", this.uid, "trades"),
            ...(range
              ? [
                  where("date", ">=", range.from + "T00:00"),
                  where("date", "<=", range.to + "T23:59"),
                ]
              : []),
            orderBy("date"),
            limit(200),
            ...(cursor ? [startAfter(cursor)] : []),
          ),
        );
        docs.push(...page.docs);
        cursor = page.docs.length === 200 ? page.docs.at(-1) : undefined;
      } while (cursor);
      const records = { docs };
      const after = await getDocFromServer(this.meta());
      if ((before.data()?.revision ?? 0) !== (after.data()?.revision ?? 0))
        continue;
      const trades = records.docs.map((record) => {
        const { createdAt, updatedAt, ...fields } = record.data();
        void createdAt;
        void updatedAt;
        return validate({ ...fields, id: record.id });
      });
      this.requireOwner();
      return {
        trades: parseBackup({ version: 1, trades }),
        practice: validatePractice(after.data()?.practice ?? emptyPractice()),
        revision: after.data()?.revision ?? 0,
      };
    }
    throw Error("Your journal is changing on another device. Please reload.");
  }
  async commit(
    before: Trade[],
    next: Trade[],
    practice: Practice,
    revision: number,
    fingerprint?: string,
  ) {
    this.requireOwner();
    requireVerifiedAccount(firebaseClient().auth.currentUser);
    parseBackup({ version: 1, trades: next });
    validatePractice(practice);
    const prior = new Map(before.map((t) => [t.id, t])),
      wanted = new Map(next.map((t) => [t.id, t]));
    const changed = next.filter(
      (t) => JSON.stringify(t) !== JSON.stringify(prior.get(t.id)),
    );
    const removed = before.filter((t) => !wanted.has(t.id));
    // A bounded atomic write refuses oversized imports instead of partially applying them.
    if (
      changed.length + removed.length > 400 ||
      new TextEncoder().encode(JSON.stringify(changed)).length > 7 * 1024 * 1024
    )
      throw Error(
        "This operation is too large for one safe cloud write. Import at most 400 changed trades at a time (under 7 MB). No records were changed.",
      );
    try {
      const result = await runTransaction(this.db, async (tx) => {
        const metadata = await tx.get(this.meta());
        const marker = fingerprint ? this.path("imports", fingerprint) : null;
        if (marker && (await tx.get(marker)).exists())
          return { revision: metadata.data()?.revision ?? 0, imported: false };
        if ((metadata.data()?.revision ?? 0) !== revision)
          throw Error(
            "Your journal changed on another device. Reload before saving to protect newer records.",
          );
        const created = new Map<string, unknown>();
        for (const trade of changed) {
          const old = await tx.get(this.path("trades", trade.id));
          created.set(trade.id, old.data()?.createdAt ?? serverTimestamp());
          if (!prior.has(trade.id) && old.exists())
            throw Error(
              "A trade with this ID already exists. Reload before importing.",
            );
          if (prior.has(trade.id) && !old.exists())
            throw Error("This trade no longer exists. Reload before editing.");
        }
        // All reads precede writes, as required by Firestore transactions.
        for (const trade of changed)
          tx.set(this.path("trades", trade.id), {
            ...clean(trade),
            createdAt: created.get(trade.id),
            updatedAt: serverTimestamp(),
          });
        for (const trade of removed) tx.delete(this.path("trades", trade.id));
        tx.set(
          this.meta(),
          {
            practice: clean(practice),
            revision: revision + 1,
            updatedAt: serverTimestamp(),
            ...(!metadata.exists() ? { createdAt: serverTimestamp() } : {}),
          },
          { merge: true },
        );
        if (marker) tx.set(marker, { completedAt: serverTimestamp() });
        return { revision: revision + 1, imported: true };
      });
      this.requireOwner();
      return result;
    } catch (e) {
      throw Error(dataMessage(e), { cause: e });
    }
  }
  async hasImport(fingerprint: string) {
    this.requireOwner();
    return (await getDocFromServer(this.path("imports", fingerprint))).exists();
  }
  async add(trade: Trade, state: CloudJournalStore) {
    return state.save(trade, false);
  }
  async update(trade: Trade, state: CloudJournalStore) {
    return state.save(trade, true);
  }
  async remove(id: string, state: CloudJournalStore) {
    return state.delete(id);
  }
  async images(refs: ScreenshotRef[]) {
    this.requireOwner();
    const images = await Promise.all(
      refs.map(async (ref) => {
        const record = await getDocFromServer(this.path("images", ref.id));
        if (!record.exists())
          throw Error(
            "A screenshot is missing from your account. Restore a backup containing it.",
          );
        return validateScreenshot({
          ...record.data(),
          id: ref.id,
          name: ref.name,
        });
      }),
    );
    this.requireOwner();
    return images;
  }
  async writeImages(images: Screenshot[]) {
    this.requireOwner();
    requireVerifiedAccount(firebaseClient().auth.currentUser);
    for (const image of images) {
      this.requireOwner();
      validateScreenshot(image);
      await runTransaction(this.db, async (tx) => {
        const path = this.path("images", image.id);
        const old = await tx.get(path);
        if (old.exists()) {
          if (old.data().dataUrl !== image.dataUrl)
            throw Error(
              "Screenshot ID conflict. Your journal was not changed.",
            );
          return;
        }
        tx.set(path, {
          ...image,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    }
  }
  async deleteImages(ids: string[]) {
    this.requireOwner();
    requireVerifiedAccount(firebaseClient().auth.currentUser);
    await Promise.all(ids.map((id) => deleteDoc(this.path("images", id))));
  }
}
// In-memory editing snapshot only; Firestore is the source of truth.
export class CloudJournalStore {
  trades: Trade[] = [];
  practice: Practice = emptyPractice();
  revision = 0;
  failed = false;
  constructor(readonly repo: TradesRepo) {}
  async load(range?: { from: string; to: string }) {
    try {
      const state = await this.repo.list(range);
      this.trades = state.trades;
      this.practice = state.practice;
      this.revision = state.revision;
      this.failed = false;
      return this.trades;
    } catch (e) {
      this.failed = true;
      throw e;
    }
  }
  async commit(
    next: Trade[],
    _restore = false,
    practice = this.practice,
    fingerprint?: string,
  ) {
    void _restore;
    if (this.failed)
      throw Error(
        "Your cloud journal could not be loaded. Reload successfully before changing records.",
      );
    const result = await this.repo.commit(
      this.trades,
      next,
      practice,
      this.revision,
      fingerprint,
    );
    if (!result.imported) return this.load();
    this.trades = next;
    this.practice = practice;
    this.revision = result.revision;
    return next;
  }
  async save(trade: Trade, editing: boolean) {
    const existing = this.trades.find((t) => t.id === trade.id);
    if (editing && !existing)
      throw Error("This trade no longer exists. Reload your journal.");
    if (!editing && existing) throw Error("This trade has already been saved.");
    return this.commit(
      editing
        ? this.trades.map((t) => {
            if (t.id !== trade.id) return t;
            const merged = { ...t, ...trade };
            for (const key of ["rating", "followedPlan", "closedAt"] as const)
              if (!(key in trade)) delete merged[key];
            return merged;
          })
        : [...this.trades, trade],
    );
  }
  async delete(id: string) {
    return this.commit(this.trades.filter((t) => t.id !== id));
  }
}
