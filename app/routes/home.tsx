import { useMemo, useState, type CSSProperties } from "react";
import { Link, useOutletContext } from "react-router";
import { Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useJournal } from "../components/provider";
import { Counter, FeedbackAnimation } from "../components/feedback";
import { PerformanceChart } from "../components/performance-chart";
import { PnlCalendar } from "../components/pnl-calendar";
import { metrics } from "../lib/analytics";
import {
  money,
  percent,
  rFormat,
  tone,
  stats,
  unpackNotes,
  weekCount,
} from "../lib/journal";
import { AccountSignOut } from "../components/account-sign-out";
import type { WorkspaceContext } from "./workspace";
export function meta() {
  return [{ title: "Trade Notes — Dashboard" }];
}
const ratio = (n: number | null) => (n === null ? "—" : n.toFixed(2));
function Sparkline({ values }: { values: (number | null)[] }) {
  const data = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (data.length < 2)
    return (
      <svg className="sparkline" viewBox="0 0 120 30" aria-hidden="true">
        <path d="M0 23H120" />
      </svg>
    );
  const low = Math.min(...data),
    span = Math.max(1, Math.max(...data) - low);
  return (
    <svg className="sparkline" viewBox="0 0 120 30" aria-hidden="true">
      <polyline
        points={data
          .map(
            (n, i) =>
              `${(i / (data.length - 1)) * 120},${26 - ((n - low) / span) * 22}`,
          )
          .join(" ")}
      />
    </svg>
  );
}
export default function Overview() {
  const {
      trades,
      comparisonTrades = [],
      error,
      range,
      practice,
    } = useJournal(),
    { edit, view } = useOutletContext<WorkspaceContext>(),
    [query, setQuery] = useState("");
  const result = useMemo(() => metrics(trades), [trades]),
    previous = useMemo(() => metrics(comparisonTrades), [comparisonTrades]);
  const fields = (m: ReturnType<typeof metrics>) => [
    m.count ? m.net : null,
    m.winRate,
    m.profitFactor,
    m.averageWin !== null && m.averageLoss !== null
      ? m.averageWin / Math.abs(m.averageLoss)
      : null,
    m.discipline,
  ];
  const currentValues = fields(result),
    previousValues = fields(previous);
  const series = useMemo(() => {
    const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date));
    return Array.from({ length: 12 }, (_, i) =>
      fields(
        metrics(ordered.slice(0, Math.ceil((ordered.length * (i + 1)) / 12))),
      ),
    );
  }, [trades]);
  const cards = [
    { label: "Net P&L", format: money, caption: "Realized · after fees" },
    { label: "Win rate", format: percent, caption: "Breakevens included" },
    {
      label: "Profit factor",
      format: ratio,
      caption: result.noLosses
        ? "No losses in this period"
        : "Gross wins / gross losses",
    },
    {
      label: "Avg win / loss",
      format: ratio,
      caption: "Average winning / losing trade",
    },
    {
      label: "Discipline score",
      format: percent,
      caption: "Full checklist completed",
    },
  ];
  const recent = [...trades]
    .filter((t) =>
      `${t.symbol} ${t.setup}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  const open = trades.filter((t) => t.status === "open"),
    s = stats(trades);
  const reflection = [...s.closed]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => unpackNotes(t.lesson).notes.trim());
  return (
    <>
      <div className="page-heading dashboard-heading" data-tour="overview">
        <div>
          <p className="eyebrow">YOUR EDGE, IN PERSPECTIVE</p>
          <h1>Dashboard</h1>
          <p>A clearer view of your performance and process.</p>
        </div>
        <button
          className="primary desktop-add"
          aria-label="+ Log a trade"
          disabled={!!error}
          onClick={() => edit()}
        >
          <Plus size={17} />
          Add trade <kbd>N</kbd>
        </button>
      </div>
      <section className="dashboard-stats" aria-label="Performance summary">
        {cards.map((c, i) => {
          const value = currentValues[i],
            prior = previousValues[i],
            delta = value !== null && prior !== null ? value - prior : null;
          return (
            <article key={c.label} className="card metric-tile">
              <div className="stat-title">
                <h2>{c.label}</h2>
                <span className="metric-dot" />
              </div>
              <strong className={"key-number " + (i === 0 ? tone(value) : "")} title={c.format(value)} style={{"--number-scale":Math.max(5,c.format(value).length)*0.64} as CSSProperties}>
                <Counter value={error ? null : value} format={c.format} />
              </strong>
              <div className="metric-trend">
                <small className={delta === null ? "" : tone(delta)}>
                  {delta === null
                    ? "No previous-period baseline"
                    : `${delta >= 0 ? "+" : ""}${i === 1 || i === 4 ? (delta * 100).toFixed(1) + " pp" : i === 0 ? money(delta) : delta.toFixed(2)}`}{" "}
                  {delta !== null && "vs previous"}
                </small>
                <Sparkline values={series.map((row) => row[i])} />
              </div>
              <p>{c.caption}</p>
            </article>
          );
        })}
      </section>
      <div className="dashboard-charts">
        <section className="card chart-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE BIGGER PICTURE</p>
              <h2>Equity curve</h2>
              <p>Cumulative realized P&L · starts at $0</p>
            </div>
            <span className="tag">{result.count} closed</span>
          </div>
          <div className="chart">
            <PerformanceChart trades={error ? [] : trades} />
          </div>
          <p className="chart-legend">
            <i className="equity-dot" />
            Realized P&L <i className="drawdown-dot" />
            Drawdown from running peak
          </p>
          <p className="footnote">
            P&L, not account balance. Avg realized R: {rFormat(s.avg)}.{" "}
            {weekCount(trades)} trades this week. Comparison uses an equally
            long preceding period with the same filters.
          </p>
        </section>
        <PnlCalendar
          trades={trades}
          range={range}
          zone={
            practice.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone
          }
          onView={view}
        />
      </div>
      <section className="card recent-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR LATEST DECISIONS</p>
            <h2>Recent trades</h2>
          </div>
          <Link className="text-link" to="/journal">
            View journal <ArrowUpRight size={15} />
          </Link>
        </div>
        <label className="recent-search">
          <span className="sr-only">Quick filter recent trades</span>
          <input
            type="search"
            placeholder="Filter by pair or setup…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="recent-table">
          <div className="recent-head">
            <span>Pair / direction</span>
            <span>Setup</span>
            <span>Date</span>
            <span>Net P&L</span>
          </div>
          {recent.map((t) => (
            <button
              key={t.id}
              className="recent-row"
              onClick={() => view(t)}
              aria-label={`View ${t.symbol} trade on ${t.date}`}
            >
              <span className="recent-pair">
                <i
                  className={
                    "pair-icon " +
                    (t.direction === "Long" ? "positive" : "negative")
                  }
                >
                  {t.direction === "Long" ? (
                    <ArrowUpRight size={18} />
                  ) : (
                    <ArrowDownRight size={18} />
                  )}
                </i>
                <span>
                  <strong>{t.symbol}</strong>
                  <small>{t.direction}</small>
                </span>
              </span>
              <span className="recent-setup">{t.setup}</span>
              <span className="recent-date">{t.date.slice(0, 10)}</span>
              <strong className={tone(t.pnl)}>
                {t.status === "open" ? "Open" : money(t.pnl)}
              </strong>
            </button>
          ))}
        </div>
        {!recent.length && (
          <div className="empty">
            <FeedbackAnimation type="empty" loop />
            <h3>
              {query
                ? "No matching trades"
                : "A fresh page for your next decision"}
            </h3>
            <p>
              {query
                ? "Try another pair or setup."
                : "Record a trade to start seeing your patterns."}
            </p>
            <button onClick={() => (query ? setQuery("") : edit())}>
              {query ? "Clear filter" : "Add your first trade"}
            </button>
          </div>
        )}
      </section>
      {!!open.length && (
        <section className="card open-trades">
          <h2>
            Your open trades <span className="count">{open.length}</span>
          </h2>
          <div className="pocket-grid">
            {open.slice(0, 3).map((t) => (
              <button
                className="pocket-trade"
                key={t.id}
                aria-label={`Preview open ${t.symbol} trade on ${t.date}`}
                onClick={() => view(t)}
              >
                <strong>{t.symbol}</strong>
                <p>{t.reason}</p>
                <small>
                  {t.direction} · {money(t.risk)} initial risk
                </small>
              </button>
            ))}
          </div>
        </section>
      )}
      {reflection && (
        <aside className="reflection-note">
          <div>
            <span className="note-label">
              A note to come back to - {reflection.symbol}
            </span>
            <p>{unpackNotes(reflection.lesson).notes}</p>
          </div>
          <button
            onClick={() => view(reflection)}
            aria-label={`View reflection for ${reflection.symbol}`}
          >
            Review reflection
          </button>
        </aside>
      )}
      <AccountSignOut />
    </>
  );
}
