import { useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { useAuth } from "../components/auth/AuthProvider";
import { useJournal } from "../components/provider";
import { authMessage } from "../lib/firebase-errors";
export function meta() {
  return [{ title: "Trade Notes - Account & connections" }];
}
export default function Connections() {
  const { user, signOut } = useAuth();
  const { trades, deviceImportAvailable, importFromDevice } = useJournal();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failure, setFailure] = useState("");
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setFailure("");
    try {
      await work();
    } catch (e) {
      setFailure(authMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR RECORDS, UNDER YOUR CONTROL</p>
          <h1>Account & connections</h1>
          <p>Your trades and reflections sync to your private account.</p>
        </div>
      </div>
      <section
        className="card sync-panel"
        aria-label="Your account"
        data-tour="account"
      >
        <h2>Your trading space</h2>
        <p className="sync-state">
          {user?.email || user?.displayName || "Signed in"} - {trades.length}{" "}
          trades
        </p>
        <p className="footnote">
          Firestore stores your journal and screenshots under your account. A
          save is confirmed only after the server accepts it. Download JSON
          backups for an independent copy.
        </p>
        {user && !user.emailVerified && (
          <div className="import-summary">
            <p>
              Please verify your email using the link sent when you signed up.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await sendEmailVerification(user);
                  setMessage("Verification email sent. Check your inbox.");
                })
              }
            >
              Resend verification
            </button>
          </div>
        )}
        <div className="sync-actions">
          {deviceImportAvailable && (
            <button disabled={busy} onClick={() => void run(importFromDevice)}>
              Import trades from this device
            </button>
          )}
          <button disabled={busy} onClick={() => void run(signOut)}>
            Sign out
          </button>
        </div>
        {failure && (
          <p role="alert" className="error">
            {failure}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </section>
      <section className="card" aria-label="Broker synchronization">
        <div className="section-heading">
          <div>
            <h2>Broker synchronization</h2>
            <p className="sync-state">
              Connect the platform you actually trade with.
            </p>
          </div>
          <span className="tag">MT5 + TradingView</span>
        </div>
        <h3>MetaTrader 5 - execution history</h3>
        <p className="sync-state">
          Automatic sync is not connected yet. The next connector will read
          executions from your signed-in Windows MT5 terminal and stage them for
          review before adding them to your journal. Broker passwords should
          stay in MT5.
        </p>
        <p className="footnote">
          Partial closes, commissions, swaps and fees must be reconciled against
          the broker result. Original cash risk and entry reasons still need
          your confirmation. A trailing stop cannot establish the original risk.
        </p>
        <h3>TradingView - charts and trade context</h3>
        <p className="sync-state">
          Use TradingView alongside your journal for chart analysis. Its free
          chart widget cannot run this React journal as an indicator or receive
          your private executions. A companion Pine indicator would be a
          separate implementation.
        </p>
        <div className="sync-actions">
          <a
            href="https://www.tradingview.com/chart/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open TradingView
          </a>
          <a
            href="https://www.mql5.com/en/docs/python_metatrader5/mt5initialize_py"
            target="_blank"
            rel="noopener noreferrer"
          >
            MT5 terminal connection documentation
          </a>
        </div>
        <p className="footnote">
          For now, use Manage data / Import CSV for completed trade records,
          with timezone selection and duplicate review. Raw MT5 deals or
          TradingView order history need reconciliation first; they are not
          automatically equivalent to completed journal trades.
        </p>
      </section>
    </>
  );
}
