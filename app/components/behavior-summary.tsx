import { useJournal } from "./provider";
import { riskWarnings } from "../lib/behavior";
import { timeParts } from "../lib/analytics";
export function TradeFlags({ id }: { id: string }) {
  const { flags } = useJournal();
  return (
    <>
      {flags.get(id)?.map((flag) => (
        <span className="behavior-flag" key={flag}>
          {flag}
        </span>
      ))}
    </>
  );
}
export function RiskBanner() {
  const { trades, loadedTrades, practice, range } = useJournal();
  const zone =
    practice.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const warnings = riskWarnings(
    loadedTrades ?? trades,
    practice.riskRules ?? {},
    zone,
  );
  return warnings.length ? (
    <aside className="risk-banner" role="status">
      <strong>A moment to review</strong>
      {warnings.map((w) => (
        <p key={w}>{w}</p>
      ))}
      <small>
        Based on loaded records ({range.from}–{range.to}). Saving is always
        available.
      </small>
    </aside>
  ) : null;
}
export function WeeklyBehavior() {
  const { trades, practice, range } = useJournal();
  const zone =
    practice.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const end = new Date(range.to + "T12:00:00Z"),
    start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const from = start.toISOString().slice(0, 10);
  const { flags } = useJournal();
  const rows = trades.filter((t) => {
    const day = timeParts(t, zone).day;
    return day >= from && day <= range.to;
  });
  return (
    <section className="card">
      <h2>Weekly behavior review</h2>
      <p>
        {from}–{range.to}, from loaded records. Flags are prompts for
        reflection, not a diagnosis. Close time and comparable size are required
        for revenge/tilt flags.
      </p>
      {["Revenge trade", "Overtrading", "Tilt streak"].map((flag) => (
        <p key={flag}>
          {flag}: {rows.filter((t) => flags.get(t.id)?.includes(flag)).length}
        </p>
      ))}
    </section>
  );
}
