import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:4182",
  results = [];
const server = spawn(
  process.execPath,
  ["node_modules/@react-router/serve/bin.cjs", "build/server/index.js"],
  {
    env: { ...process.env, HOST: "127.0.0.1", PORT: "4182" },
    stdio: "ignore",
    windowsHide: true,
  },
);
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await globalThis.fetch(origin + "/login")).ok) break;
    } catch {
      /* Wait for local production server. */
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 500));
  }
  browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  await mkdir("test-results/ui-refresh", { recursive: true });
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      colorScheme: theme,
      reducedMotion: "reduce",
    });
    await context.addInitScript(
      (value) => globalThis.localStorage.setItem("trade-notes-theme-v1", value),
      theme,
    );
    const page = await context.newPage();
    await page.goto(origin + "/login");
    await page.evaluate(() => globalThis.navigator.serviceWorker.ready);
    await page.waitForFunction(
      () => !!globalThis.navigator.serviceWorker.controller,
    );
    const manifest = await (
      await context.request.get(origin + "/manifest.webmanifest")
    ).json();
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.icons.length, 2);
    const cache = await page.evaluate(async () => {
      const stored = await globalThis.caches.open("trade-notes-shell-v1");
      return (await stored.keys())
        .map((r) => new globalThis.URL(r.url).pathname)
        .sort();
    });
    assert.deepEqual(cache, [
      "/brand/icon-192.png",
      "/brand/icon-512.png",
      "/offline.html",
      "/theme.js",
    ]);
    await context.setOffline(true);
    await page.goto(origin + "/journal");
    await page
      .getByRole("heading", { name: "You're offline", exact: true })
      .waitFor();
    await page.screenshot({
      path: `test-results/ui-refresh/offline-${theme}.png`,
    });
    results.push({
      theme,
      offlineFallback: true,
      manifest: true,
      cachedPaths: cache,
    });
    await context.close();
  }
  await writeFile(
    "test-results/ui-refresh/pwa-audit.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
