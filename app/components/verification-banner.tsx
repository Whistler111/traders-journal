import { useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { useAuth } from "./auth/AuthProvider";
import { accountVerified } from "../lib/account-security";
import { authMessage } from "../lib/firebase-errors";
export function VerificationBanner() {
  const { user, refreshVerification } = useAuth();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  if (!user || accountVerified(user)) return null;
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (error) {
      setError(authMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="import-summary" aria-label="Email verification">
      <p role="status">
        Verify your email before saving changes to your journal. Check your
        inbox for the verification link.
      </p>
      <div className="sync-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await sendEmailVerification(user!);
              setMessage("Verification email sent. Check your inbox.");
            })
          }
        >
          Resend verification
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (!(await refreshVerification()))
                setMessage(
                  "Your email is not verified yet. Open the link in your inbox, then check again.",
                );
            })
          }
        >
          I've verified my email
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
