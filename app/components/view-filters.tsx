import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { initialFilters, type ViewFilters } from "../lib/view-filters";
const Context = createContext<{
  filters: ViewFilters;
  update: (next: Partial<ViewFilters>) => void;
}>({ filters: initialFilters("", null), update: () => {} });
export function ViewFiltersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation(),
    navigate = useNavigate();
  const [filters, setFilters] = useState(() => {
    let saved = null;
    try {
      saved =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem("trade-notes-view-v1")
          : null;
    } catch {
      /* Optional session preference. */
    }
    return initialFilters(location.search, saved);
  });
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.has("from") || p.has("pair") || p.has("setup"))
      setFilters((current) =>
        initialFilters(location.search, JSON.stringify(current)),
      );
  }, [location.search]);
  const currentLocation = useRef(location);
  currentLocation.current = location;
  const currentFilters = useRef(filters);
  currentFilters.current = filters;
  function update(change: Partial<ViewFilters>) {
    const next = { ...currentFilters.current, ...change };
    currentFilters.current = next;
    setFilters(next);
    try {
      sessionStorage.setItem("trade-notes-view-v1", JSON.stringify(next));
    } catch {
      /* Optional session preference. */
    }
    const target = currentLocation.current;
    const p = new URLSearchParams(target.search);
    for (const [key, value] of Object.entries(next)) {
      if (value) p.set(key, value);
      else p.delete(key);
    }
    navigate(
      { pathname: target.pathname, search: p.toString() },
      { replace: true },
    );
  }
  return (
    <Context.Provider value={{ filters, update }}>{children}</Context.Provider>
  );
}
export const useViewFilters = () => useContext(Context);
