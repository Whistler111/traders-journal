import { ThemeToggle } from "../components/theme-toggle";
import { useState } from "react";
import { PracticeHub } from "../components/practice-hub";
import { useJournal } from "../components/provider";
import { validatePractice } from "../lib/practice";
export default function Settings() {
  const { practice, savePractice, notify } = useJournal();
  const [zone, setZone] = useState(
    practice.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ["dailyLoss", "referenceBalance", "maxTrades", "maxLosses"].map((k) => [
        k,
        String(
          practice.riskRules?.[k as keyof typeof practice.riskRules] ?? "",
        ),
      ]),
    ),
  );
  const [mode, setMode] = useState<"amount" | "percent">(
      practice.riskRules?.dailyLossMode ?? "amount",
    ),
    [busy, setBusy] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
          <p>Setups are playbooks: each saved trade keeps its own checklist.</p>
        </div>
      </div>
      <section className="card appearance-settings">
        <div>
          <h2>Appearance</h2>
          <p>Follow your system, or choose light or dark.</p>
        </div>
        <ThemeToggle />
      </section>
      <section className="card">
        <h2>Timezone & risk rules</h2>
        <p>
          Warnings only. Blank limits are disabled. Percentage limits use your
          manually entered reference balance, not an estimated account equity.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const riskRules = {
                dailyLossMode: mode,
                ...Object.fromEntries(
                  Object.entries(values)
                    .filter(([, v]) => v.trim())
                    .map(([k, v]) => [k, Number(v)]),
                ),
              };
              await savePractice(
                validatePractice({ ...practice, timezone: zone, riskRules }),
              );
              notify("Settings saved.");
            } catch (err) {
              notify((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset className="form-grid" disabled={busy}>
            <label>
              IANA timezone
              <input
                required
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="Africa/Lagos"
              />
            </label>
            <label>
              Daily loss limit mode
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="amount">USD amount</option>
                <option value="percent">Percent of reference balance</option>
              </select>
            </label>
            {Object.entries({
              dailyLoss:
                mode === "amount"
                  ? "Daily loss limit (USD)"
                  : "Daily loss limit (%)",
              referenceBalance: "Reference balance (USD)",
              maxTrades: "Maximum trades per day",
              maxLosses: "Maximum consecutive losses",
            }).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min="0.01"
                  step={key.startsWith("max") ? 1 : "any"}
                  value={values[key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </fieldset>
          <button disabled={busy}>Save settings</button>
        </form>
      </section>
      <PracticeHub />
    </>
  );
}
