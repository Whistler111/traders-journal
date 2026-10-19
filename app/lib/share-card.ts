import { money, rFormat, unpackNotes, type Trade } from "./journal";
import { outcomeLabel, priceFormat, tradeDate } from "./trade-presentation";
/** A local export of one saved record. No upload, public URL, or live-price estimate. */
export async function createTradeCard(
  trade: Trade,
  includeNotes = false,
): Promise<Blob> {
  if (document.fonts) await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = includeNotes ? 1180 : 880;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw Error(
      "Image export is unavailable in this browser. You can still share the text summary.",
    );
  const tokens = getComputedStyle(document.documentElement),
    heading = tokens.getPropertyValue("--font-heading").trim() || "sans-serif",
    body = tokens.getPropertyValue("--font-body").trim() || "sans-serif";
  const ink = "#25283d",
    muted = "#6d7388",
    accent = "#6960b4";
  ctx.fillStyle = "#f5f5fa";
  ctx.fillRect(0, 0, 1080, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(48, 48, 984, canvas.height - 96, 32);
  ctx.fill();
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    color = ink,
    weight = 400,
    font = body,
    maxWidth = 892,
  ) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillText(value, x, y, maxWidth);
  };
  text("TRADE NOTES", 94, 116, 22, accent, 500, heading);
  text("One trade. A clearer picture.", 94, 153, 20, muted);
  ctx.strokeStyle = "#e8e9f1";
  ctx.beginPath();
  ctx.moveTo(94, 185);
  ctx.lineTo(986, 185);
  ctx.stroke();
  text(trade.symbol, 94, 267, 58, ink, 600, heading);
  text(
    `${trade.direction === "Long" ? "Buy / Long" : "Sell / Short"}  ·  ${outcomeLabel(trade)}`,
    94,
    309,
    26,
    muted,
    500,
    heading,
  );
  text(tradeDate(trade.date), 94, 351, 22, muted);
  const metric = (label: string, value: string, x: number, y: number) => {
    text(label, x, y, 21, muted);
    text(value, x, y + 43, 30, ink, 500, heading, 410);
  };
  metric("Recorded entry", priceFormat(trade.entry), 94, 423);
  metric("Original stop", priceFormat(trade.stop), 565, 423);
  metric("Initial cash risk (USD)", money(trade.risk), 94, 541);
  metric("Status", outcomeLabel(trade), 565, 541);
  if (trade.status === "closed") {
    text("NET REALIZED · USD", 94, 678, 20, muted);
    text(
      money(trade.pnl),
      94,
      739,
      48,
      trade.pnl! > 0 ? "#187a59" : trade.pnl! < 0 ? "#b34f61" : ink,
      600,
      heading,
      630,
    );
    text(
      rFormat(trade.pnl! / trade.risk),
      755,
      733,
      28,
      muted,
      500,
      heading,
      230,
    );
  } else {
    text("Your entry is recorded.", 94, 692, 32, ink, 500, heading);
    text(
      "No realized result recorded while this trade is open.",
      94,
      735,
      21,
      muted,
    );
  }
  if (includeNotes) {
    const excerpt = (label: string, value: string, y: number) => {
      text(label, 94, y, 19, muted);
      let remaining = value.replace(/\s+/g, " ").trim();
      ctx.font = `400 23px ${body}`;
      for (let row = 0; row < 2 && remaining; row++) {
        let end = remaining.length;
        while (
          end > 0 &&
          ctx.measureText(
            remaining.slice(0, end) +
              (row === 1 && end < remaining.length ? "…" : ""),
          ).width > 870
        )
          end--;
        if (end === 0) break;
        const space = remaining.lastIndexOf(" ", end);
        if (end < remaining.length && space > 0) end = space;
        text(
          remaining.slice(0, end) +
            (row === 1 && end < remaining.length ? "…" : ""),
          94,
          y + 35 + row * 32,
          23,
        );
        remaining = remaining.slice(end).trim();
      }
    };
    excerpt("ENTRY REASON · EXCERPT", trade.reason, 806);
    const notes = unpackNotes(trade.lesson).notes;
    if (notes) excerpt("REFLECTION · EXCERPT", notes, 943);
  }
  text(
    "Saved journal record · cash results in USD",
    94,
    canvas.height - 80,
    18,
    muted,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(Error("Could not create the share card.")),
      "image/png",
    ),
  );
}
