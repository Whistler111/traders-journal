import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const output = "test-results/ui-refresh";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const audit = [],
  errors = [];
for (const theme of ["light", "dark"])
  for (const width of [320, 375, 414, 768, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width < 701,
      isMobile: width < 701,
      reducedMotion: "reduce",
      colorScheme: theme,
    });
    await context.addInitScript(
      (value) => globalThis.localStorage.setItem("trade-notes-theme-v1", value),
      theme,
    );
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on("pageerror", (e) =>
      errors.push({ width, theme, error: e.message }),
    );
    for (const [route, name] of [
      ["/", "dashboard"],
      ["/journal", "journal"],
      ["/reports", "reports"],
      ["/review", "playbooks"],
      ["/settings", "settings"],
    ]) {
      await page.goto(
        `http://127.0.0.1:4181${route}?from=2026-09-21&to=2026-10-20&period=30D`,
      );
      await page.waitForSelector(".page-heading", { timeout: 30000 });
      await page.evaluate(() => globalThis.document.fonts.ready);
      await page.waitForTimeout(180);
      const dimensions = await page.evaluate(() => ({
        viewport: globalThis.innerWidth,
        document: globalThis.document.documentElement.scrollWidth,
        smallTargets: [
          ...globalThis.document.querySelectorAll(
            "button,a,input,select,textarea,summary",
          ),
        ]
          .filter((e) => !e.disabled)
          .map((e) => {
            const box = e.getBoundingClientRect();
            return {
              label:
                e.getAttribute("aria-label") ||
                e.textContent?.trim().slice(0, 50) ||
                e.getAttribute("type"),
              width: box.width,
              height: box.height,
            };
          })
          .filter(
            (e) =>
              e.width > 0 &&
              e.height > 0 &&
              (e.width < 43.5 || e.height < 43.5),
          ),
        clippedNumbers:[...globalThis.document.querySelectorAll(".key-number")].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),
        smallInputs: [
          ...globalThis.document.querySelectorAll("input,select,textarea"),
        ]
          .filter(
            (e) =>
              e.getBoundingClientRect().width > 0 &&
              globalThis.getComputedStyle(e).fontSize.replace("px", "") < 16,
          )
          .map((e) => e.getAttribute("aria-label") || e.getAttribute("type")),
      }));
      audit.push({ width, theme, screen: name, ...dimensions });
      await page.screenshot({
        path: `${output}/${name}-${width}-${theme}.png`,
        fullPage: true,
      });
    }
    await page.goto(
      "http://127.0.0.1:4181/journal?from=2026-09-21&to=2026-10-20&period=30D",
    );
    await page.waitForSelector(".trade-row");
    await page
      .getByRole("button", { name: /^View .*trade on/ })
      .first()
      .click();
    await page.waitForSelector("dialog[open]");
    await page.locator(".trade-chart-gallery img").first().waitFor();
    await page.screenshot({
      path: `${output}/trade-drawer-${width}-${theme}.png`,
      fullPage: false,
    });
    audit.push({
      width,
      theme,
      screen: "drawer",
      ...(await page.evaluate(() => {
        const d = globalThis.document.querySelector("dialog[open]");
        return {
          viewport: globalThis.innerWidth,
          document: globalThis.document.documentElement.scrollWidth,
          dialogWidth: d.clientWidth,
          dialogScroll: d.scrollWidth,
        };
      })),
    });
    await page.getByRole("button", { name: "Edit trade", exact: true }).click();
    await page.waitForSelector("#trade-title");
    await page.screenshot({
      path: `${output}/trade-edit-${width}-${theme}.png`,
      fullPage: false,
    });
    if (width < 701) {
      await page.setViewportSize({ width, height: 430 });
      await page.locator('[name="symbol"]').focus();
      await page.waitForTimeout(100);
      const save = await page
        .getByRole("button", { name: "Save trade", exact: true })
        .boundingBox();
      audit.push({
        width,
        theme,
        screen: "keyboard-resize",
        save,
        viewportHeight: 430,
      });
      await page.screenshot({
        path: `${output}/keyboard-${width}-${theme}.png`,
        fullPage: false,
      });
    }
    if (width === 1280) {
      await page.getByRole("button", { name: "Close trade form" }).click();
      await page.keyboard.press("Control+k");
      await page.waitForSelector(".command-palette[open]");
      await page.screenshot({ path: `${output}/commands-${theme}.png` });
      await page.keyboard.press("Escape");
      await page.keyboard.press("n");
      await page.waitForSelector("#trade-title");
      await page.getByRole("button", { name: "Close trade form" }).click();
      await page.getByRole("button", { name: "Collapse sidebar" }).click();
      await page.screenshot({
        path: `${output}/sidebar-collapsed-${theme}.png`,
        fullPage: true,
      });
    }
    await context.close();
    console.log(`Captured ${width}px ${theme}`);
  }
await writeFile(
  `${output}/audit.json`,
  JSON.stringify({ audit, errors }, null, 2),
);
await browser.close();
console.log(
  JSON.stringify(
    {
      overflows: audit.filter(
        (r) =>
          (r.document ?? 0) > r.width ||
          (r.dialogScroll ?? 0) > (r.dialogWidth ?? Infinity),
      ),
      errors,
    },
    null,
    2,
  ),
);
