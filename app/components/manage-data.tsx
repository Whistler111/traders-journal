import { useRef, useState } from "react";
import { csv } from "../lib/journal";
import { exportWithScreenshots, parseImageBackup } from "../lib/screenshots";
import { useJournal } from "./provider";
import { FeedbackAnimation } from "./feedback";
import { Archive, Download, FileSpreadsheet, Upload } from "lucide-react";
import { HeaderMenu } from "./header-menu";
import { CsvImport } from "./csv-import";
import { Link } from "react-router";
import { download } from "../lib/download";
import { useAuth } from "./auth/AuthProvider";
export function ManageData() {
  const { signOut } = useAuth();
  const { trades, practice, ready, error, restore, notify } = useJournal(),
    file = useRef<HTMLInputElement>(null),
    [loading, setLoading] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null),
    [importOpen, setImportOpen] = useState(false);
  return (
    <>
      <HeaderMenu className="data-menu" menuRef={menu}>
        <summary>
          <Archive size={16} aria-hidden="true" />
          <span>Manage data</span>
        </summary>
        <div>
          <button
            type="button"
            disabled={!ready || !!error}
            onClick={() => {
              if (menu.current) menu.current.open = false;
              setImportOpen(true);
            }}
          >
            <Upload size={16} aria-hidden="true" />
            Import CSV
          </button>
          <Link className="data-link" to="/connections">
            Account & connections
          </Link>
          <button
            disabled={!ready || !!error || loading}
            onClick={async () => {
              setLoading(true);
              try {
                download(
                  JSON.stringify(
                    { ...(await exportWithScreenshots(trades)), practice },
                    null,
                    2,
                  ),
                  "application/json",
                  "json",
                );
              } catch (e) {
                notify("Backup failed: " + (e as Error).message);
              } finally {
                setLoading(false);
              }
            }}
          >
            <Download size={16} aria-hidden="true" />
            Download backup
          </button>
          <button
            disabled={!ready || !!error}
            onClick={() =>
              download(csv(trades), "text/csv;charset=utf-8", "csv")
            }
          >
            <FileSpreadsheet size={16} aria-hidden="true" />
            Export CSV
          </button>
          <button
            disabled={!ready || loading}
            onClick={() => file.current?.click()}
          >
            <Upload size={16} aria-hidden="true" />
            Restore backup
          </button>
          <button
            type="button"
            onClick={() =>
              void signOut().catch(() =>
                notify("Could not sign out. Please try again."),
              )
            }
          >
            Sign out
          </button>
          {error && (
            <button
              onClick={() => {
                try {
                  download(
                    localStorage.getItem("trade-notes-v1") ?? "",
                    "text/plain",
                    "raw.txt",
                  );
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              Download unreadable raw data
            </button>
          )}
        </div>
      </HeaderMenu>
      {importOpen && (
        <CsvImport
          onClose={() => setImportOpen(false)}
          returnFocus={menu.current?.querySelector("summary")}
        />
      )}
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        aria-label="Restore backup file"
        hidden
        onChange={async (e) => {
          const input = e.currentTarget,
            selected = input.files?.[0];
          if (!selected) return;
          setLoading(true);
          try {
            if (selected.size > 50 * 1024 * 1024)
              throw Error("Backup exceeds 50 MB.");
            const {
              trades: next,
              images,
              practice,
            } = parseImageBackup(JSON.parse(await selected.text()));
            if (
              !confirm(
                `Replace the current journal (${trades.length} readable trades) with ${next.length} trades? Download a backup first. This cannot be undone.`,
              )
            )
              return;
            await restore(next, images, practice);
          } catch (e) {
            notify("Restore failed: " + (e as Error).message);
          } finally {
            setLoading(false);
            input.value = "";
          }
        }}
      />
      {loading && (
        <div className="restore-state" role="status">
          <FeedbackAnimation type="loading" loop />
          Preparing your backup…
        </div>
      )}
    </>
  );
}
