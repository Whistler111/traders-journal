import { WorkspaceSkeleton } from "../components/workspace-skeleton";
import { ViewFiltersProvider } from "../components/view-filters";
import { DesktopCommands } from "../components/desktop-commands";
import { RiskBanner } from "../components/behavior-summary";
import { RangeFilter } from "../components/range-filter";
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
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
} from "lucide-react";
import { TradePreview } from "../components/trade-preview";
import { OnboardingTour } from "../components/onboarding-tour";
import { VerificationBanner } from "../components/verification-banner";
export interface WorkspaceContext {
  edit: (trade?: Trade) => void;
  view: (trade: Trade) => void;
}
export function Workspace() {
  const [collapsed, setCollapsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const {
      ready,
      error,
      trades,
      loadedTrades,
      deviceImportAvailable,
      importFromDevice,
      notify,
    } = useJournal(),
    [editing, setEditing] = useState<{ trade?: Trade } | null>(null),
    [previewId, setPreviewId] = useState<string | null>(null),
    location = useLocation(),
    navigate = useNavigate();
  const previewRecords=loadedTrades ?? trades;
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
      <aside className={"sidebar" + (collapsed ? " is-collapsed" : "")}>
        <NavLink className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">
            <BookOpen size={22} />
          </span>
          <span>
            Trade Notes<small>Your pocket journal</small>
          </span>
        </NavLink>
        <button
          className="sidebar-collapse icon-button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
        <nav aria-label="Workspace">
          {[
            { to: "/", Icon: LayoutDashboard, label: "Dashboard" },
            { to: "/journal", Icon: NotebookPen, label: "Journal" },
            { to: "/reports", Icon: ChartNoAxesCombined, label: "Reports" },
            { to: "/review", Icon: BookOpen, label: "Playbooks" },
            { to: "/settings", Icon: Settings2, label: "Settings" },
          ].map(({ to, Icon, label }) => (
            <NavLink
              key={to}
              to={{ pathname: to, search: location.search }}
              aria-label={label}
              title={label}
              end
              className={({ isActive }) =>
                "nav" +
                (isActive ||
                (label === "Dashboard" && location.pathname === "/overview")
                  ? " active"
                  : "")
              }
            >
              <Icon size={19} aria-hidden="true" />
              <span className="nav-label">{label}</span>
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
      <main className={collapsed ? "sidebar-collapsed" : ""}>
        <header>
          <div className="workspace-label">
            <span className="workspace-dot" />
            Your trading space
            <span className="workspace-caption">One trade at a time.</span>
          </div>
          <div className="header-actions">
            <DesktopCommands onAdd={() => setEditing({})} />
            <PriceAlerts
              onOpenTrade={(trade) => {
                navigate("/journal");
                setPreviewId(trade.id);
              }}
            />
            <ManageData />
          </div>
        </header>
        {location.pathname !== "/connections" && <VerificationBanner />}
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
          <WorkspaceSkeleton />
        ) : (
          <div
            id="content"
            tabIndex={-1}
            key={location.pathname}
            className="page-section arriving"
          >
            {["/", "/overview", "/journal", "/reports"].includes(
              location.pathname,
            ) && <RangeFilter />}
            <RiskBanner />
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
      <button
        className="mobile-add"
        aria-label="Add trade"
        disabled={!ready || !!error}
        onClick={() => setEditing({})}
      >
        <Plus size={26} />
      </button>
      {editing && (
        <TradeForm trade={editing.trade} onClose={() => setEditing(null)} />
      )}
      {!editing && previewId && previewRecords.find((t) => t.id === previewId) && (
        <TradePreview
          trade={previewRecords.find((t) => t.id === previewId)!}
          onClose={() => setPreviewId(null)}
          onEdit={() => {
            const trade = previewRecords.find((t) => t.id === previewId)!;
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
    <ViewFiltersProvider>
      <JournalProvider>
        <Workspace />
      </JournalProvider>
    </ViewFiltersProvider>
  );
}
