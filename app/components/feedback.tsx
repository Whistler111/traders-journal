import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AnimationItem } from "lottie-web";
import {
  BookOpen,
  Check,
  CircleDashed,
  LoaderCircle,
  MoveUpRight,
  Star,
} from "lucide-react";
import { validAnimation } from "../lib/lottie";
export type FeedbackType =
  "success" | "profit" | "loss" | "milestone" | "empty" | "loading";
const icons = {
  success: Check,
  profit: MoveUpRight,
  loss: CircleDashed,
  milestone: Star,
  empty: BookOpen,
  loading: LoaderCircle,
};
const subscribe = (callback: () => void) => {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}
export function FeedbackAnimation({
  type,
  loop = false,
}: {
  type: FeedbackType;
  loop?: boolean;
}) {
  const container = useRef<HTMLSpanElement>(null),
    reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const Icon = icons[type];
  useEffect(() => {
    setReady(false);
    if (reduced) return;
    let cancelled = false,
      instance: AnimationItem | undefined;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        try {
          const response = await fetch(`/lottie/${type}.json`, {
            signal: controller.signal,
          });
          if (!response.ok) return;
          const buffer = await response.arrayBuffer();
          if (buffer.byteLength >= 100 * 1024) return;
          const data = JSON.parse(new TextDecoder().decode(buffer));
          if (!validAnimation(data)) return;
          if (cancelled) return;
          const { default: lottie } =
            await import("lottie-web/build/player/lottie_light");
          if (cancelled || !container.current) return;
          instance = lottie.loadAnimation({
            container: container.current,
            renderer: "svg",
            autoplay: true,
            loop,
            animationData: data,
          });
          instance.addEventListener("DOMLoaded", () => {
            if (!cancelled) setReady(true);
          });
          instance.addEventListener("data_failed", () => {
            if (!cancelled) setReady(false);
          });
        } catch {
          /* Artwork is optional. Preserve the static icon on any load failure. */
        }
      },
      type === "empty" ? 800 : 0,
    );
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
      instance?.destroy();
    };
  }, [type, loop, reduced]);
  return (
    <span className={`feedback-animation ${type}`} aria-hidden="true">
      <span hidden={ready && !reduced} className="feedback-fallback">
        <Icon size={25} />
      </span>
      <span className="feedback-player" ref={container} />
    </span>
  );
}
export function Counter({
  value,
  format,
}: {
  value: number | null;
  format: (value: number | null) => string;
}) {
  const reduced = useReducedMotion(),
    [display, setDisplay] = useState(value),
    previous = useRef(value);
  useEffect(() => {
    if (reduced || value === null) {
      previous.current = value;
      return;
    }
    const from = previous.current ?? 0,
      start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 420);
      setDisplay(p === 1 ? value : from + (value - from) * (1 - (1 - p) ** 3));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    previous.current = value;
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <>{format(reduced || value === null ? value : display)}</>;
}
