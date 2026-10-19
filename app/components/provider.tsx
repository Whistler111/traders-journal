import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  milestones,
  outcome,
  planStreak,
  type Milestone,
  type Trade,
} from "../lib/journal";
import { CloudJournalStore, TradesRepo } from "../lib/trades-repo";
import { useAuth } from "./auth/AuthProvider";
import { dataMessage } from "../lib/firebase-errors";
import { deviceSources, importDevice } from "../lib/device-import";
import { emptyPractice, type Practice } from "../lib/practice";
import { FeedbackAnimation, type FeedbackType } from "./feedback";
import {
  commitWithScreenshots,
  setScreenshotBackend,
  restoreWithScreenshots,
  screenshotRefs,
  type Screenshot,
} from "../lib/screenshots";
const Context = createContext<{
  trades: Trade[];
  ready: boolean;
  error: string;
  practice: Practice;
  savePractice: (practice: Practice) => Promise<void>;
  importTrades: (trades: Trade[]) => Promise<void>;
  deviceImportAvailable: boolean;
  importFromDevice: () => Promise<void>;
  store: React.RefObject<CloudJournalStore | null>;
  save: (
    trade: Trade,
    editing: boolean,
    drafts?: Screenshot[],
  ) => void | Promise<void>;
  remove: (id: string) => Promise<void>;
  restore: (
    trades: Trade[],
    images?: Screenshot[],
    practice?: Practice,
  ) => void | Promise<void>;
  notify: (message: string) => void;
} | null>(null);
const milestoneKey = "trade-notes-milestones-v1";
function persistMilestones(seen: Set<Milestone>) {
  try {
    localStorage.setItem(milestoneKey, JSON.stringify([...seen]));
  } catch {
    /* Optional feedback metadata must never block a journal operation. */
  }
}
export function JournalProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [deviceImportAvailable, setDeviceImportAvailable] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [practice, setPractice] = useState<Practice>(emptyPractice);
  const [message, setMessage] = useState(""),
    [feedback, setFeedback] = useState<{
      type: FeedbackType;
      text: string;
      id: number;
    } | null>(null);
  const store = useRef<CloudJournalStore | null>(null),
    seen = useRef(new Set<Milestone>()),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    serial = useRef(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const instance = new CloudJournalStore(new TradesRepo(user.uid));
    store.current = instance;
    setScreenshotBackend(instance.repo);
    setReady(false);
    setError("");
    instance
      .load()
      .then((loaded) => {
        if (!active) return;
        setTrades(loaded);
        setPractice(instance.practice);
        setReady(true);
        if (loaded.length >= 10) seen.current.add("ten");
        if (planStreak(loaded) >= 5) seen.current.add("plan");
        try {
          setDeviceImportAvailable(deviceSources().length > 0);
        } catch {
          /* Device storage can be blocked. */
        }
      })
      .catch((e) => {
        if (active) {
          setError(dataMessage(e));
          setReady(true);
        }
      });
    return () => {
      active = false;
      store.current = null;
      setScreenshotBackend(null);
      timers.current.forEach(clearTimeout);
    };
  }, [user?.uid]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  function clearFeedback() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFeedback(null);
  }
  function show(type: FeedbackType, text: string) {
    setFeedback({ type, text, id: ++serial.current });
    timers.current.push(setTimeout(() => setFeedback(null), 2200));
  }
  async function save(
    trade: Trade,
    editing: boolean,
    drafts: Screenshot[] = [],
  ) {
    if (!store.current || !ready) throw Error("Journal is still loading.");
    const before = store.current.trades;
    const previous = store.current.trades.find((t) => t.id === trade.id);
    if (
      drafts.length ||
      screenshotRefs(trade).length ||
      (previous && screenshotRefs(previous).length)
    ) {
      return commitWithScreenshots(store.current, trade, editing, drafts).then(
        (next) => saved(next),
      );
    }
    saved(await store.current.save(trade, editing));
    function saved(next: Trade[]) {
      setTrades(next);
      setError("");
      clearFeedback();
      const events = milestones(before, next, seen.current);
      for (const key of events) seen.current.add(key);
      persistMilestones(seen.current);
      const result = outcome(trade);
      show(
        result === "loss" ? "loss" : result === "win" ? "profit" : "success",
        result === "loss"
          ? "Loss recorded. Review your entry, risk and execution."
          : "Trade saved. Your journal is up to date.",
      );
      if (events.length)
        timers.current.push(
          setTimeout(
            () =>
              show(
                "milestone",
                events
                  .map((k) =>
                    k === "ten"
                      ? "Your first 10 trades recorded."
                      : "Five consecutive closed trades following your plan: process consistency, regardless of profit or loss.",
                  )
                  .join(" "),
              ),
            2400,
          ),
        );
    }
  }
  async function remove(id: string) {
    if (!store.current) throw Error("Journal is loading.");
    const instance = store.current;
    const images = instance.trades
      .filter((t) => t.id === id)
      .flatMap(screenshotRefs);
    const next = await instance.delete(id);
    setTrades(next);
    const retained = new Set(
      next.flatMap(screenshotRefs).map((image) => image.id),
    );
    void instance.repo
      .deleteImages(
        images
          .filter((image) => !retained.has(image.id))
          .map((image) => image.id),
      )
      .catch(() => {});
    clearFeedback();
    setMessage("Trade deleted.");
  }
  async function restore(
    next: Trade[],
    images: Screenshot[] = [],
    practice?: Practice,
  ) {
    if (!store.current) throw Error("Journal is loading.");
    if (
      images.length ||
      store.current.trades.some((t) => screenshotRefs(t).length)
    )
      return restoreWithScreenshots(store.current, next, images, practice).then(
        (restored) => finished(restored),
      );
    finished(await store.current.commit(next, true, practice));
    function finished(next: Trade[]) {
      setTrades(next);
      setPractice(store.current!.practice);
      setError("");
      clearFeedback();
      if (next.length >= 10) seen.current.add("ten");
      if (planStreak(next) >= 5) seen.current.add("plan");
      persistMilestones(seen.current);
      setMessage(`Restored ${next.length} trades.`);
    }
  }
  return (
    <Context.Provider
      value={{
        trades,
        ready,
        error,
        practice,
        savePractice: async (next) => {
          if (!store.current || error) throw Error("Journal unavailable.");
          await store.current.commit(store.current.trades, false, next);
          setPractice(next);
        },
        importTrades: async (next) => {
          if (!store.current || error) throw Error("Journal unavailable.");
          setTrades(
            await store.current.commit([...store.current.trades, ...next]),
          );
          setMessage(`Imported ${next.length} trades.`);
        },
        deviceImportAvailable,
        importFromDevice: async () => {
          if (!store.current || !ready || error)
            throw Error("Journal unavailable.");
          const count = await importDevice(store.current, deviceSources());
          setTrades([...store.current.trades]);
          setPractice(store.current.practice);
          setDeviceImportAvailable(deviceSources().length > 0);
          setMessage(`Imported ${count} device trades to your account.`);
        },
        store,
        save,
        remove,
        restore,
        notify: setMessage,
      }}
    >
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
      {feedback && (
        <div className="feedback" role="status">
          <FeedbackAnimation key={feedback.id} type={feedback.type} />
          <p>{feedback.text}</p>
        </div>
      )}
    </Context.Provider>
  );
}
export function useJournal() {
  const value = useContext(Context);
  if (!value) throw Error("Journal provider missing.");
  return value;
}
