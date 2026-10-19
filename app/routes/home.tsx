import { Link, useOutletContext } from "react-router";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarDays,
  CircleDot,
  Plus,
  Quote,
  Scale,
  Target,
  Wallet,
} from "lucide-react";
import { useJournal } from "../components/provider";
import { Counter } from "../components/feedback";
import { PerformanceChart } from "../components/performance-chart";
import {
  money,
  percent,
  rFormat,
  stats,
  tone,
  weekCount,
  unpackNotes,
} from "../lib/journal";
import type { WorkspaceContext } from "./workspace";
import { AccountSignOut } from "../components/account-sign-out";
export function meta() {
  return [
    { title: "Trade Notes — Overview" },
    {
      name: "description",
      content:
        "A personal trading journal for thoughtful execution and clear performance review.",
    },
  ];
}
export default function Overview() {
  const { trades, error } = useJournal(),
    { edit, view } = useOutletContext<WorkspaceContext>(),
    s = stats(trades);
  const open = trades
    .filter((t) => t.status === "open")
    .sort((a, b) => b.date.localeCompare(a.date));
  const reflection = [...s.closed]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => unpackNotes(t.lesson).notes.trim());
  const cards = [
    {
      title: "Total P&L",
      Icon: Wallet,
      value: s.cash,
      format: money,
      sub: "Net realized · USD · after fees",
      tone: tone(s.cash),
    },
    {
      title: "Win rate",
      Icon: Target,
      value: s.win,
      format: percent,
      sub: `${s.n} closed trades · includes breakevens`,
    },
    {
      title: "Avg realized R",
      Icon: Scale,
      value: s.avg,
      format: rFormat,
      sub: "Mean of each closed trade’s net P&L ÷ initial risk",
      tone: tone(s.avg),
    },
    {
      title: "Trades this week",
      Icon: CalendarDays,
      value: weekCount(trades),
      format: (v: number | null) => String(Math.round(v ?? 0)),
      sub: "Trade dates · local Monday–Sunday",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR JOURNAL. YOUR PACE.</p>
          <h1>Make every trade a lesson.</h1>
          <p>
            A little space to remember your plan and learn from your decisions.
          </p>
        </div>
        <button
          className="primary"
          aria-label="+ Log a trade"
          disabled={!!error}
          onClick={() => edit()}
        >
          <Plus size={17} aria-hidden="true" />
          Log a trade
        </button>
      </div>
      <section className="stats" aria-label="Performance summary">
        {cards.map((c) => (
          <article key={c.title} className="card">
            <div className="stat-title">
              <h2>{c.title}</h2>
              <c.Icon size={17} aria-hidden="true" />
            </div>
            <strong className={"key-number " + (c.tone ?? "")}>
              <Counter value={error ? null : c.value} format={c.format} />
            </strong>
            <p>{c.sub}</p>
          </article>
        ))}
      </section>
      {!error && !!open.length && (
        <section className="open-trades" aria-label="Your open trades">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <CircleDot size={13} aria-hidden="true" />
                KEEP YOUR PLAN CLOSE
              </p>
              <h2>
                Your open trades <span className="count">{open.length}</span>
              </h2>
            </div>
            <Link className="text-link" to="/journal?outcome=open">
              View all
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="pocket-grid">
            {open.slice(0, 3).map((t) => (
              <button
                key={t.id}
                type="button"
                className="pocket-trade"
                aria-label={`Preview open ${t.symbol} trade on ${t.date}`}
                onClick={() => view(t)}
              >
                <span className="pocket-top">
                  <span className="instrument-mark" aria-hidden="true">
                    {t.direction === "Long" ? (
                      <ArrowUpRight size={19} />
                    ) : (
                      <ArrowDownLeft size={19} />
                    )}
                  </span>
                  <strong>{t.symbol}</strong>
                  <span className="status-pill is-open">
                    <span className="live-dot" />
                    Open
                  </span>
                </span>
                <span className="pocket-reason">{t.reason}</span>
                <span className="pocket-bottom">
                  <span>
                    {t.direction === "Long" ? "Buy / Long" : "Sell / Short"} ·{" "}
                    {money(t.risk)} risk
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
          <p className="pocket-caption">
            Your saved entry reasons · no live price or unrealized result
          </p>
        </section>
      )}
      <section className="card chart-card">
        <div className="section-heading">
          <div>
            <h2>Cumulative realized P&L</h2>
            <p>Starts at $0 · ordered by recorded trade date, not close time</p>
          </div>
          <span className="tag">Closed trades only</span>
        </div>
        <div className="chart">
          {error ? (
            <p>Restore readable data to view performance.</p>
          ) : (
            <PerformanceChart trades={trades} />
          )}
        </div>
        <p className="footnote">
          This is cumulative profit and loss, not account balance. The legacy
          format has no close timestamps or currency conversion; record USD
          results only.
        </p>
      </section>
      {!error && reflection && (
        <aside className="reflection-note">
          <Quote size={19} aria-hidden="true" />
          <div>
            <span className="note-label">
              A note to come back to · {reflection.symbol}
            </span>
            <p>{unpackNotes(reflection.lesson).notes}</p>
          </div>
          <button
            className="icon-button"
            aria-label={`View reflection for ${reflection.symbol}`}
            onClick={() => view(reflection)}
          >
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </aside>
      )}
      <AccountSignOut />
    </>
  );
}
