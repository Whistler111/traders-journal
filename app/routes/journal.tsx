import { useState } from "react";
import { useOutletContext, useSearchParams } from "react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ImageIcon,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { useJournal } from "../components/provider";
import { FeedbackAnimation } from "../components/feedback";
import { filterTrades, money, outcome, rFormat, tone } from "../lib/journal";
import {
  outcomeLabel,
  priceFormat,
  tradeDate,
} from "../lib/trade-presentation";
import type { WorkspaceContext } from "./workspace";
export function meta() {
  return [{ title: "Trade Notes — Journal" }];
}
export default function Journal() {
  const { trades, error } = useJournal(),
    { edit, view } = useOutletContext<WorkspaceContext>(),
    [query, setQuery] = useState(""),
    [mistake, setMistake] = useState(""),
    [params, setParams] = useSearchParams();
  const filter = params.get("outcome") || "all",
    visible = filterTrades(trades, query, filter).filter(
      (t) => !mistake || t.journalReview?.mistakes.includes(mistake),
    );
  const tags = [
    ...new Set(trades.flatMap((t) => t.journalReview?.mistakes ?? [])),
  ].sort();
  return (
    <>
      <div className="page-heading" data-tour="journal">
        <div>
          <p className="eyebrow">A RECORD YOU CAN COME BACK TO</p>
          <h1>
            Trade journal <span className="count">{trades.length}</span>
          </h1>
          <p>The entry, the reason, the lesson. All in one place.</p>
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
      <section className="card journal-card" aria-label="Your trades">
        <div className="filters">
          {!!tags.length && (
            <select
              aria-label="Filter mistake tag"
              value={mistake}
              onChange={(e) => setMistake(e.target.value)}
            >
              <option value="">All mistake tags</option>
              {tags.map((tag) => (
                <option key={tag}>{tag}</option>
              ))}
            </select>
          )}
          <label className="search-field">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search trades"
              placeholder="Search a pair, setup or note"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter trade outcome"
            value={filter}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value === "all") next.delete("outcome");
              else next.set("outcome", e.target.value);
              setParams(next, { replace: true });
            }}
          >
            {["all", "open", "win", "loss", "breakeven"].map((v) => (
              <option key={v} value={v}>
                {
                  (
                    {
                      all: "All outcomes",
                      open: "Open trades",
                      win: "Profit",
                      loss: "Loss",
                      breakeven: "Breakeven",
                    } as Record<string, string>
                  )[v]
                }
              </option>
            ))}
          </select>
        </div>
        {!!visible.length && (
          <>
            <div className="journal-list-heading">
              <span>
                {visible.length} trade{visible.length === 1 ? "" : "s"}
                {filter !== "all" || query ? " found" : " recorded"}
              </span>
              <span>Small details. A clearer picture.</span>
            </div>
            <ul className="trade-list">
              {visible.map((t) => (
                <li key={t.id} className="trade-row">
                  <div className="trade-instrument">
                    <span className="instrument-mark" aria-hidden="true">
                      {t.direction === "Long" ? (
                        <ArrowUpRight size={20} />
                      ) : (
                        <ArrowDownLeft size={20} />
                      )}
                    </span>
                    <div>
                      <strong>{t.symbol}</strong>
                      <small>
                        {t.direction === "Long" ? "Buy / Long" : "Sell / Short"}
                      </small>
                    </div>
                  </div>
                  <div className="trade-date">
                    <span>{tradeDate(t.date)}</span>
                    <small>
                      {t.setup}
                      {!!t.screenshots?.length && (
                        <span className="inline-image-count">
                          <ImageIcon size={12} aria-hidden="true" />
                          {t.screenshots.length} screenshot
                          {t.screenshots.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </small>
                  </div>
                  <div className="trade-entry">
                    <span>Entry {priceFormat(t.entry)}</span>
                    <small>Risk {money(t.risk)} · USD</small>
                  </div>
                  <div className="trade-outcome">
                    <span className={"badge " + outcome(t)}>
                      {outcomeLabel(t)}
                    </span>
                    <span
                      className={
                        "trade-cash " +
                        (t.status === "closed" ? tone(t.pnl) : "")
                      }
                    >
                      {t.status === "closed" ? money(t.pnl) : "Awaiting close"}
                      {t.status === "closed" && (
                        <small>{rFormat(t.pnl! / t.risk)} · USD</small>
                      )}
                    </span>
                  </div>
                  <div className="trade-row-actions">
                    <button
                      type="button"
                      className="view-trade"
                      onClick={() => view(t)}
                      aria-label={`View ${t.symbol} trade on ${t.date}`}
                    >
                      View
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => edit(t)}
                      aria-label={`Edit ${t.symbol} trade on ${t.date}`}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {!visible.length && (
          <div className="empty">
            <FeedbackAnimation type="empty" loop />
            <h3>
              {error
                ? "Journal unavailable"
                : trades.length
                  ? "No matching trades."
                  : "Your next trade has a story."}
            </h3>
            <p>
              {error
                ? "Restore a valid backup using Manage data."
                : trades.length
                  ? "Try another search or outcome filter."
                  : "Start with what you saw, why you entered, and what you risked."}
            </p>
            {!trades.length && !error && (
              <button className="primary" onClick={() => edit()}>
                <Plus size={16} aria-hidden="true" />
                Log your first trade
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
