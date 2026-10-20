import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { AuthProvider, RequireAuth } from "../app/components/auth/AuthProvider";
import Login from "../app/routes/login";
import { authMessage } from "../app/lib/firebase-errors";
const sdk = vi.hoisted(() => ({
  observe: vi.fn(),
  popup: vi.fn(),
  redirect: vi.fn(),
  signup: vi.fn(),
  email: vi.fn(),
  verify: vi.fn(),
  reset: vi.fn(),
  signout: vi.fn(),
}));
vi.mock("../app/lib/firebase", () => ({
  firebaseClient: () => ({ auth: {} }),
}));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: sdk.observe,
  getRedirectResult: async () => null,
  signInWithPopup: sdk.popup,
  signInWithRedirect: sdk.redirect,
  createUserWithEmailAndPassword: sdk.signup,
  signInWithEmailAndPassword: sdk.email,
  sendEmailVerification: sdk.verify,
  sendPasswordResetEmail: sdk.reset,
  signOut: sdk.signout,
}));
vi.mock("../app/components/auth/AuthHero", () => ({
  AuthHero: () => <div aria-hidden="true" />,
}));
let changed: (user: unknown) => void;
beforeEach(() => {
  vi.clearAllMocks();
  sdk.observe.mockImplementation((_auth, callback) => {
    changed = callback;
    return vi.fn();
  });
  sdk.signup.mockResolvedValue({ user: { uid: "fictional" } });
});
function app(path = "/login") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<h1>Private workspace</h1>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}
it("waits for Firebase before deciding between login and the private workspace", async () => {
  const view = app("/");
  expect(screen.getByRole("status")).toHaveTextContent("Opening");
  expect(
    screen.queryByRole("heading", { name: "Welcome back." }),
  ).not.toBeInTheDocument();
  await act(async () => changed(null));
  expect(
    await screen.findByRole("heading", { name: "Welcome back." }),
  ).toBeInTheDocument();
  view.unmount();
  app();
  await act(async () => changed({ uid: "fictional" }));
  expect(
    await screen.findByRole("heading", { name: "Private workspace" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Welcome back." }),
  ).not.toBeInTheDocument();
});
it("falls back to redirect only when a Google popup is blocked", async () => {
  app();
  await act(async () => changed(null));
  sdk.popup.mockRejectedValueOnce({ code: "auth/popup-blocked" });
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  await waitFor(() => expect(sdk.redirect).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeEnabled(),
  );
  sdk.popup.mockRejectedValueOnce({ code: "auth/popup-closed-by-user" });
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "window was closed",
  );
  expect(sdk.redirect).toHaveBeenCalledTimes(1);
});
it("supports email creation, verification, reset and friendly credential failures", async () => {
  app();
  await act(async () => changed(null));
  fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "fictional@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "fictional-test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() =>
    expect(sdk.verify).toHaveBeenCalledWith({ uid: "fictional" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Back to sign in" }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
  sdk.email.mockRejectedValueOnce({ code: "auth/invalid-credential" });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "fictional-wrong-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "email or password is incorrect",
  );
  expect(screen.getByLabelText("Password")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  await waitFor(() =>
    expect(sdk.reset).toHaveBeenCalledWith({}, "fictional@example.invalid"),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "If an account exists",
  );
  expect(localStorage.getItem("trade-notes-v1")).toBeNull();
  expect(sessionStorage.length).toBe(0);
});
it("does not expose raw Firebase error codes", () => {
  for (const code of [
    "auth/email-already-in-use",
    "auth/network-request-failed",
    "auth/weak-password",
    "auth/unknown",
  ])
    expect(authMessage({ code })).not.toContain("auth/");
});
it("explains Firebase project and OAuth configuration failures", () => {
  expect(authMessage({ code: "auth/invalid-api-key" })).toContain(
    "restart the dev server",
  );
  expect(authMessage({ code: "auth/configuration-not-found" })).toContain(
    "enable your sign-in providers",
  );
  expect(authMessage({ code: "auth/app-not-authorized" })).toContain(
    "same Firebase web app",
  );
  expect(authMessage({ code: "auth/invalid-oauth-client-id" })).toContain(
    "OAuth configuration",
  );
});

it("toggles passwords and shows short-password and rejected-signup errors", async () => {
  app();
  await act(async () => changed(null));
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
  fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "fictional@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "short" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Create account" }).closest("form")!,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("at least 8 characters");
  expect(sdk.signup).not.toHaveBeenCalled();
  sdk.signup.mockRejectedValueOnce({ code: "auth/email-already-in-use" });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "fictional-password" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Create account" }).closest("form")!,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "couldn't create an account",
  );
});

it("keeps missing-user reset responses neutral", async () => {
  app();
  await act(async () => changed(null));
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "fictional@example.invalid" },
  });
  sdk.reset.mockRejectedValueOnce({ code: "auth/user-not-found" });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "If an account exists",
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("keeps production configuration failures friendly and does not log diagnostic codes", () => {
  vi.stubEnv("DEV", false);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    expect(authMessage({ code: "auth/invalid-api-key" })).toBe(
      "Sign-in is temporarily unavailable. Please try again later.",
    );
    expect(warn).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllEnvs();
  }
});
