import { TradeFlags } from "./behavior-summary";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  Download,
  ImageIcon,
  Info,
  Pencil,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";
import { money, rFormat, tone, unpackNotes, type Trade } from "../lib/journal";
import {
  outcomeLabel,
  priceFormat,
  tradeDate,
  tradeSummary,
} from "../lib/trade-presentation";
import { getScreenshots, type Screenshot } from "../lib/screenshots";
export function TradePreview({
  trade,
  onClose,
  onEdit,
}: {
  trade: Trade;
  onClose: () => void;
  onEdit: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [shareOpen, setShareOpen] = useState(false),
    [includeNotes, setIncludeNotes] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [images, setImages] = useState<Screenshot[] | null>(null),
    [imageError, setImageError] = useState("");
  const imageRequest = useRef<{
    id: string;
    promise: Promise<Screenshot[]>;
  } | null>(null);
  useEffect(() => {
    if (!trade.screenshots?.length) return;
    let active = true;
    if (imageRequest.current?.id !== trade.id)
      imageRequest.current = {
        id: trade.id,
        promise: getScreenshots(trade.screenshots),
      };
    void imageRequest.current.promise
      .then((images) => {
        if (active) setImages(images);
      })
      .catch((error) => {
        if (active) setImageError((error as Error).message);
      });
    return () => {
      active = false;
    };
  }, [trade.id]);
  const notes = unpackNotes(trade.lesson),
    summary = tradeSummary(trade, includeNotes);
  useEffect(() => {
    const el = dialog.current!,
      previous = document.activeElement,
      old = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = old;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setMessage("Summary copied.");
    } catch {
      setMessage("Select the summary below to copy it.");
    }
  }
  async function share() {
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({
        title: `${trade.symbol} · Trade Notes`,
        text: summary,
      });
      setMessage("Shared.");
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        setMessage(
          "Sharing is unavailable here. Copy the summary or save a card.",
        );
    }
  }
  async function downloadCard() {
    setBusy(true);
    setMessage("");
    try {
      const { createTradeCard } = await import("../lib/share-card");
      const blob = await createTradeCard(trade, includeNotes);
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `trade-notes-${trade.symbol.replace(/[^a-z0-9]/gi, "-")}-${trade.date.slice(0, 10)}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Trade card saved.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      className="trade-preview"
      ref={dialog}
      aria-labelledby="preview-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="preview-top">
        <span className="eyebrow">YOUR TRADE, AT A GLANCE</span>
        <button
          type="button"
          className="icon-button"
          aria-label="Close trade preview"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="preview-identity">
        <span className="instrument-mark" aria-hidden="true">
          {trade.direction === "Long" ? (
            <ArrowUpRight size={25} />
          ) : (
            <ArrowDownLeft size={25} />
          )}
        </span>
        <div>
          <h2 id="preview-title">{trade.symbol}</h2>
          <TradeFlags id={trade.id} />
          <p>
            {trade.direction === "Long" ? "Buy / Long" : "Sell / Short"}{" "}
            <span>·</span> {tradeDate(trade.date)}
          </p>
        </div>
        <span
          className={
            "status-pill " + (trade.status === "open" ? "is-open" : "")
          }
        >
          {trade.status === "open" && <span className="live-dot" />}
          {outcomeLabel(trade)}
        </span>
      </div>
      <div
        className={
          "preview-result " + (trade.status === "closed" ? tone(trade.pnl) : "")
        }
      >
        <span>
          {trade.status === "closed"
            ? "Net realized · USD"
            : "A little space for your plan"}
        </span>
        <strong>
          {trade.status === "closed"
            ? money(trade.pnl)
            : "Your trade is still open."}
        </strong>
        <small>
          {trade.status === "closed"
            ? `${rFormat(trade.pnl! / trade.risk)} · based on your original cash risk`
            : "Keep the reason you entered close at hand."}
        </small>
      </div>
      <dl className="preview-numbers">
        <div>
          <dt>Recorded entry</dt>
          <dd>{priceFormat(trade.entry)}</dd>
        </div>
        <div>
          <dt>Original stop</dt>
          <dd>{priceFormat(trade.stop)}</dd>
        </div>
        <div>
          <dt>Initial risk · USD</dt>
          <dd>{money(trade.risk)}</dd>
        </div>
        <div>
          <dt>Recorded exit</dt>
          <dd>
            {trade.closePrice
              ? priceFormat(trade.closePrice)
              : notes.exit || "Not recorded"}
          </dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>
            {typeof trade.target === "number"
              ? priceFormat(trade.target)
              : "Not recorded"}
          </dd>
        </div>
        <div>
          <dt>Rating</dt>
          <dd>{trade.rating ? `${trade.rating} / 5` : "Unrated"}</dd>
        </div>
      </dl>
      {!!trade.screenshots?.length && (
        <section className="trade-chart-gallery">
          <h3>Chart screenshots</h3>
          {!images && (
            <button
              type="button"
              className="quiet-button"
              onClick={async () => {
                try {
                  setImages(await getScreenshots(trade.screenshots!));
                  setImageError("");
                } catch (e) {
                  setImageError((e as Error).message);
                }
              }}
            >
              <ImageIcon size={16} />
              Charts: view {trade.screenshots.length} screenshot
              {trade.screenshots.length === 1 ? "" : "s"}
            </button>
          )}
          {images && (
            <div className="preview-images">
              {images.map((image, index) => (
                <figure key={image.id}>
                  <figcaption>
                    {/before/i.test(image.name)
                      ? "Before"
                      : /after/i.test(image.name)
                        ? "After"
                        : `Chart ${index + 1}`}{" "}
                    - {image.name}
                  </figcaption>
                  <a href={image.dataUrl} download={image.name}>
                    <img src={image.dataUrl} alt={image.name} />
                  </a>
                </figure>
              ))}
            </div>
          )}
          {imageError && <p role="alert">{imageError}</p>}
        </section>
      )}
      <div className="preview-reason">
        <span className="note-label">
          <ShieldCheck size={15} aria-hidden="true" />
          Your entry reason
        </span>
        <p>{trade.reason}</p>
      </div>
      <details className="preview-details" open>
        <summary>
          Notes & details <ChevronDown size={16} aria-hidden="true" />
        </summary>
        {trade.journalReview && (
          <div className="saved-process">
            {trade.journalReview.playbookName && (
              <p className="note-label">
                Playbook · {trade.journalReview.playbookName}
              </p>
            )}
            {!!trade.journalReview.rules.length && (
              <ul>
                {trade.journalReview.rules.map((rule, i) => (
                  <li key={i}>
                    {rule.checked ? "✓" : "○"} {rule.label}
                  </li>
                ))}
              </ul>
            )}
            <div className="review-tags">
              {trade.journalReview.mistakes.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        <dl className="preview-context">
          <div>
            <dt>Setup</dt>
            <dd>{trade.setup}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>{trade.session}</dd>
          </div>
          <div>
            <dt>Followed your plan</dt>
            <dd>
              {trade.followed === "yes"
                ? "Yes"
                : trade.followed === "no"
                  ? "No"
                  : "Not sure"}
            </dd>
          </div>
          <div>
            <dt>Feeling</dt>
            <dd>{trade.emotion}</dd>
          </div>
          {notes.size && (
            <div>
              <dt>Size (from notes)</dt>
              <dd>{notes.size}</dd>
            </div>
          )}
          {notes.exit && (
            <div>
              <dt>Exit (from notes)</dt>
              <dd>{notes.exit}</dd>
            </div>
          )}
        </dl>
        <p className="preview-long-note">
          {notes.notes ||
            "No review note yet. You can add one when you edit this trade."}
        </p>
        <p className="preview-long-note">{trade.reason}</p>
      </details>
      <div className="preview-actions">
        <button type="button" className="quiet-button" onClick={onEdit}>
          <Pencil size={16} />
          Edit trade
        </button>
        <button
          type="button"
          className="primary"
          aria-expanded={shareOpen}
          onClick={() => setShareOpen(!shareOpen)}
        >
          <Share2 size={16} />
          Share trade
        </button>
      </div>
      {shareOpen && (
        <section className="share-panel" aria-label="Share this trade">
          <h3>A small card, a clear record.</h3>
          <p>
            Share a summary or save an image. Screenshots stay out of the shared
            card.
          </p>
          <label className="share-check">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => {
                setIncludeNotes(e.target.checked);
                setMessage("");
              }}
            />
            Include my notes in the text and card
          </label>
          <div className="share-buttons">
            <button type="button" onClick={() => void share()}>
              <Share2 size={16} />
              Share summary
            </button>
            <button type="button" onClick={() => void copy()}>
              <Copy size={16} />
              Copy text
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void downloadCard()}
            >
              <Download size={16} />
              {busy ? "Creating…" : "Save image"}
            </button>
          </div>
          <details className="share-text">
            <summary>Preview shared text</summary>
            <textarea
              readOnly
              aria-label="Trade summary to share"
              value={summary}
              rows={6}
            />
          </details>
          {message && (
            <p className="share-status" role="status">
              {message === "Summary copied." ? (
                <CheckCheck size={15} />
              ) : ["Shared.", "Trade card saved."].includes(message) ? (
                <Check size={15} />
              ) : (
                <Info size={15} />
              )}{" "}
              {message}
            </p>
          )}
        </section>
      )}
    </dialog>
  );
}
