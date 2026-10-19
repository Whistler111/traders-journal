import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleHelp,
} from "lucide-react";
import { useAuth } from "./auth/AuthProvider";
import { onboardingRepo, type TourProgress } from "../lib/onboarding-repo";
import { positionTourBubble } from "../lib/onboarding-layout";
export const TOUR_STEPS = [
  {
    route: "/",
    target: "overview",
    title: "Welcome to your trading space",
    body: "Your overview shows recorded results and open trades. Realized performance uses closed trades only. This is a place to understand your decisions, at your own pace.",
    hint: "No need to enter a trade to try this guide.",
  },
  {
    route: "/journal",
    target: "journal",
    title: "Keep the original plan",
    body: "Use Log a trade to record an entry and why you took it. Keep your original stop and cash risk, add screenshots if useful, and record the broker's net result when closing.",
    hint: "An open trade has no realized profit or loss yet.",
  },
  {
    route: "/review",
    target: "playbooks",
    title: "Build a plan you can repeat",
    body: "Create a playbook with the rules you want to follow. Attach it to a trade, check what happened, and use optional mistake tags to notice patterns without judging yourself.",
    hint: "Existing trade checklists keep their original rules when a playbook changes.",
  },
  {
    route: "/review",
    target: "reflection",
    title: "Make room for the lesson",
    body: "In Daily reflection, note what went well and one adjustment for next time. A thoughtful review matters regardless of profit or loss. Progress here is about reviewing decisions, not trading more.",
    hint: "A short, specific reflection is enough. There is no daily streak to maintain.",
  },
  {
    route: "/connections",
    target: "account",
    title: "Keep your records close",
    body: "Your account keeps confirmed saves across devices. Manage data contains CSV import and JSON backups. Account & connections has verification and sign-out; the dashboard also has a visible sign-out button below.",
    hint: "Importing device records is always your choice. Keep an independent JSON backup.",
  },
] as const;
export function OnboardingTour({ enabled }: { enabled: boolean }) {
  const { user } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [open, setOpen] = useState(false),
    [step, setStep] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    replay = useRef<HTMLButtonElement>(null),
    nextButton = useRef<HTMLButtonElement>(null),
    guard = useRef(false);
  const story = TOUR_STEPS[step];
  useEffect(() => {
    if (!enabled || !user) return;
    let active = true;
    onboardingRepo
      .load(user.uid)
      .then((saved) => {
        if (!active) return;
        if (!saved || saved.status === "active") {
          setStep(saved?.step ?? 0);
          setOpen(true);
        }
      })
      .catch(() => {
        if (active)
          setError("The guide couldn't load. You can start it again below.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, user?.uid]);
  useEffect(() => {
    if (open && location.pathname !== story.route)
      navigate(story.route, { replace: true });
  }, [open, story.route, location.pathname, navigate]);
  useEffect(() => {
    const el = dialog.current;
    if (!open || !el) return;
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    nextButton.current?.focus();
    return () => {
      el.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected && previous !== document.body) previous.focus();
      else replay.current?.focus();
    };
  }, [open]);
  useEffect(() => {
    if (!open || !dialog.current) return;
    let anchor: HTMLElement | null = null,
      frame = 0;
    const el = dialog.current;
    function position() {
      positionTourBubble(el, anchor);
    }
    frame = requestAnimationFrame(() => {
      anchor =
        document.querySelector<HTMLElement>(`[data-tour="${story.target}"]`) ??
        document.getElementById("content");
      anchor?.setAttribute("data-tour-active", "true");
      anchor?.scrollIntoView({ block: "center", behavior: "auto" });
      position();
      nextButton.current?.focus();
    });
    const observer = new ResizeObserver(position);
    observer.observe(el);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      anchor?.removeAttribute("data-tour-active");
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open, step, location.pathname, story.target]);
  async function move(
    target: number,
    status: TourProgress["status"] = "active",
  ) {
    if (!user || guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await onboardingRepo.save(user.uid, { version: 1, step: target, status });
      if (status === "active") setStep(target);
      else {
        setOpen(false);
        if (status === "completed") navigate("/", { replace: true });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        ref={replay}
        className="tour-replay"
        disabled={!enabled || loading}
        onClick={() => {
          setError("");
          setStep(0);
          setOpen(true);
        }}
      >
        <CircleHelp size={15} aria-hidden="true" />
        Quick tour
      </button>
      {!open && error && <span className="tour-load-error">{error}</span>}
      {open && (
        <dialog
          ref={dialog}
          className="tour-bubble"
          aria-labelledby="tour-title"
          aria-describedby="tour-description"
          onCancel={(e) => {
            e.preventDefault();
            if (!busy) void move(step, "skipped");
          }}
        >
          <div className="tour-heading">
            <span className="tour-icon">
              <BookOpen size={20} aria-hidden="true" />
            </span>
            <span>YOUR POCKET GUIDE</span>
            <span aria-live="polite">Step {step + 1} of 5</span>
          </div>
          <div className="tour-dots" aria-hidden="true">
            {TOUR_STEPS.map((_, index) => (
              <span key={index} className={index <= step ? "filled" : ""} />
            ))}
          </div>
          <h2 id="tour-title">{story.title}</h2>
          <p id="tour-description">{story.body}</p>
          <p className="tour-hint">{story.hint}</p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="tour-actions">
            <button
              type="button"
              className="tour-skip"
              disabled={busy}
              onClick={() => void move(step, "skipped")}
            >
              Skip tour
            </button>
            <div>
              {step > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void move(step - 1)}
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  Back
                </button>
              )}
              <button
                ref={nextButton}
                type="button"
                className="primary"
                disabled={busy}
                onClick={() =>
                  void move(
                    step === 4 ? step : step + 1,
                    step === 4 ? "completed" : "active",
                  )
                }
              >
                {busy ? "Saving…" : step === 4 ? "Finish tour" : "Next"}
                {step === 4 ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <ArrowRight size={15} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          {error && (
            <button
              type="button"
              className="tour-close-local"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              Close for now
            </button>
          )}
        </dialog>
      )}
    </>
  );
}
