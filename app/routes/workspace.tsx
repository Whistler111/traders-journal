import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { JournalProvider, useJournal } from "../components/provider";
import { ManageData } from "../components/manage-data";
import { TradeForm } from "../components/trade-form";
import type { Trade } from "../lib/journal";
import { PriceAlerts } from "../components/price-alerts";
import {
  BookOpen,
  ChartNoAxesCombined,
  LayoutDashboard,
  LockKeyhole,
  NotebookPen,
} from "lucide-react";
import { TradePreview } from "../components/trade-preview";
import { ThemeToggle } from "../components/theme-toggle";
import { OnboardingTour } from "../components/onboarding-tour";
export interface WorkspaceContext {
  edit: (trade?: Trade) => void;
  view: (trade: Trade) => void;
}
function Workspace() {
  const [importing, setImporting] = useState(false);
  const {
      ready,
      error,
      trades,
      deviceImportAvailable,
      importFromDevice,
      notify,
    } = useJournal(),
    [editing, setEditing] = useState<{ trade?: Trade } | null>(null),
    [previewId, setPreviewId] = useState<string | null>(null),
    location = useLocation(),
    navigate = useNavigate();
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (["overview", "journal", "review"].includes(hash))
      navigate("/" + hash, { replace: true });
  }, [location.hash, navigate]);
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <aside className="sidebar">
        <NavLink className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">
            <BookOpen size={22} />
          </span>
          <span>
            Trade Notes<small>Your pocket journal</small>
          </span>
        </NavLink>
        <nav aria-label="Workspace">
          {[
            { to: "/", Icon: LayoutDashboard, label: "Overview" },
            { to: "/journal", Icon: NotebookPen, label: "Journal" },
            { to: "/review", Icon: ChartNoAxesCombined, label: "Review" },
          ].map(({ to, Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                "nav" +
                (isActive ||
                (label === "Overview" && location.pathname === "/overview")
                  ? " active"
                  : "")
              }
            >
              <Icon size={19} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <LockKeyhole size={15} aria-hidden="true" />A space of your own
          <p>
            Synced to your account.
            <br />
            Keep a backup close by.
          </p>
        </div>
      </aside>
      <main>
        <header>
          <div className="workspace-label">
            <span className="workspace-dot" />
            Your trading space
            <span className="workspace-caption">One trade at a time.</span>
          </div>
          <div className="header-actions">
            <ThemeToggle />
            <PriceAlerts
              onOpenTrade={(trade) => {
                navigate("/journal");
                setPreviewId(trade.id);
              }}
            />
            <ManageData />
          </div>
        </header>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {deviceImportAvailable && (
          <div className="import-summary" role="status">
            Your previous device journal is available. Import it into this
            account when you are ready.{" "}
            <button
              disabled={!ready || !!error || importing}
              onClick={async () => {
                if (importing) return;
                setImporting(true);
                try {
                  await importFromDevice();
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setImporting(false);
                }
              }}
            >
              Import trades from this device
            </button>
          </div>
        )}
        {!ready ? (
          <div className="empty" role="status">
            Loading your journal…
          </div>
        ) : (
          <div
            id="content"
            tabIndex={-1}
            key={location.pathname}
            className="page-section arriving"
          >
            <Outlet
              context={
                {
                  edit: (trade?: Trade) => setEditing({ trade }),
                  view: (trade: Trade) => setPreviewId(trade.id),
                } satisfies WorkspaceContext
              }
            />
          </div>
        )}
        <footer>
          <LockKeyhole size={12} aria-hidden="true" /> Synced to your account.
          Keep a JSON backup for an independent copy.
          <OnboardingTour enabled={ready && !error && !editing && !previewId} />
        </footer>
      </main>
      {editing && (
        <TradeForm trade={editing.trade} onClose={() => setEditing(null)} />
      )}
      {!editing && previewId && trades.find((t) => t.id === previewId) && (
        <TradePreview
          trade={trades.find((t) => t.id === previewId)!}
          onClose={() => setPreviewId(null)}
          onEdit={() => {
            const trade = trades.find((t) => t.id === previewId)!;
            setPreviewId(null);
            setEditing({ trade });
          }}
        />
      )}
    </>
  );
}
export default function JournalWorkspace() {
  return (
    <JournalProvider>
      <Workspace />
    </JournalProvider>
  );
}
