import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const page = await browser.newPage({
  viewport: { width: 512, height: 512 },
  deviceScaleFactor: 1,
});
const svg = await readFile("public/brand/install-mark.svg", "utf8");
for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`,
  );
  await page.screenshot({
    path: `public/brand/icon-${size}.png`,
    omitBackground: true,
  });
}
await browser.close();
console.log("Static notebook install icons generated at 192 and 512 px.");
