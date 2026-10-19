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
  return <RealizedCurve values={values} count={closed.length} />;
}
function RealizedCurve({ values, count }: { values: number[]; count: number }) {
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
  return (
    <svg
      ref={svg}
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
      <polyline
        className="curve"
        points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
      />
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
  );
}
