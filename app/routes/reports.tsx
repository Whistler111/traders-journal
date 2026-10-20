import { FeedbackAnimation } from "../components/feedback";
import { PnlCalendar } from "../components/pnl-calendar";
import { download } from "../lib/download";
import { WeeklyBehavior } from "../components/behavior-summary";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router";
import { useJournal } from "../components/provider";
import {
  groupedMetrics,
  holdGroup,
  metrics,
  sessionAt,
  timeParts,
} from "../lib/analytics";
import { csv, money, percent, rFormat } from "../lib/journal";
import type { WorkspaceContext } from "./workspace";
export default function Reports() {
  const { trades, range, practice } = useJournal(),
    { view, edit } = useOutletContext<WorkspaceContext>();
  const zone =
    practice.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [group, setGroup] = useState("setup");
  const s = useMemo(() => metrics(trades), [trades]);
  const groups = useMemo(
    () =>
      groupedMetrics(trades, (t) =>
        group === "pair"
          ? t.symbol
          : group === "direction"
            ? t.direction
            : group === "hold"
              ? holdGroup(t)
              : group === "weekday"
                ? timeParts(t, zone).weekday
                : group === "hour"
                  ? String(timeParts(t, zone).hour).padStart(2, "0") + ":00"
                  : group === "session"
                    ? sessionAt(timeParts(t, zone).hour)
                    : t.setup,
      ),
    [trades, group, zone],
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Reports</h1>
          <button
            onClick={() =>
              download(csv(trades), "text/csv;charset=utf-8", "csv")
            }
          >
            Export selected range as CSV
          </button>
          <p>
            Realized results from the loaded range. Breakeven trades count in
            win rate; open trades are excluded from financial metrics.
          </p>
        </div>
      </div>
      <section className="card">
        <h2>Performance</h2>
        <dl className="report-metrics">
          {Object.entries({
            "Net P&L": money(s.net),
            "Win rate": percent(s.winRate),
            "Profit factor": s.noLosses
              ? "No losses"
              : (s.profitFactor?.toFixed(2) ?? "—"),
            Expectancy: money(s.expectancy),
            "Average win": money(s.averageWin),
            "Average loss": money(s.averageLoss),
            "Largest win": money(s.largestWin),
            "Largest loss": money(s.largestLoss),
            "Max drawdown": money(s.drawdown),
            "Longest win streak": s.winStreak,
            "Longest loss streak": s.lossStreak,
            Discipline: percent(s.discipline),
          }).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="card">
        <h2>Breakdown</h2>
        <label>
          Grouping
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {[
              "pair",
              "session",
              "weekday",
              "hour",
              "direction",
              "setup",
              "hold",
            ].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <p>Timezone: {zone} (change in Settings).</p>
        <p className="footnote">
          Session windows in this timezone: Asia 00–08, London 08–13, New York
          13–22; 22–24 outside sessions. Legacy trades without an offset use
          this device's original local interpretation. Hold time needs a
          recorded close time.
        </p>
        <div className="table-wrap">
          <table role="table">
            <thead>
              <tr>
                {[
                  "Group",
                  "Count",
                  "Net P&L",
                  "Win rate",
                  "Profit factor",
                  "Average R",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.label}>
                  <td data-label="Group">{g.label}</td>
                  <td data-label="Closed trades">{g.count}</td>
                  <td data-label="Net P&L">{money(g.net)}</td>
                  <td data-label="Win rate">{percent(g.winRate)}</td>
                  <td data-label="Profit factor">
                    {g.noLosses
                      ? "No losses"
                      : (g.profitFactor?.toFixed(2) ?? "—")}
                  </td>
                  <td data-label="Average R">{rFormat(g.averageR)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!trades.length && <div className="empty"><FeedbackAnimation type="empty" loop/><h3>Nothing to chart yet</h3><p>No trades in this range.</p><button onClick={()=>edit()}>Add a trade</button></div>}
      </section>
      <WeeklyBehavior />
      <PnlCalendar trades={trades} range={range} zone={zone} onView={view} />
    </>
  );
}
