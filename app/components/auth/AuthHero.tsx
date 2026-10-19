import { useChartAnimation } from "./useChartAnimation";
export function AuthHero({
  pair = "XAU/USD",
  className = "",
}: {
  pair?: string;
  className?: string;
}) {
  const { host, canvas, note, status } = useChartAnimation();
  return (
    <div ref={host} className={`auth-hero ${className}`} aria-hidden="true">
      <div className="auth-ticker">
        <strong>{pair}</strong>
        <span>One trade. One lesson.</span>
      </div>
      <canvas ref={canvas} />
      <div className="auth-story-card">
        <span className="auth-note-label">A NOTE TO MY FUTURE SELF</span>
        <p ref={note} />
        <span className="auth-caret" />
      </div>
      <span ref={status} className="auth-story-status">
        Writing
      </span>
      <p className="auth-example">Illustrative chart · no live market data</p>
    </div>
  );
}
