import { groupedMetrics, metrics } from "../lib/analytics";
import { useState } from "react";
import { hasTradeReview } from "../lib/review-progress";
import { PracticeHub } from "../components/practice-hub";
import { useJournal } from "../components/provider";
import { percent, rFormat, stats, tone, type Trade } from "../lib/journal";
export function meta() {
  return [{ title: "Trade Notes — Review" }];
}
export default function Review() {
  const { trades, error } = useJournal(),
    [group, setGroup] = useState<
      "setup" | "session" | "followed" | "playbook" | "mistake"
    >("setup"),
    s = stats(trades),
    reviewed = s.closed.filter(hasTradeReview).length;
  const groups = new Map<string, { label: string; trades: Trade[] }>();
  for (const t of s.closed) {
    const labels =
      group === "mistake"
        ? t.journalReview?.mistakes.length
          ? t.journalReview.mistakes
          : ["No mistake tagged"]
        : [
            group === "playbook"
              ? t.journalReview?.playbookName || "No playbook"
              : group === "followed"
                ? {
                    yes: "Followed plan",
                    no: "Did not follow plan",
                    unsure: "Not sure",
                  }[t.followed]
                : t[group].trim(),
          ];
    for (const label of labels) {
      const key = label.toLowerCase();
      if (!groups.has(key)) groups.set(key, { label, trades: [] });
      groups.get(key)!.trades.push(t);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">REFLECTION OVER REACTION</p>
          <h1>Playbooks & review</h1>
          <p>Understand your process alongside your results.</p>
        </div>
      </div>
      <PracticeHub />
      <section className="card">
        <h2>Setup results</h2>
        <p>
          Discipline: {percent(metrics(trades).discipline)} of trades have a
          fully completed, nonempty checklist.
        </p>
        <div className="table-wrap">
          <table role="table">
            <thead>
              <tr>
                {[
                  "Setup",
                  "Count",
                  "Win rate",
                  "Profit factor",
                  "Average R",
                  "Net P&L",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedMetrics(trades, (t) => t.setup).map((g) => (
                <tr key={g.label}>
                  <td data-label="Setup">{g.label}</td>
                  <td data-label="Closed trades">{g.count}</td>
                  <td data-label="Win rate">{percent(g.winRate)}</td>
                  <td data-label="Profit factor">
                    {g.noLosses
                      ? "No losses"
                      : (g.profitFactor?.toFixed(2) ?? "?")}
                  </td>
                  <td data-label="Average R">{rFormat(g.averageR)}</td>
                  <td data-label="Net P&L">{g.net.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Make space for reflection</h2>
            <p>Read your notes alongside your results.</p>
          </div>
          <select
            aria-label="Group review"
            value={group}
            onChange={(e) => setGroup(e.target.value as typeof group)}
          >
            <option value="setup">By setup</option>
            <option value="session">By session</option>
            <option value="followed">By plan adherence</option>
            <option value="playbook">By playbook</option>
            <option value="mistake">By mistake tag</option>
          </select>
        </div>
        {error ? (
          <p>Restore readable data before reviewing performance.</p>
        ) : (
          <>
            <div className="review-summary">
              <div>
                <strong>
                  {reviewed} / {s.n} closed trades reviewed
                </strong>
                <progress
                  value={reviewed}
                  max={Math.max(1, s.n)}
                  aria-label="Closed trades with reflection and plan review"
                />
                <p>
                  {s.n === 0
                    ? "No trading target to reach. Reflect when you have a decision to review."
                    : "A review includes a written reflection and whether you followed your plan. There is no trade-count target."}
                </p>
              </div>
              <div>
                <span>Plan adherence</span>
                <strong>{percent(s.adherence)}</strong>
              </div>
              <div>
                <span>Total realized R</span>
                <strong className={tone(s.total)}>{rFormat(s.total)}</strong>
              </div>
            </div>
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Pattern comparison table"
            >
              <table role="table">
                <thead>
                  <tr>
                    {[
                      "Group",
                      "Closed trades",
                      "Win rate",
                      "Total realized R",
                      "Avg realized R",
                    ].map((v) => (
                      <th scope="col" key={v}>
                        {v}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...groups.values()]
                    .sort((a, b) => b.trades.length - a.trades.length)
                    .map((g) => {
                      const s = stats(g.trades);
                      return (
                        <tr key={g.label}>
                          <td data-label="Group">{g.label}</td>
                          <td data-label="Closed trades">
                            {s.n}
                            {s.n < 10 && <small>Small sample</small>}
                          </td>
                          <td data-label="Win rate">{percent(s.win)}</td>
                          <td data-label="Total R" className={tone(s.total)}>{rFormat(s.total)}</td>
                          <td data-label="Average R" className={tone(s.avg)}>{rFormat(s.avg)}</td>
                        </tr>
                      );
                    })}
                  {!groups.size && (
                    <tr>
                      <td colSpan={5}>
                        Closed-trade patterns appear here when records are
                        available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="footnote">
          {group === "mistake" &&
            "A trade with several mistake tags appears in each relevant group. "}
          Win rate = profitable closed trades ÷ all closed trades, including
          breakevens. Average realized R is the mean of individual net P&L ÷
          initial cash risk. Open trades are excluded. Small groups are
          observations, not proof of an edge.
        </p>
      </section>
    </>
  );
}
