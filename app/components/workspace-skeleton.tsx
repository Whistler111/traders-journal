export function WorkspaceSkeleton({ full = false }: { full?: boolean }) {
  return (
    <div
      className={"workspace-skeleton" + (full ? " skeleton-full" : "")}
      role="status"
      aria-label="Loading your trading space"
    >
      <span className="sr-only">Opening your trading space</span>
      <div className="skeleton skeleton-heading" />
      <div className="skeleton-tiles">
        {[0, 1, 2, 3, 4].map((n) => (
          <div className="skeleton" key={n} />
        ))}
      </div>
      <div className="skeleton-panels">
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
      <div className="skeleton skeleton-table" />
    </div>
  );
}
