import { expect, it } from "vitest";
import {
  accountVerified,
  requireVerifiedAccount,
} from "../app/lib/account-security";
import { clearSensitiveStorage } from "../app/lib/sign-out-cleanup";
it("accepts verified email and Google, rejecting unverified email and signed-out users", () => {
  expect(accountVerified({ emailVerified: true, providerData: [] })).toBe(true);
  expect(
    accountVerified({
      emailVerified: false,
      providerData: [{ providerId: "google.com" }] as never,
    }),
  ).toBe(true);
  expect(() =>
    requireVerifiedAccount({ emailVerified: false, providerData: [] }),
  ).toThrow("Verify your email");
  expect(() => requireVerifiedAccount(null)).toThrow("Verify your email");
});
it("clears all sensitive application storage without touching theme or unrelated applications", () => {
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of [
      "trade-notes-v1",
      "trade-notes-alert-settings-v1:owner",
      "trade-notes-alert-runtime-v1:owner",
      "trade-notes-alert-leader-v1:owner",
      "trade-notes-clipboard-seen-v1",
    ])
      storage.setItem(key, "sensitive");
    storage.setItem("trade-notes-theme-v1", "dark");
    storage.setItem("another-app", "keep");
    clearSensitiveStorage(storage);
    expect(storage.length).toBe(2);
    expect(storage.getItem("trade-notes-theme-v1")).toBe("dark");
    expect(storage.getItem("another-app")).toBe("keep");
  }
});
