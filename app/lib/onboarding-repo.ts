import {
  doc,
  getDocFromServer,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { firebaseClient } from "./firebase";
import { dataMessage } from "./firebase-errors";
export interface TourProgress {
  version: 1;
  step: number;
  status: "active" | "completed" | "skipped";
}
export function parseTour(value: unknown): TourProgress | null {
  if (value == null) return null;
  const candidate = value as TourProgress;
  if (
    candidate.version !== 1 ||
    !Number.isInteger(candidate.step) ||
    candidate.step < 0 ||
    candidate.step > 4 ||
    !["active", "completed", "skipped"].includes(candidate.status)
  )
    throw Error(
      "The saved guide could not be read. You can replay it from the beginning.",
    );
  return { version: 1, step: candidate.step, status: candidate.status };
}
function account(uid: string) {
  const { auth, db } = firebaseClient();
  if (!uid || uid.includes("/") || auth.currentUser?.uid !== uid)
    throw Error("Your account changed. Sign in again to save guide progress.");
  return doc(db, "users", uid, "settings", "onboarding");
}
export const onboardingRepo = {
  async load(uid: string) {
    try {
      const result = await getDocFromServer(account(uid));
      account(uid);
      return parseTour(result.exists() ? result.data() : null);
    } catch (e) {
      throw Error(dataMessage(e), { cause: e });
    }
  },
  async save(uid: string, progress: TourProgress) {
    parseTour(progress);
    try {
      const ref = account(uid);
      await runTransaction(firebaseClient().db, async (tx) => {
        const previous = await tx.get(ref);
        tx.set(ref, {
          ...progress,
          createdAt: previous.data()?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...(progress.status === "completed"
            ? { completedAt: serverTimestamp() }
            : {}),
        });
      });
      account(uid);
    } catch (e) {
      throw Error(dataMessage(e), { cause: e });
    }
  },
};
