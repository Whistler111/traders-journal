import { expect, test } from "@playwright/test";
test("Firebase login is responsive, protects routes and reports friendly sign-in errors", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    await page.addInitScript(
      (value) => localStorage.setItem("trade-notes-theme-v1", value),
      theme,
    );
    for (const width of [320, 375, 414, 768, 1280]) {
      await page.setViewportSize({ width, height: 667 });
      await page.goto("/login");
      await expect(
        page.getByRole("heading", { name: "Welcome back." }),
      ).toBeVisible();
      await expect(page.locator(".auth-story-status")).toHaveText(
        "✓ Journaled",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const bounds = await page
        .getByRole("button", { name: "Sign in", exact: true })
        .boundingBox();
      if (width < 640)
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(667);
      await page.screenshot({
        path: `test-results/auth-${testInfo.project.name}-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  }
  for (const route of ["/", "/journal", "/review", "/connections"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Welcome back." }),
    ).toBeVisible();
  }
  // Intercept the auth request: never send test credentials to the real project.
  await page.route("**/identitytoolkit.googleapis.com/**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: 400, message: "INVALID_LOGIN_CREDENTIALS" },
      }),
    }),
  );
  await page.getByLabel("Email address").fill("fictional@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "The email or password is incorrect. Please try again.",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  expect(errors).toEqual([]);
});
