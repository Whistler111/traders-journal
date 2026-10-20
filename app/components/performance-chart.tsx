import { money, stats, cumulativeRealized, type Trade } from "../lib/journal";
import { useEffect, useRef, useState } from "react";
import { FeedbackAnimation } from "./feedback";
export function PerformanceChart({ trades }: { trades: Trade[] }) {
  const closed = [...stats(trades).closed].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  if (!closed.length)
    return (
      <div className="chart-empty">
        <FeedbackAnimation type="empty" loop />
        <p>Your curve starts with your first closed trade.</p>
      </div>
    );
  const values = cumulativeRealized(closed);
  if (!values) return <p>These values exceed the supported chart range.</p>;
  return (
    <RealizedCurve
      values={values}
      count={closed.length}
      labels={closed.map((t) => t.closedAt || t.date)}
    />
  );
}
function RealizedCurve({
  values,
  count,
  labels,
}: {
  values: number[];
  count: number;
  labels: string[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null),
    [size, setSize] = useState({ width: 760, height: 260 });
  useEffect(() => {
    const element = svg.current!;
    if (!element) return;
    const measure = () => {
      const box = element.getBoundingClientRect();
      if (box.width > 0 && box.height > 0)
        setSize((previous) =>
          previous.width === box.width && previous.height === box.height
            ? previous
            : { width: box.width, height: box.height },
        );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const left = size.width < 400 ? 61 : 85,
    right = size.width - 18,
    bottom = size.height - 34;
  const sum = values[values.length - 1];
  const low = values.reduce((a, b) => Math.min(a, b), 0),
    high = values.reduce((a, b) => Math.max(a, b), 0),
    padding = Math.max((high - low) * 0.15, 1),
    min = low - padding,
    max = high + padding;
  const x = (i: number) => left + (i / (values.length - 1)) * (right - left),
    y = (v: number) => 16 + ((max - v) / (max - min)) * (bottom - 16);
  if (!Number.isFinite(max - min))
    return <p>These values exceed the supported chart range.</p>;
  const peaks: number[] = [];
  let peak = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    peaks.push(peak);
  }
  const selected = active ?? values.length - 1;
  return (
    <div className="equity-interactive">
      <svg
        ref={svg}
        onPointerMove={(e) => {
          const bounds = e.currentTarget.getBoundingClientRect();
          const position =
            ((e.clientX - bounds.left) / bounds.width) * size.width;
          setActive(
            Math.max(
              0,
              Math.min(
                values.length - 1,
                Math.round(
                  ((position - left) / (right - left)) * (values.length - 1),
                ),
              ),
            ),
          );
        }}
        onPointerLeave={() => setActive(null)}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={`Cumulative realized P&L ${money(sum)} over ${count} closed trades`}
      >
        <title>
          Cumulative realized P&L starting at zero, ordered by trade date
        </title>
        {[0, 1, 2, 3].map((i) => {
          const v = min + ((max - min) * i) / 3;
          return (
            <g key={i}>
              <line className="grid" x1={left} x2={right} y1={y(v)} y2={y(v)} />
              <text x={left - 9} y={y(v) + 4} textAnchor="end">
                {Math.abs(v) >= 10000
                  ? new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "USD",
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(v)
                  : money(v)}
              </text>
            </g>
          );
        })}
        <line className="zero" x1={left} x2={right} y1={y(0)} y2={y(0)} />
        <polygon
          className="drawdown-area"
          points={[
            ...peaks.map((v, i) => `${x(i)},${y(v)}`),
            ...values.map((v, i) => `${x(i)},${y(v)}`).reverse(),
          ].join(" ")}
        />
        <polyline
          className="curve"
          points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
        />
        {active !== null && (
          <>
            <line
              className="equity-crosshair"
              x1={x(active)}
              x2={x(active)}
              y1={16}
              y2={bottom}
            />
            <circle
              className="endpoint"
              cx={x(active)}
              cy={y(values[active])}
              r={5}
            />
          </>
        )}
        <circle
          className="endpoint"
          cx={x(values.length - 1)}
          cy={y(sum)}
          r="4"
        />
        <text x={left} y={size.height - 7}>
          Start · $0
        </text>
        <text x={right} y={size.height - 7} textAnchor="end">
          Trade {count}
        </text>
      </svg>
      {active !== null && (
        <div className="equity-tooltip" role="status">
          <small>
            {selected === 0
              ? "Starting point"
              : labels[selected - 1]?.replace("T", " ").slice(0, 16)}
          </small>
          <strong>{money(values[selected])}</strong>
          <small>Drawdown: {money(peaks[selected] - values[selected])}</small>
        </div>
      )}
      <label className="equity-scrubber">
        <span className="sr-only">Inspect equity point</span>
        <input
          type="range"
          min={0}
          max={values.length - 1}
          value={active ?? 0}
          onChange={(e) => setActive(Number(e.target.value))}
          onFocus={() => setActive(0)}
          onBlur={() => setActive(null)}
        />
      </label>
    </div>
  );
}
