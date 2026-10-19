import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { emptyReview } from "../lib/practice";
import { TradeReviewFields } from "./trade-review-fields";
import {
  options,
  packNotes,
  unpackNotes,
  validate,
  type Trade,
} from "../lib/journal";
import { useJournal } from "./provider";
import { ScreenshotUpload } from "./screenshot-upload";
import {
  screenshotRefs,
  type Screenshot,
  type ScreenshotRef,
} from "../lib/screenshots";
function localNow() {
  const now = new Date();
  return new Date(+now - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function TradeForm({
  trade,
  onClose,
}: {
  trade?: Trade;
  onClose: () => void;
}) {
  const { save, remove } = useJournal(),
    dialog = useRef<HTMLDialogElement>(null),
    busy = useRef(false);
  const [values, setValues] = useState<Record<string, string>>(() => ({
    symbol: "",
    direction: "Long",
    entry: "",
    status: "open",
    pnl: "",
    stop: "",
    risk: "",
    date: localNow(),
    setup: "Unspecified",
    session: "Other",
    emotion: "Calm",
    followed: "unsure",
    reason: "",
    lesson: "",
    exit: "",
    size: "",
    ...Object.fromEntries(
      Object.entries(trade ?? {})
        .filter(([, v]) => typeof v === "string" || typeof v === "number")
        .map(([k, v]) => [k, String(v)]),
    ),
    ...(trade
      ? {
          lesson: unpackNotes(trade.lesson).notes,
          exit: unpackNotes(trade.lesson).exit,
          size: unpackNotes(trade.lesson).size,
        }
      : {}),
  }));
  const [advanced, setAdvanced] = useState(false),
    [error, setError] = useState("");
  const [review, setReview] = useState(
    () => trade?.journalReview ?? emptyReview(),
  );
  const [reviewOpen, setReviewOpen] = useState(
    !!trade && !!unpackNotes(trade.lesson).notes.trim(),
  );
  const [images, setImages] = useState<ScreenshotRef[]>(() =>
      trade ? screenshotRefs(trade) : [],
    ),
    [drafts, setDrafts] = useState<Screenshot[]>([]),
    [processing, setProcessing] = useState(false),
    [saving, setSaving] = useState(false);
  const id = useRef(trade?.id ?? crypto.randomUUID());
  useEffect(() => {
    const el = dialog.current!;
    const previous = document.activeElement;
    el.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = old;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  const change = (key: string, value: string) =>
    setValues((old) => ({ ...old, [key]: value }));
  const input = (
    key: string,
    label: string,
    type = "text",
    required = false,
    maxLength?: number,
  ) => (
    <label>
      {label}
      <input
        name={key}
        type={type}
        value={values[key]}
        onChange={(e) => change(key, e.target.value)}
        required={required}
        step={type === "number" ? "any" : undefined}
        maxLength={maxLength}
        placeholder={
          (
            {
              symbol: "e.g. XAUUSD or EURUSD",
              entry: "e.g. 2700",
              exit: "e.g. 2720",
              size: "e.g. 0.01 lot or 10 shares",
              stop: "Your original stop price",
              risk: "e.g. 25",
              setup: "e.g. Breakout",
            } as Record<string, string>
          )[key]
        }
      />
    </label>
  );
  const select = (key: keyof typeof options, label: string) => (
    <label>
      {label}
      <select
        name={key}
        value={values[key]}
        onChange={(e) => change(key, e.target.value)}
      >
        {options[key].map((v) => (
          <option key={v} value={v}>
            {key === "followed"
              ? (
                  { yes: "Yes", no: "No", unsure: "Not sure" } as Record<
                    string,
                    string
                  >
                )[v]
              : key === "direction"
                ? v === "Long"
                  ? "Buy (Long)"
                  : "Sell (Short)"
                : key === "status"
                  ? v === "open"
                    ? "Open — still running"
                    : "Closed — finished"
                  : v}
          </option>
        ))}
      </select>
    </label>
  );
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current || processing) return;
    busy.current = true;
    try {
      const originalDetails = trade
        ? unpackNotes(trade.lesson)
        : { exit: "", size: "" };
      if (
        values.exit !== originalDetails.exit &&
        values.exit.trim() &&
        (!Number.isFinite(Number(values.exit)) || Number(values.exit) <= 0)
      )
        throw Error("Optional exit price must be a positive finite number.");
      if (
        values.size !== originalDetails.size &&
        values.size.trim() &&
        !/^\s*(?:\d+(?:\.\d*)?|\.\d+)\s+\S.*$/.test(values.size)
      )
        throw Error(
          "Position size needs an amount and explicit units, for example 0.01 lot or 10 shares.",
        );
      const sizeAmount = Number.parseFloat(values.size);
      if (
        values.size !== originalDetails.size &&
        values.size.trim() &&
        (!Number.isFinite(sizeAmount) || sizeAmount <= 0)
      )
        throw Error("Position size must be positive and include units.");
      const record = validate({
        ...trade,
        id: id.current,
        symbol: values.symbol.trim().toUpperCase(),
        direction: values.direction,
        entry: values.entry.trim() ? Number(values.entry) : NaN,
        status: values.status,
        pnl:
          values.status === "closed"
            ? values.pnl.trim()
              ? Number(values.pnl)
              : NaN
            : null,
        reason: values.reason.trim(),
        lesson: packNotes(values.lesson, values.exit, values.size),
        stop: values.stop.trim() ? Number(values.stop) : NaN,
        risk: values.risk.trim() ? Number(values.risk) : NaN,
        date: values.date,
        setup: values.setup.trim(),
        session: values.session,
        emotion: values.emotion,
        followed: values.followed,
        ...(review.playbookId || review.mistakes.length || trade?.journalReview
          ? { journalReview: review }
          : {}),
      });
      if (trade) {
        for (const key of ["symbol", "setup", "reason"] as const)
          if (values[key] === trade[key]) record[key] = trade[key];
        const original = unpackNotes(trade.lesson);
        if (
          values.lesson === original.notes &&
          values.exit === original.exit &&
          values.size === original.size
        )
          record.lesson = trade.lesson;
      }
      if (images.length || trade?.screenshots) record.screenshots = images;
      const pending = save(record, !!trade, drafts);
      if (pending) {
        setSaving(true);
        await pending;
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setAdvanced(true);
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="trade-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy.current && !processing) onClose();
      }}
    >
      <form
        onSubmit={submit}
        onInvalidCapture={(e) => {
          if ((e.target as HTMLElement).closest("details")) setAdvanced(true);
        }}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">YOUR TRADE, IN A FEW DETAILS</p>
            <h2 id="trade-title">
              {trade ? "Review / edit trade" : "Log a trade"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close trade form"
            disabled={saving || processing}
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="form-intro">
          Start with the trade. Add notes and a chart if useful.
        </p>
        <fieldset disabled={saving || processing} className="trade-section">
          <legend>Trade details</legend>
          <div className="form-grid">
            {input("symbol", "Asset / symbol", "text", true, 30)}
            {select("direction", "Direction")}
            {input("entry", "Entry price", "number", true)}
            {select("status", "Trade status")}
            {input("size", "Position size (optional)", "text", false, 80)}
            {input("exit", "Exit price (optional)", "number")}
            {values.status === "closed" && (
              <label className="wide">
                Profit or loss (USD)
                <input
                  name="pnl"
                  type="number"
                  step="any"
                  value={values.pnl}
                  onChange={(e) => change("pnl", e.target.value)}
                  required
                />
                <small>
                  Use your broker’s result after fees: 50 for a $50 profit, -25
                  for a $25 loss, or 0 to break even.
                </small>
              </label>
            )}
            <label className="wide">
              Why did you take this trade?
              <textarea
                name="reason"
                rows={2}
                placeholder="e.g. Price retested support and confirmed my entry."
                value={values.reason}
                onChange={(e) => change("reason", e.target.value)}
                maxLength={4000}
                required
              />
            </label>
            {values.status === "closed" || reviewOpen ? (
              <label className="wide">
                What happened? <span className="optional">optional</span>
                <textarea
                  name="lesson"
                  rows={2}
                  placeholder="What went well, or what would you do differently?"
                  value={values.lesson}
                  onChange={(e) => change("lesson", e.target.value)}
                  maxLength={4000}
                />
              </label>
            ) : (
              <button
                type="button"
                className="text-button add-review wide"
                onClick={() => setReviewOpen(true)}
              >
                + Add a review note
              </button>
            )}
          </div>
        </fieldset>
        <ScreenshotUpload
          refs={images}
          drafts={drafts}
          disabled={saving}
          onBusy={setProcessing}
          onChange={(refs, files) => {
            setImages(refs);
            setDrafts(files);
          }}
        />
        <details
          className="advanced"
          open={advanced}
          onToggle={(e) => setAdvanced(e.currentTarget.open)}
        >
          <summary>
            Advanced <span>Initial risk, date and trading context</span>
          </summary>
          <p className="footnote">
            Your original stop and amount risked are required to measure the
            result fairly. Keep these original values when closing a trade.
          </p>
          <fieldset disabled={saving || processing} className="form-grid">
            {input("stop", "Initial stop price", "number", true)}
            {input("risk", "Amount risked (USD)", "number", true)}
            {input("date", "Trade date & time", "datetime-local", true)}
            {input("setup", "Setup", "text", true, 100)}
            {select("session", "Session")}
            {select("emotion", "Emotion")}
            {select("followed", "Followed your plan?")}
          </fieldset>
          <TradeReviewFields
            value={review}
            onChange={setReview}
            disabled={saving || processing}
          />
        </details>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {trade ? (
            <button
              type="button"
              className="text-button"
              disabled={saving || processing}
              onClick={async () => {
                if (confirm("Delete this trade? This cannot be undone."))
                  try {
                    setSaving(true);
                    await remove(trade.id);
                    onClose();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setSaving(false);
                  }
              }}
            >
              Delete trade
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || processing}
              onClick={onClose}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="primary"
            disabled={saving || processing}
          >
            {saving
              ? "Saving trade…"
              : processing
                ? "Preparing images…"
                : "Save trade"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
