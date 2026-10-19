import { Blob as NodeBlob } from "node:buffer";
import { expect, it, vi } from "vitest";
import {
  ClipboardSession,
  imageFingerprint,
  pastedImages,
  readClipboardImage,
} from "../app/lib/clipboard";
it("fingerprints size, type and first bytes and deduplicates across dialog sessions", async () => {
  const a = new NodeBlob(["image-a"], { type: "image/png" }) as unknown as Blob,
    b = new NodeBlob(["image-b"], { type: "image/png" }) as unknown as Blob;
  const hash = await imageFingerprint(a);
  expect(await imageFingerprint(a)).toBe(hash);
  expect(await imageFingerprint(b)).not.toBe(hash);
  const session = new ClipboardSession(sessionStorage);
  expect(session.claim(hash)).toBe(true);
  expect(session.claim(hash)).toBe(false);
  expect(new ClipboardSession(sessionStorage).claim(hash)).toBe(false);
  expect(
    await imageFingerprint(
      new NodeBlob(["image-a"], { type: "image/webp" }) as unknown as Blob,
    ),
  ).not.toBe(hash);
});
it("retains in-memory deduplication when session storage is unavailable", () => {
  const session = new ClipboardSession({
    getItem: () => {
      throw Error("denied");
    },
    setItem: () => {
      throw Error("denied");
    },
  });
  expect(session.claim("a")).toBe(true);
  expect(session.claim("a")).toBe(false);
});
it("extracts supported pasted images without treating text as an image", () => {
  const image = new File(["x"], "chart.png", { type: "image/png" });
  const data = {
    items: [
      { kind: "string", type: "text/plain", getAsFile: () => null },
      { kind: "file", type: "image/png", getAsFile: () => image },
      {
        kind: "file",
        type: "image/svg+xml",
        getAsFile: () => new File(["svg"], "x.svg"),
      },
    ],
  } as unknown as DataTransfer;
  expect(pastedImages(data)).toEqual([image]);
  expect(pastedImages(null)).toEqual([]);
});
it("falls back cleanly when the secure clipboard API is unsupported", async () => {
  vi.stubGlobal("isSecureContext", false);
  expect(await readClipboardImage()).toBeNull();
});
