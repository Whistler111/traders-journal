import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Trade } from "../app/lib/journal";
const fixture = vi.hoisted(() => ({
  trades: [] as Trade[],
  view: vi.fn(),
  download: vi.fn(),
}));
vi.mock("../app/components/provider", () => ({
  useJournal: () => ({
    trades: fixture.trades,
    practice: { timezone: "UTC", playbooks: [], reflections: [] },
    range: { from: "2026-10-01", to: "2026-10-31" },
    flags: new Map(),
  }),
}));
vi.mock("react-router", () => ({
  useOutletContext: () => ({ view: fixture.view }),
}));
vi.mock("../app/lib/download", () => ({ download: fixture.download }));
import Reports from "../app/routes/reports";
beforeEach(() => {
  fixture.trades = [];
  fixture.view.mockClear();
  fixture.download.mockClear();
});
it("renders empty reports and exports the selected empty range", () => {
  render(<Reports />);
  expect(screen.getByText("No trades in this range.")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Export selected range as CSV" }),
  );
  expect(fixture.download).toHaveBeenCalledOnce();
});
it("opens calendar trades and exposes timezone-based grouping", () => {
  fixture.trades = [
    {
      reason: "Recorded",
      lesson: "",
      stop: 1,
      entry: 1.1,
      followed: "unsure",
      emotion: "Calm",
      session: "Other",
      id: "a",
      date: "2026-10-18T10:00",
      sourceTimestamp: "2026-10-18T10:00:00Z",
      closedAt: "2026-10-18T11:00:00Z",
      status: "closed",
      pnl: 20,
      risk: 10,
      setup: "Sweep",
      symbol: "EURUSD",
      direction: "Long",
    },
  ];
  render(<Reports />);
  fireEvent.change(screen.getByLabelText("Grouping"), {
    target: { value: "session" },
  });
  expect(screen.getByText("London", { selector: "td" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^2026-10-18:/ }));
  fireEvent.click(screen.getByRole("button", { name: /EURUSD/ }));
  expect(fixture.view).toHaveBeenCalledWith(fixture.trades[0]);
});
