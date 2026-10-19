import { useState } from "react";
import { Link, Navigate } from "react-router";
import { BookOpen, LockKeyhole } from "lucide-react";
import { AuthHero } from "../components/auth/AuthHero";
import { AuthLoading, useAuth } from "../components/auth/AuthProvider";
import { authMessage } from "../lib/firebase-errors";
import { ThemeToggle } from "../components/theme-toggle";
import "../components/auth/auth.css";
export function meta() {
  return [{ title: "Sign in - Trade Notes" }];
}
export default function Login() {
  const auth = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  if (auth.loading) return <AuthLoading />;
  if (auth.user) return <Navigate to="/" replace />;
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  function changeMode(next: typeof mode) {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
  }
  return (
    <main className="auth-page">
      <div className="auth-top">
        <Link className="auth-brand" to="/">
          <BookOpen size={22} />
          Trade Notes
        </Link>
        <ThemeToggle />
      </div>
      <div className="auth-layout">
        <section className="auth-intro">
          <div className="auth-intro-copy">
            <p className="eyebrow">A LITTLE CLARITY, EVERY DAY</p>
            <h1>
              Keep the lesson.
              <br />
              Grow with every trade.
            </h1>
            <p>Your plan, your progress, your space to reflect.</p>
          </div>
          <AuthHero />
        </section>
        <section className="auth-form-panel" aria-labelledby="login-title">
          <p className="eyebrow">YOUR TRADING SPACE</p>
          <h2 id="login-title">
            {mode === "signup"
              ? "Make it your own."
              : mode === "reset"
                ? "A fresh start."
                : "Welcome back."}
          </h2>
          <p className="auth-form-intro">
            {mode === "reset"
              ? "We'll email you a password reset link."
              : "Your journal, safely in your account."}
          </p>
          {mode !== "reset" && (
            <button
              type="button"
              className="auth-google"
              disabled={busy || !!auth.error}
              onClick={() => void run(auth.signInWithGoogle)}
            >
              Continue with Google
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (mode === "reset") {
                  await auth.resetPassword(email);
                  setMessage(
                    "If an account exists for this email, a password reset link is on its way.",
                  );
                } else if (mode === "signup") {
                  await auth.signUpWithEmail(email, password);
                } else {
                  await auth.signInWithEmail(email, password);
                }
              });
            }}
          >
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
            {mode !== "reset" && (
              <>
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  inputMode="text"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  maxLength={512}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </>
            )}
            <button
              type="submit"
              className="primary"
              disabled={busy || !!auth.error}
            >
              {busy
                ? "Please wait..."
                : mode === "reset"
                  ? "Send reset link"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
            </button>
          </form>
          {(error || auth.error) && (
            <p role="alert" className="error">
              {error || auth.error}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          <div className="auth-mode-actions">
            {mode === "signin" ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeMode("reset")}
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeMode("signup")}
                >
                  Create an account
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => changeMode("signin")}
              >
                Back to sign in
              </button>
            )}
          </div>
          <p className="auth-security">
            <LockKeyhole size={14} aria-hidden="true" />
            Private to your account. Ready on your devices.
          </p>
          <Link to="/about">About Trade Notes</Link>
        </section>
      </div>
    </main>
  );
}
