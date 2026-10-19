import { expect, test } from "@playwright/test";
test("public information has crawlable metadata, assets and a public-only sitemap", async ({
  page,
  request,
}, info) => {
  const response = await request.get("/about"),
    html = await response.text();
  expect(response.status()).toBe(200);
  expect(html).toContain("A little clarity.");
  expect(html).toContain("application/ld+json");
  await page.goto("/about");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/about$/,
  );
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 375 || width === 1280)
      await page.screenshot({
        path: `test-results/about-${info.project.name}-${width}-light.png`,
        fullPage: true,
      });
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({
      path: `test-results/about-${info.project.name}-${width}-dark.png`,
      fullPage: true,
    });
  }
  for (const path of [
    "/favicon.ico",
    "/brand/favicon-16x16.png",
    "/brand/favicon-32x32.png",
  ])
    expect((await request.get(path)).status()).toBe(200);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/about</loc>");
  expect(sitemap).not.toContain("/journal");
  expect(sitemap).not.toContain("/login");
  await page.goto("/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
});
