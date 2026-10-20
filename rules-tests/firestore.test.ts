import { after, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

let env: RulesTestEnvironment;
const owner = "fictional-owner";
const base = () => ({
  id: "trade-a",
  date: "2026-10-20T12:30",
  symbol: "EURUSD",
  setup: "Fictional setup",
  reason: "Fictional test",
  lesson: "",
  direction: "Long",
  session: "London",
  emotion: "Calm",
  status: "closed",
  followed: "yes",
  entry: 1.1,
  stop: 1.05,
  risk: 20,
  pnl: 5,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
const database = (uid = owner) =>
  env
    .authenticatedContext(uid, {
      email_verified: true,
      firebase: { sign_in_provider: "password" },
    })
    .firestore();
const path = `users/${owner}/trades/trade-a`;
before(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080")
    throw Error(
      "Run npm run test:rules; tests require the loopback demo emulator.",
    );
  env = await initializeTestEnvironment({
    projectId: "demo-trade-notes-security",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
});
after(async () => {
  await env?.cleanup();
});

test("owner can create, read, query, update and delete a valid trade", async () => {
  const db = database(),
    ref = doc(db, path);
  await assertSucceeds(setDoc(ref, base()));
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(getDocs(collection(db, `users/${owner}/trades`)));
  await assertSucceeds(
    updateDoc(ref, { lesson: "Reviewed", updatedAt: serverTimestamp() }),
  );
  await assertSucceeds(deleteDoc(ref));
});
test("other users and signed-out clients cannot read, query, write, update or delete", async () => {
  await setDoc(doc(database(), path), base());
  for (const db of [
    database("fictional-other"),
    env.unauthenticatedContext().firestore(),
  ]) {
    await assertFails(getDoc(doc(db, path)));
    await assertFails(getDocs(collection(db, `users/${owner}/trades`)));
    await assertFails(setDoc(doc(db, path), base()));
    await assertFails(updateDoc(doc(db, path), { lesson: "unauthorized" }));
    await assertFails(deleteDoc(doc(db, path)));
  }
});
test("invalid types, enums, prices, unknown fields, missing fields and oversized strings are rejected", async () => {
  const cases: Record<string, unknown>[] = [
    { entry: "1.1" },
    { risk: 0 },
    { stop: 2 },
    { pnl: "5" },
    { direction: "BUY" },
    { status: "pending" },
    { status: "open", pnl: 5 },
    { session: "unknown" },
    { emotion: "unknown" },
    { followed: true },
    { lesson: "x".repeat(5000) },
    { reason: "x".repeat(4001) },
    { symbol: "x".repeat(31) },
    { extra: true },
    { size: "10 lots" },
    { id: "wrong-id" },
    { entry: Number.NaN },
    { entry: Infinity },
    { pnl: Infinity },
    { importSourceId: "x".repeat(201) },
    { journalReview: { payload: "x".repeat(70000) } },
    { screenshots: [{ id: "a", name: "x", unknown: true }] },
    {
      screenshots: Array.from({ length: 4 }, (_, i) => ({
        id: String(i),
        name: "x",
      })),
    },
  ];
  for (const fields of cases)
    await assertFails(setDoc(doc(database(), path), { ...base(), ...fields }));
  const { risk: omitted, ...missing } = base();
  void omitted;
  await assertFails(setDoc(doc(database(), path), missing));
});
test("valid open trades, screenshot references, full checklists and import provenance are accepted", async () => {
  await assertSucceeds(
    setDoc(doc(database(), path), {
      ...base(),
      status: "open",
      pnl: null,
      rating: 5,
      followedPlan: true,
      volume: 0.1,
      volumeUnit: "lot",
      closePrice: 1.2,
      closedAt: "2026-10-20T13:00:00Z",
      screenshots: Array.from({ length: 3 }, (_, i) => ({
        id: `image-${i}`,
        name: "chart.png",
      })),
      journalReview: {
        playbookId: "plan-a",
        playbookName: "Plan",
        rules: Array.from({ length: 20 }, (_, i) => ({
          label: "?".repeat(198) + String(i).padStart(2, "0"),
          checked: true,
        })),
        mistakes: Array.from(
          { length: 12 },
          (_, i) => "?".repeat(38) + String(i).padStart(2, "0"),
        ),
      },
      sourceTimestamp: "2026-10-20T12:30:00.000Z",
      importTimestamp: "2026-10-20T12:30:00.000Z",
      importSourceId: "broker-1",
      importTimezone: "UTC",
    }),
  );
  await assertSucceeds(
    updateDoc(doc(database(), path), {
      lesson: "Updated full checklist trade",
      updatedAt: serverTimestamp(),
    }),
  );
});
test("nested unknown fields, long checklist labels and wrong checkbox types are rejected", async () => {
  for (const rules of [
    [{ label: "x", checked: "yes" }],
    [{ label: "x".repeat(201), checked: false }],
    [{ label: "x", checked: false, extra: true }],
  ]) {
    await assertFails(
      setDoc(doc(database(), path), {
        ...base(),
        journalReview: {
          playbookId: "",
          playbookName: "",
          rules,
          mistakes: [],
        },
      }),
    );
  }
});
test("owner-only images, metadata, onboarding and import markers preserve application paths", async () => {
  const db = database();
  const records = {
    images: {
      id: "image-a",
      name: "chart.png",
      dataUrl: "data:image/png;base64,YQ==",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    settings: { revision: 1, practice: { playbooks: [], reflections: [] } },
    imports: { completedAt: serverTimestamp() },
  };
  for (const [group, value] of Object.entries(records)) {
    const id =
      group === "images"
        ? "image-a"
        : group === "settings"
          ? "journal"
          : "fingerprint";
    const address = `users/${owner}/${group}/${id}`;
    await assertSucceeds(setDoc(doc(db, address), value));
    await assertSucceeds(getDoc(doc(db, address)));
    await assertFails(getDoc(doc(database("fictional-other"), address)));
    await assertFails(setDoc(doc(database("fictional-other"), address), value));
    await assertFails(
      getDoc(doc(env.unauthenticatedContext().firestore(), address)),
    );
  }
  await assertSucceeds(
    setDoc(doc(db, `users/${owner}/settings/onboarding`), {
      version: 1,
      step: 0,
      status: "active",
    }),
  );
});
test("no catch-all write rule bypasses validation; unrelated paths are denied", async () => {
  for (const address of [
    "public/example",
    `users/${owner}`,
    `users/${owner}/unknown/example`,
    `users/${owner}/trades/trade-a/nested/example`,
  ]) {
    await assertFails(setDoc(doc(database(), address), { payload: true }));
    await assertFails(getDoc(doc(database(), address)));
  }
  await setDoc(doc(database(), path), base());
  await assertFails(
    updateDoc(doc(database(), path), {
      unknown: true,
      updatedAt: serverTimestamp(),
    }),
  );
});

test("unverified password accounts can read and use the guide but cannot mutate journal data", async () => {
  const db = env
    .authenticatedContext(owner, {
      email_verified: false,
      firebase: { sign_in_provider: "password" },
    })
    .firestore();
  await setDoc(doc(database(), path), base());
  await assertSucceeds(getDoc(doc(db, path)));
  await assertFails(setDoc(doc(db, path), base()));
  await assertFails(
    updateDoc(doc(db, path), {
      lesson: "blocked",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(deleteDoc(doc(db, path)));
  await assertFails(
    setDoc(doc(db, `users/${owner}/settings/journal`), { revision: 2 }),
  );
  await assertFails(
    setDoc(doc(db, `users/${owner}/imports/fingerprint`), {
      completedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    setDoc(doc(db, `users/${owner}/images/image-a`), {
      id: "image-a",
      name: "x.png",
      dataUrl: "data:image/png;base64,YQ==",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    setDoc(doc(db, `users/${owner}/settings/onboarding`), {
      version: 1,
      step: 0,
      status: "active",
    }),
  );
});
test("Google sign-in is accepted as verified", async () => {
  const db = env
    .authenticatedContext(owner, {
      email_verified: false,
      firebase: { sign_in_provider: "google.com" },
    })
    .firestore();
  await assertSucceeds(setDoc(doc(db, path), base()));
});

test("invalid tags, unknown review keys and last checklist items are rejected", async () => {
  const review = { playbookId: "", playbookName: "", rules: [], mistakes: [] };
  for (const journalReview of [
    { ...review, mistakes: [42] },
    { ...review, mistakes: ["x".repeat(41)] },
    { ...review, extra: true },
    {
      ...review,
      rules: Array.from({ length: 20 }, (_, i) => ({
        label: "Rule",
        checked: i === 19 ? "bad" : true,
      })),
    },
  ])
    await assertFails(
      setDoc(doc(database(), path), { ...base(), journalReview }),
    );
});
test("additive journaling and broker fields accept valid values and reject invalid types", async () => {
  await assertSucceeds(
    setDoc(doc(database(), path), {
      ...base(),
      emotion: "revenge",
      followedPlan: false,
      rating: 5,
      volume: 0.1,
      volumeUnit: "lot",
      closedAt: "2026-10-20T13:00:00Z",
      closePrice: 1.2,
    }),
  );
  for (const fields of [
    { rating: 0 },
    { rating: 6 },
    { rating: 2.5 },
    { followedPlan: "yes" },
    { volume: -1 },
    { closePrice: 0 },
    { volumeUnit: "x".repeat(41) },
    { closedAt: 42 },
  ]) {
    await assertFails(setDoc(doc(database(), path), { ...base(), ...fields }));
  }
});
