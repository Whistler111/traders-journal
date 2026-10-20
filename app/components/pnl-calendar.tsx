import { useMemo, useState } from "react";
import { money, type Trade } from "../lib/journal";
import { metrics, timeParts } from "../lib/analytics";
export function PnlCalendar({
  trades,
  range,
  zone,
  onView,
}: {
  trades: Trade[];
  range: { from: string; to: string };
  zone: string;
  onView: (t: Trade) => void;
}) {
  const [month, setMonth] = useState(range.to.slice(0, 7)),
    [day, setDay] = useState("");
  const days = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of trades) {
      const key = timeParts(
        t.closedAt ? { ...t, sourceTimestamp: t.closedAt } : t,
        zone,
      ).day;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [trades, zone]);
  const count = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5)),
      0,
    ).getDate(),
    offset = new Date(month + "-01T12:00").getDay();
  const maximum = Math.max(
    1,
    ...[...days.values()].map((rows) => Math.abs(metrics(rows).net)),
  );
  return (
    <section className="card calendar-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">DAY BY DAY</p>
          <h2>P&L calendar</h2>
        </div>
        <label className="calendar-month">
          <span className="sr-only">Month</span>
          <input
            type="month"
            value={month}
            required
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value);
            }}
          />
        </label>
      </div>
      <div className="pnl-calendar">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="calendar-weekday">
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={"blank" + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const key = `${month}-${String(i + 1).padStart(2, "0")}`,
            rows = days.get(key) ?? [],
            net = metrics(rows).net,
            loaded = key >= range.from && key <= range.to;
          return (
            <button
              key={key}
              aria-label={`${key}: net P&L ${money(net)}, ${rows.length} trades`}
              disabled={!loaded}
              aria-pressed={day === key}
              onClick={() => setDay(day === key ? "" : key)}
              className={net > 0 ? "day-profit" : net < 0 ? "day-loss" : ""}
              style={
                net
                  ? {
                      background: `color-mix(in srgb, var(${net > 0 ? "--profit" : "--loss"}) ${10 + (30 * Math.abs(net)) / maximum}%, var(--surface))`,
                    }
                  : undefined
              }
            >
              <strong>{i + 1}</strong>
              <small>
                {loaded
                  ? net
                    ? new Intl.NumberFormat("en", {
                        notation: "compact",
                        maximumFractionDigits: 0,
                      }).format(net)
                    : "—"
                  : "·"}
              </small>
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>
          <i className="profit-dot" />
          Profit
        </span>
        <span>
          <i className="loss-dot" />
          Loss
        </span>
        <small>Recorded close day; entry day if unavailable</small>
      </div>
      {day && (
        <div className="calendar-drilldown">
          <h3>{day}</h3>
          {(days.get(day) ?? []).map((t) => (
            <button key={t.id} onClick={() => onView(t)}>
              <span>
                {t.symbol} <small>{t.direction}</small>
              </span>
              <strong>{money(t.pnl)}</strong>
            </button>
          ))}
          {!days.get(day)?.length && <p>No trades recorded on this day.</p>}
        </div>
      )}
    </section>
  );
}
