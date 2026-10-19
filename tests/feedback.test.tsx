import { act, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FeedbackAnimation, Counter } from "../app/components/feedback";
import { validAnimation } from "../app/lib/lottie";
const player = vi.hoisted(() => ({ destroy: vi.fn(), load: vi.fn() }));
vi.mock("lottie-web/build/player/lottie_light", () => ({
  default: { loadAnimation: player.load },
}));
it("lazily loads valid artwork, plays once, and destroys the instance on removal", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const artwork = {
    v: "5.13.0",
    fr: 30,
    ip: 0,
    op: 60,
    w: 64,
    h: 64,
    layers: [],
  };
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    arrayBuffer: async () =>
      new TextEncoder().encode(JSON.stringify(artwork)).buffer,
  } as Response);
  player.load.mockReturnValue({
    destroy: player.destroy,
    addEventListener: (name: string, callback: () => void) => {
      if (name === "DOMLoaded") callback();
    },
  });
  const view = render(<FeedbackAnimation type="success" />);
  await waitFor(() => expect(player.load).toHaveBeenCalled());
  expect(player.load.mock.lastCall![0]).toMatchObject({
    autoplay: true,
    loop: false,
    renderer: "svg",
  });
  await waitFor(() =>
    expect(document.querySelector(".feedback-fallback")).not.toBeVisible(),
  );
  view.unmount();
  expect(player.destroy).toHaveBeenCalledTimes(1);
});
it("loops only when requested and stops when reduced motion activates", async () => {
  let reduced = false;
  const callbacks = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_: string, callback: () => void) =>
      callbacks.add(callback),
    removeEventListener: (_: string, callback: () => void) =>
      callbacks.delete(callback),
  }));
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    arrayBuffer: async () =>
      new TextEncoder().encode(JSON.stringify({ fr: 30, op: 60, layers: [] }))
        .buffer,
  } as Response);
  player.load.mockClear();
  player.destroy.mockClear();
  player.load.mockReturnValue({
    destroy: player.destroy,
    addEventListener: () => {},
  });
  const view = render(<FeedbackAnimation type="loading" loop />);
  await waitFor(() => expect(player.load).toHaveBeenCalled());
  expect(player.load.mock.lastCall![0].loop).toBe(true);
  act(() => {
    reduced = true;
    callbacks.forEach((callback) => callback());
  });
  expect(player.destroy).toHaveBeenCalledTimes(1);
  expect(document.querySelector(".feedback-fallback svg")).toBeVisible();
  view.unmount();
  expect(callbacks.size).toBe(0);
});
it("rejects external assets, expressions, oversized and malformed JSON while keeping a fallback", async () => {
  expect(
    validAnimation({ fr: 30, op: 60, layers: [{ x: "expression" }] }),
  ).toBe(false);
  expect(
    validAnimation({
      fr: 30,
      op: 60,
      layers: [],
      assets: [{ p: "https://example.test/image.png" }],
    }),
  ).toBe(false);
  expect(
    validAnimation({ fr: 30, op: 60, layers: [{ i: { x: [0.5] } }] }),
  ).toBe(true);
  expect(validAnimation({ fr: 0, op: 60, layers: [] })).toBe(false);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(102400),
  } as Response);
  player.load.mockClear();
  const view = render(<FeedbackAnimation type="profit" />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(document.querySelector(".feedback-fallback svg")).toBeVisible();
  expect(player.load).not.toHaveBeenCalled();
  view.unmount();
});
it("renders exact counters with reduced motion and cancels a delayed loop before fetch", () => {
  const view = render(
    <>
      <Counter value={1 / 3} format={(v) => String(v)} />
      <FeedbackAnimation type="empty" loop />
    </>,
  );
  expect(screen.getByText(String(1 / 3))).toBeVisible();
  view.unmount();
  expect(fetch).not.toHaveBeenCalled();
});
