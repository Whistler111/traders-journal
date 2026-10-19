import { useEffect, useMemo, useRef, useState } from "react";
import { X, Upload } from "lucide-react";
import { useJournal } from "./provider";
import {
  CSV_TEMPLATE,
  importFields,
  inferColumns,
  parseCsv,
  previewCsv,
  type ColumnMap,
  type DateOrder,
} from "../lib/csv-import";
import { download } from "../lib/download";
import { money } from "../lib/journal";
import { priceFormat } from "../lib/trade-presentation";
export function CsvImport({
  onClose,
  returnFocus,
}: {
  onClose: () => void;
  returnFocus?: HTMLElement | null;
}) {
  const { trades, importTrades } = useJournal(),
    ref = useRef<HTMLDialogElement>(null),
    [rows, setRows] = useState<string[][] | null>(null),
    [map, setMap] = useState<ColumnMap>(() => inferColumns([])),
    [zone, setZone] = useState(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    [order, setOrder] = useState<DateOrder>("iso"),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false),
    [usd, setUsd] = useState(false),
    [includeDuplicates, setIncludeDuplicates] = useState(false),
    [selected, setSelected] = useState<Set<number> | null>(null);
  useEffect(() => {
    const el = ref.current!,
      previous = returnFocus ?? document.activeElement,
      old = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = old;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  const preview = useMemo(() => {
    try {
      return {
        rows: rows ? previewCsv(rows, map, zone, order, trades) : [],
        error: "",
      };
    } catch (e) {
      return { rows: [], error: (e as Error).message };
    }
  }, [rows, map, zone, order, trades]);
  const valid = preview.rows.filter(
      (r) => r.trade && (!r.duplicate || includeDuplicates),
    ),
    chosen = valid.filter((r) => selected === null || selected.has(r.line));
  return (
    <dialog
      ref={ref}
      className="import-dialog"
      aria-labelledby="csv-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <p className="eyebrow">BRING YOUR RECORDS TOGETHER</p>
          <h2 id="csv-title">Import CSV trades</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close CSV import"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <p className="form-intro">
        Review completed trade records before adding them. Existing trades stay
        in place. USD results only.
      </p>
      <label>
        Choose a CSV file
        <input
          aria-label="CSV trade file"
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            setMessage("");
            setRows(null);
            setSelected(null);
            setIncludeDuplicates(false);
            setUsd(false);
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 2 * 1024 * 1024) throw Error("CSV exceeds 2 MB.");
              const parsed = parseCsv(await file.text());
              setMap(inferColumns(parsed[0]));
              setRows(parsed);
            } catch (error) {
              setMessage((error as Error).message);
            }
            e.target.value = "";
          }}
        />
      </label>
      <button
        type="button"
        className="text-button import-template"
        onClick={() =>
          download(CSV_TEMPLATE, "text/csv;charset=utf-8", "template.csv")
        }
      >
        Download blank CSV template
      </button>
      <div className="import-options">
        <label>
          Source timezone
          <input
            aria-label="Source timezone"
            value={zone}
            onChange={(e) => {
              setZone(e.target.value);
              setSelected(null);
            }}
            list="timezones"
            placeholder="e.g. America/New_York"
          />
          <datalist id="timezones">
            {[
              "UTC",
              "Africa/Lagos",
              "Europe/London",
              "America/New_York",
              "America/Chicago",
              "Asia/Dubai",
              "Asia/Tokyo",
              "Australia/Sydney",
            ].map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
          <small>
            Applies to dates without a UTC offset. Saved dates display in your
            browser’s local time.
          </small>
        </label>
        <label>
          Date format
          <select
            aria-label="CSV date format"
            value={order}
            onChange={(e) => {
              setOrder(e.target.value as DateOrder);
              setSelected(null);
            }}
          >
            <option value="iso">YYYY-MM-DD HH:mm</option>
            <option value="dmy">DD/MM/YYYY HH:mm</option>
            <option value="mdy">MM/DD/YYYY HH:mm</option>
          </select>
        </label>
      </div>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={usd}
          onChange={(e) => setUsd(e.target.checked)}
        />
        I confirm all cash risk and net results in this file are USD.
      </label>
      {rows && (
        <>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={includeDuplicates}
              onChange={(e) => {
                setIncludeDuplicates(e.target.checked);
                setSelected(null);
              }}
            />
            Include flagged duplicates only if they represent separate trades
          </label>
          <details>
            <summary>Match columns</summary>
            <div className="import-columns">
              {importFields.map((field) => (
                <label key={field}>
                  {(
                    {
                      pnl: "Net P&L after fees",
                      risk: "Initial cash risk",
                      stop: "Original stop",
                      sourceId: "Trade / position ID",
                    } as Record<string, string>
                  )[field] ?? field}
                  <select
                    aria-label={`CSV column ${field}`}
                    value={map[field]}
                    onChange={(e) => {
                      setMap({ ...map, [field]: e.target.value });
                      setSelected(null);
                    }}
                  >
                    <option value="">Not mapped</option>
                    {rows[0].map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </details>
          <div className="import-summary" role="status">
            {chosen.length} selected ·{" "}
            {preview.rows.filter((r) => r.duplicate).length} duplicates flagged
            · {preview.rows.filter((r) => r.error).length} rows need attention.
            <br />
            Identical financial records and matching source IDs are excluded by
            default. Review excluded rows before importing genuinely separate
            trades.
            <br />
            Missing optional context uses Imported setup, Other session, Calm
            emotion, and unsure plan adherence. Map these columns or complete
            them in the file if those defaults do not apply.
          </div>
          <div className="import-rows" aria-label="CSV preview">
            {preview.rows.map((r) => (
              <div key={r.line} className="import-row">
                {r.trade && (!r.duplicate || includeDuplicates) ? (
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      aria-label={`Import CSV row ${r.line}`}
                      checked={selected === null || selected.has(r.line)}
                      onChange={(e) => {
                        const next = new Set(
                          selected ?? valid.map((v) => v.line),
                        );
                        if (e.target.checked) next.add(r.line);
                        else next.delete(r.line);
                        setSelected(next);
                      }}
                    />
                    <strong>
                      Row {r.line} · {r.trade.symbol}
                      {r.duplicate ? " · Flagged duplicate" : ""}
                    </strong>
                    <span>
                      {r.trade.date.replace("T", " ")} (local time) ·{" "}
                      {r.trade.direction} ·{" "}
                      {r.trade.status === "closed"
                        ? money(r.trade.pnl)
                        : "Open"}
                    </span>
                    <small>
                      Entry {priceFormat(r.trade.entry)} · Original stop{" "}
                      {priceFormat(r.trade.stop)} · Initial risk{" "}
                      {money(r.trade.risk)} USD
                    </small>
                  </label>
                ) : (
                  <>
                    <strong>
                      Row {r.line}
                      {r.duplicate ? " · Duplicate" : ""}
                    </strong>
                    <p>
                      {r.error ??
                        "Already present or repeated in this file; excluded from import."}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {(message || preview.error) && (
        <p className="error" role="alert">
          {message || preview.error}
        </p>
      )}
      <p className="footnote">
        Raw TradingView order history can contain unfilled orders, partial fills
        and reversals. It is not automatically treated as a closed-trade ledger.
        Missing risk, stops, entry reasons or net results must be supplied; no
        values are guessed.
      </p>
      <div className="feature-actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          disabled={saving || !usd || !chosen.length || !!preview.error}
          onClick={async () => {
            try {
              if (
                chosen.some((r) => r.duplicate) &&
                !confirm(
                  "Some selected rows are flagged as duplicates. Import them as separate trades anyway?",
                )
              )
                return;
              setSaving(true);
              await importTrades(chosen.map((r) => r.trade!));
              onClose();
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <Upload size={16} />
          Import {chosen.length} trades
        </button>
      </div>
    </dialog>
  );
}
