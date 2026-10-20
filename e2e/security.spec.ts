import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
// Local document-header injection must see each navigation. The production
// service worker is exercised separately by scripts/audit-pwa.mjs.
test.use({ serviceWorkers: "block" });
const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const headers = Object.fromEntries(
  config.headers[0].headers.map((header: { key: string; value: string }) => [
    header.key,
    header.value,
  ]),
);
test("configured report-only headers preserve login, labels and keyboard focus", async ({
  page,
}, testInfo) => {
  // React Router's local server does not apply vercel.json. Inject the exact
  // configured headers here to observe browser CSP behavior before deployment.
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\//, async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), ...headers },
    });
  });
  await page.addInitScript(() => {
    (window as unknown as { securityReports: unknown[] }).securityReports = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      let blocked = event.blockedURI;
      try {
        blocked = new URL(blocked).origin;
      } catch {
        /* inline/eval identifier */
      }
      (
        window as unknown as { securityReports: unknown[] }
      ).securityReports.push({
        directive: event.effectiveDirective,
        blocked,
        disposition: event.disposition,
      });
    });
  });
  const reports: unknown[] = [];
  for (const path of ["/about", "/login"]) {
    const response = await page.goto(path);
    expect(
      response?.headers()["content-security-policy-report-only"],
    ).toContain("https://*.firebaseapp.com");
    expect(response?.headers()["content-security-policy"]).toBeUndefined();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    if (path === "/login") {
      const password = page.getByLabel("Password", { exact: true });
      await expect(password).toBeVisible();
      const toggle = page.getByRole("button", {
        name: "Show password",
        exact: true,
      });
      await toggle.focus();
      await expect(toggle).toBeFocused();
      expect(
        await toggle.evaluate((el) => getComputedStyle(el).outlineStyle),
      ).not.toBe("none");
      await page.keyboard.press("Enter");
      await expect(password).toHaveAttribute("type", "text");
      await page
        .getByRole("button", { name: "Create an account", exact: true })
        .click();
      await page.getByLabel("Email address").fill("fictional@example.invalid");
      await password.fill("short");
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText(
        "at least 8 characters",
      );
      expect(
        await page
          .locator("input, select, textarea")
          .evaluateAll((fields) =>
            fields.every(
              (field) =>
                (field as HTMLInputElement).labels?.length ||
                field.getAttribute("aria-label") ||
                field.getAttribute("aria-labelledby"),
            ),
          ),
      ).toBe(true);
    }
    reports.push(
      ...(await page.evaluate(
        () =>
          (window as unknown as { securityReports: unknown[] }).securityReports,
      )),
    );
  }
  const observationsPath = testInfo.outputPath("csp-observations.json");
  writeFileSync(observationsPath, JSON.stringify(reports, null, 2));
  await testInfo.attach("report-only-csp-observations", {
    body: JSON.stringify(reports, null, 2),
    contentType: "application/json",
  });
  expect(reports).toEqual([]);
});
