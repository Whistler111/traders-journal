import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Search, ArrowUpRight } from "lucide-react";
import { useJournal } from "./provider";
import { useViewFilters } from "./view-filters";
export function DesktopCommands({ onAdd }: { onAdd: () => void }) {
  const navigate = useNavigate(),
    { loadedTrades, trades } = useJournal(),
    { filters, update } = useViewFilters();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        !matchMedia("(pointer: fine)").matches ||
        matchMedia("(any-pointer: coarse)").matches
      )
        return;
      const target = e.target as HTMLElement;
      if (
        target.closest("input,textarea,select,[contenteditable=true]") ||
        document.querySelector("dialog[open]")
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setQuery("");
      } else if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.toLowerCase() === "n"
      ) {
        e.preventDefault();
        onAdd();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onAdd]);
  const pages = [
    { label: "Dashboard", to: "/" },
    { label: "Journal", to: "/journal" },
    { label: "Reports", to: "/reports" },
    { label: "Playbooks", to: "/review" },
    { label: "Settings", to: "/settings" },
  ];
  const items = [
    ...pages
      .filter((p) => p.label.toLowerCase().includes(query.toLowerCase()))
      .map((p) => ({ label: p.label, run: () => navigate(p.to) })),
    ...(!query || "add trade".includes(query.toLowerCase())
      ? [{ label: "Add trade", run: onAdd }]
      : []),
    ...[...new Set((loadedTrades ?? trades).map((t) => t.symbol))]
      .filter((p) => p.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8)
      .map((pair) => ({
        label: `Search ${pair}`,
        run: () => {
          update({ ...filters, pair });
          navigate(`/journal?${new URLSearchParams({ ...filters, pair })}`);
        },
      })),
  ];
  return (
    <>
      <button
        className="command-trigger"
        aria-label="Open command palette"
        onClick={() => {
          setOpen(true);
          setQuery("");
        }}
      >
        <Search size={16} />
        <span>Search or jump to…</span>
        <kbd>⌘ K</kbd>
      </button>
      {open && (
        <CommandDialog close={() => setOpen(false)}>
          <label className="command-search">
            <Search size={18} />
            <input
              autoFocus
              aria-label="Search commands or pair"
              placeholder="Jump to a page, add a trade, search a pair…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="command-results">
            {items.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setOpen(false);
                  item.run();
                }}
              >
                {item.label}
                <ArrowUpRight size={16} />
              </button>
            ))}
            {!items.length && <p>No matching commands.</p>}
          </div>
          <small>Tab to choose · Enter to open · Escape to close</small>
        </CommandDialog>
      )}
    </>
  );
}
function CommandDialog({
  children,
  close,
}: {
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const old = document.activeElement;
    ref.current!.showModal();
    return () => {
      if (old instanceof HTMLElement) old.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="command-palette"
      aria-label="Command palette"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {children}
    </dialog>
  );
}
