import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "./auth/AuthProvider";
import { authMessage } from "../lib/firebase-errors";
export function AccountSignOut() {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="dashboard-account" aria-label="Account access">
      <div>
        <strong>All done for now?</strong>
        <p>Your confirmed saves stay in your account.</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await signOut();
          } catch (e) {
            setError(authMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <LogOut size={16} aria-hidden="true" />
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
