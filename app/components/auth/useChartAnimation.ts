import { useEffect, useRef } from "react";

export const STORY = {
  candleCount: 32,
  entryIndex: 13,
  typingStart: 2600,
  journaledTime: 5400,
  loopLength: 9000,
  chartDuration: 3600,
};
const NOTE = "Waited for my setup. Kept my risk small. Followed my plan.";
export function useChartAnimation() {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const note = useRef<HTMLParagraphElement>(null);
  const status = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = host.current,
      surface = canvas.current;
    if (!element || !surface) return;
    const ctx = surface.getContext("2d");
    if (!ctx) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)"),
      theme = matchMedia("(prefers-color-scheme: dark)");
    const candles = Array.from({ length: STORY.candleCount }, (_, i) => {
      const open = 2310 + i * 0.8 + Math.sin(i * 0.9) * 3;
      const close = open + Math.sin(i * 1.7 + 1) * 3.2 + 0.7;
      return {
        open,
        close,
        high: Math.max(open, close) + 2,
        low: Math.min(open, close) - 2,
      };
    });
    const typedFrames = Array.from({ length: NOTE.length + 1 }, (_, i) =>
      NOTE.slice(0, i),
    );
    const priceLabels = ["2305", "2314", "2323", "2332", "2341"];
    let width = 0,
      height = 0,
      frame = 0,
      elapsed = 0,
      previous = 0,
      visible = true;
    let up = "",
      down = "",
      accent = "",
      fg = "",
      muted = "",
      grid = "",
      panel = "",
      font = "";
    let lastText = "",
      lastStatus = "";
    function colors() {
      const css = getComputedStyle(element!);
      up = css.getPropertyValue("--profit").trim();
      down = css.getPropertyValue("--loss").trim();
      accent = css.getPropertyValue("--accent").trim();
      fg = css.getPropertyValue("--ink").trim();
      muted = css.getPropertyValue("--muted").trim();
      grid = css.getPropertyValue("--line").trim();
      panel = css.getPropertyValue("--surface").trim();
      font = `10px ${css.getPropertyValue("--font-heading").trim()}`;
    }
    function y(price: number) {
      return height - 20 - ((price - 2300) / 45) * (height - 38);
    }
    function draw(time: number) {
      const c = ctx!;
      c.clearRect(0, 0, width, height);
      const right = width < 380 ? 39 : 58,
        left = 10;
      const plot = width - left - right,
        step = plot / STORY.candleCount;
      c.font = font;
      c.textAlign = "left";
      for (let n = 0; n < 5; n++) {
        const price = 2305 + n * 9,
          py = y(price);
        c.strokeStyle = grid;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(left, py);
        c.lineTo(width - right, py);
        c.stroke();
        if (height >= 240 || n % 2 === 0) {
          c.fillStyle = muted;
          c.fillText(priceLabels[n], width - right + 7, py + 3);
        }
      }
      const progress = Math.min(1, time / STORY.chartDuration);
      const count = Math.min(
        STORY.candleCount,
        Math.floor(progress * STORY.candleCount),
      );
      for (let i = 0; i < count; i++) {
        const candle = candles[i],
          x = left + step * (i + 0.5);
        c.strokeStyle = candle.close >= candle.open ? up : down;
        c.fillStyle = c.strokeStyle;
        c.beginPath();
        c.moveTo(x, y(candle.high));
        c.lineTo(x, y(candle.low));
        c.stroke();
        c.fillRect(
          x - step * 0.29,
          Math.min(y(candle.open), y(candle.close)),
          step * 0.58,
          Math.max(2, Math.abs(y(candle.open) - y(candle.close))),
        );
      }
      if (count > STORY.entryIndex) {
        const x = left + step * (STORY.entryIndex + 0.5),
          entry = candles[STORY.entryIndex].close;
        c.globalAlpha = 0.1;
        c.fillStyle = up;
        c.fillRect(x, y(entry + 15), plot + left - x, y(entry) - y(entry + 15));
        c.fillStyle = down;
        c.fillRect(x, y(entry), plot + left - x, y(entry - 7) - y(entry));
        c.globalAlpha = 1;
        c.strokeStyle = accent;
        c.beginPath();
        c.moveTo(x, y(entry));
        c.lineTo(width - right, y(entry));
        c.stroke();
        c.fillStyle = panel;
        c.fillRect(x - 18, y(entry) + 9, 38, 20);
        c.fillStyle = fg;
        c.fillText("BUY", x - 10, y(entry) + 23);
      }
      const text =
        typedFrames[
          Math.min(
            NOTE.length,
            Math.max(0, Math.floor((time - STORY.typingStart) / 37)),
          )
        ];
      const state = time >= STORY.journaledTime ? "✓ Journaled" : "Writing";
      if (lastText !== text) {
        if (note.current) note.current.textContent = text;
        lastText = text;
      }
      if (lastStatus !== state) {
        if (status.current) status.current.textContent = state;
        lastStatus = state;
      }
    }
    function tick(now: number) {
      elapsed += previous ? now - previous : 0;
      previous = now;
      draw(elapsed % STORY.loopLength);
      frame = requestAnimationFrame(tick);
    }
    function schedule() {
      cancelAnimationFrame(frame);
      previous = 0;
      if (motion.matches) {
        draw(STORY.journaledTime + 1000);
        return;
      }
      if (visible && !document.hidden) frame = requestAnimationFrame(tick);
    }
    function resize() {
      const rect = surface!.getBoundingClientRect(),
        ratio = Math.min(devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      surface!.width = Math.round(width * ratio);
      surface!.height = Math.round(height * ratio);
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(
        motion.matches
          ? STORY.journaledTime + 1000
          : elapsed % STORY.loopLength,
      );
    }
    function recolor() {
      colors();
      resize();
    }
    colors();
    resize();
    schedule();
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(surface);
    const themeObserver = new MutationObserver(recolor);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    });
    intersection.observe(element);
    motion.addEventListener("change", schedule);
    theme.addEventListener("change", recolor);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      themeObserver.disconnect();
      intersection.disconnect();
      motion.removeEventListener("change", schedule);
      theme.removeEventListener("change", recolor);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, []);
  return { host, canvas, note, status };
}
