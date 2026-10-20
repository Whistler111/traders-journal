import { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Workspace from "../app/routes/workspace";
import Overview from "../app/routes/home";
import Journal from "../app/routes/journal";
import Review from "../app/routes/review";
import { FeedbackAnimation } from "../app/components/feedback";
import { KEY, type Trade } from "../app/lib/journal";
import { authMock, cloud, seedTrades, storedTrades } from "./cloud-fixture";
vi.mock(
  "firebase/firestore",
  async () => (await import("./cloud-fixture")).firestoreMock,
);
vi.mock(
  "../app/lib/firebase",
  async () => (await import("./cloud-fixture")).firebaseMock,
);
vi.mock(
  "../app/components/auth/AuthProvider",
  async () => (await import("./cloud-fixture")).authMock,
);
beforeEach(() => {
  cloud.documents.clear();
  cloud.uid = "fictional-owner";
  cloud.failure = "";
  cloud.documents.set(`users/${cloud.uid}/settings/onboarding`, {
    version: 1,
    step: 4,
    status: "completed",
  });
});
const base: Trade = {
  id: "a",
  date: "2026-10-18T14:30",
  symbol: "XAUUSD",
  setup: "Sweep",
  reason: "Confirmation",
  lesson: "Legacy notes",
  direction: "Long",
  session: "London",
  emotion: "Calm",
  status: "closed",
  followed: "yes",
  entry: 2700,
  stop: 2690,
  risk: 25,
  pnl: 50,
};
function app(path = "/journal", records?: Trade[]) {
  if (records) seedTrades(records);
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Workspace />}>
            <Route index element={<Overview />} />
            <Route path="overview" element={<Overview />} />
            <Route path="journal" element={<Journal />} />
            <Route path="review" element={<Review />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}
const control = (dialog: HTMLElement, name: string) =>
  dialog.querySelector(`[name="${name}"]`)!;
function change(dialog: HTMLElement, name: string, value: string) {
  fireEvent.change(control(dialog, name), { target: { value } });
}
async function openNew() {
  fireEvent.click(await screen.findByRole("button", { name: "+ Log a trade" }));
  return screen.getByRole("dialog");
}
function fill(dialog: HTMLElement) {
  for (const [name, value] of Object.entries({
    symbol: "XAUUSD",
    entry: "2700",
    stop: "2690",
    risk: "25",
    reason: "Confirmation",
    date: "2026-10-18T14:30",
  }))
    change(dialog, name, value);
}
async function submit(dialog: HTMLElement) {
  await act(async () => {
    fireEvent.submit(dialog.querySelector("form")!);
  });
}
describe("React journaling workflow", () => {
  it("shows a dashboard sign-out action and retains data if signing out fails", async () => {
    const signOut = vi
      .fn()
      .mockRejectedValue(Error("Could not reach sign-in service."));
    const mock = vi.spyOn(authMock, "useAuth").mockReturnValue({
      user: {
        uid: cloud.uid,
        email: "fictional@example.invalid",
        emailVerified: true,
        providerData: [],
      },
      signOut,
    });
    try {
      app("/", [base]);
      const section = await screen.findByRole("region", {
        name: "Account access",
      });
      fireEvent.click(
        within(section).getByRole("button", { name: "Sign out" }),
      );
      expect(await within(section).findByRole("alert")).toHaveTextContent(
        "Could not reach sign-in service.",
      );
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(storedTrades()).toHaveLength(1);
      expect(
        within(section).getByRole("button", { name: "Sign out" }),
      ).toBeEnabled();
    } finally {
      mock.mockRestore();
    }
  });
  it("starts empty without importing fictional data, creates once, and persists after remount", async () => {
    const view = app();
    await screen.findByText("Your next trade has a story.");
    expect(localStorage.getItem(KEY)).toBeNull();
    const dialog = await openNew();
    fill(dialog);
    await submit(dialog);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storedTrades()).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Trade saved");
    view.unmount();
    app();
    expect(
      await screen.findByRole("button", { name: /Edit XAUUSD/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Trade saved. Your journal is up to date."),
    ).not.toBeInTheDocument();
  });
  it("edits legacy fields safely, closes and reopens while keeping initial risk", async () => {
    app("/journal", [
      {
        ...base,
        customField: "retained",
        status: "open",
        pnl: null,
        reason: "<img src=x onerror=alert(1)>",
      },
    ]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    let dialog = screen.getByRole("dialog");
    change(dialog, "status", "closed");
    change(dialog, "pnl", "0");
    change(dialog, "lesson", "Updated review");
    change(dialog, "exit", "2720");
    change(dialog, "size", "0.01 lot");
    await submit(dialog);
    let saved = storedTrades()[0];
    expect(saved).toMatchObject({ customField: "retained", risk: 25, pnl: 0 });
    expect(saved).not.toHaveProperty("exit");
    expect(saved.lesson).toContain("[Trade details]");
    expect(document.querySelector("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    dialog = screen.getByRole("dialog");
    change(dialog, "status", "open");
    await submit(dialog);
    saved = storedTrades()[0];
    expect(saved.pnl).toBeNull();
    expect(saved.risk).toBe(25);
  });
  it("retains form contents on failed save and confirms success only after retry", async () => {
    app();
    const dialog = await openNew();
    fill(dialog);
    cloud.failure = "Fictional cloud unavailable";
    await submit(dialog);
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Fictional cloud unavailable",
    );
    expect(control(dialog, "symbol")).toHaveValue("XAUUSD");
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(
      screen.queryByText("Trade saved. Your journal is up to date."),
    ).not.toBeInTheDocument();
    cloud.failure = "";
    await submit(dialog);
    expect(storedTrades()).toHaveLength(1);
  });
  it("reveals Advanced for validation errors and distinguishes empty P&L from zero", async () => {
    app();
    const dialog = await openNew();
    fill(dialog);
    change(dialog, "stop", "2710");
    await submit(dialog);
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Long initial stop",
    );
    expect(dialog.querySelector("details")).toHaveAttribute("open");
    change(dialog, "stop", "2690");
    change(dialog, "status", "closed");
    await submit(dialog);
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter 0");
    expect(localStorage.getItem(KEY)).toBeNull();
  });
  it("searches, filters and confirms deletion", async () => {
    app("/journal", [base, { ...base, id: "b", symbol: "EURUSD", pnl: -25 }]);
    await screen.findByRole("button", { name: /Edit XAUUSD/ });
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "EURUSD" },
    });
    expect(
      screen.queryByRole("button", { name: /Edit XAUUSD/ }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter trade outcome"), {
      target: { value: "win" },
    });
    expect(screen.getByText("No matching trades.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filter trade outcome"), {
      target: { value: "loss" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Edit EURUSD/ }));
    vi.mocked(confirm).mockReturnValueOnce(false);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete trade" }));
    });
    expect(storedTrades()).toHaveLength(2);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete trade" }));
    });
    expect(storedTrades()).toHaveLength(1);
  });
  it.each([
    "/",
    "/overview",
    "/journal",
    "/review",
    "/#review",
    "/#journal",
    "/#overview",
  ])("renders route %s", async (path) => {
    app(path);
    const name = path.includes("review")
      ? "Playbooks & review"
      : path.includes("journal")
        ? "Trade journal"
        : "Dashboard";
    expect(
      await screen.findByRole("heading", { name: new RegExp(name) }),
    ).toBeInTheDocument();
  });
  it("rejects malformed imports, confirms replacement, and restores valid backups", async () => {
    app("/journal", [base]);
    await screen.findByRole("button", { name: /Edit/ });
    const input = screen.getByLabelText("Restore backup file");
    const upload = (data: unknown) => {
      const file = new File([JSON.stringify(data)], "backup.json", {
        type: "application/json",
      });
      Object.defineProperty(file, "text", {
        value: async () => JSON.stringify(data),
      });
      fireEvent.change(input, { target: { files: [file] } });
    };
    upload({ version: 1, trades: [base, { ...base, id: "bad", risk: 0 }] });
    await screen.findByText(/Restore failed/);
    expect(storedTrades()[0].id).toBe("a");
    vi.mocked(confirm).mockReturnValueOnce(false);
    upload({ version: 1, trades: [] });
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(storedTrades()).toHaveLength(1);
    upload({ version: 1, trades: [{ ...base, id: "restored" }] });
    await screen.findByText("Restored 1 trades.");
    expect(storedTrades()[0].id).toBe("restored");
  });
  it("keeps malformed legacy data intact without using it as the cloud journal", async () => {
    localStorage.setItem(KEY, "broken");
    app();
    await screen.findByRole("button", {
      name: "Import trades from this device",
    });
    expect(screen.getByRole("button", { name: "+ Log a trade" })).toBeEnabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Import trades from this device" }),
    );
    await waitFor(() => expect(localStorage.getItem(KEY)).toBe("broken"));
    expect(storedTrades()).toEqual([]);
  });
  it("acknowledges a new written review once without rewarding trade count", async () => {
    const view = app("/journal", [{ ...base, lesson: "", followed: "unsure" }]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit XAUUSD/ }));
    const dialog = screen.getByRole("dialog");
    change(
      dialog,
      "lesson",
      "Waited for confirmation; next time check the session.",
    );
    change(dialog, "followed", "yes");
    await submit(dialog);
    expect(
      screen.getByText(
        "Reflection saved. Taking time to review your decisions matters.",
      ),
    ).toBeInTheDocument();
    view.unmount();
    app("/journal");
    fireEvent.click(await screen.findByRole("button", { name: /Edit XAUUSD/ }));
    await submit(screen.getByRole("dialog"));
    expect(
      screen.queryByText(
        "Reflection saved. Taking time to review your decisions matters.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Your first 10 trades recorded."),
    ).not.toBeInTheDocument();
  });
  it("does not celebrate ten trades or show trading targets in Review", async () => {
    const nine = Array.from({ length: 9 }, (_, index) => ({
      ...base,
      id: String(index),
      followed: "unsure" as const,
    }));
    const view = app("/journal", nine);
    const dialog = await openNew();
    fill(dialog);
    await submit(dialog);
    expect(storedTrades()).toHaveLength(10);
    expect(
      screen.queryByText("Your first 10 trades recorded."),
    ).not.toBeInTheDocument();
    view.unmount();
    app("/review");
    expect(
      await screen.findByText(/closed trades reviewed/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Keep building toward/)).not.toBeInTheDocument();
  });
  it("recognizes a completed daily reflection without a trading or attendance target", async () => {
    app("/review");
    fireEvent.change(await screen.findByLabelText("My focus before trading"), {
      target: { value: "Be patient." },
    });
    vi.useFakeTimers();
    try {
      await act(async () =>
        fireEvent.click(
          screen.getByRole("button", { name: "Save reflection" }),
        ),
      );
      const message =
        "You recorded what worked and one adjustment. A useful moment of reflection.";
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("What went well?"), {
        target: { value: "Waited for my setup." },
      });
      fireEvent.change(screen.getByLabelText("One thing for next time"), {
        target: { value: "Check the session first." },
      });
      await act(async () =>
        fireEvent.click(
          screen.getByRole("button", { name: "Save reflection" }),
        ),
      );
      expect(screen.getByText(message)).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(2300));
      fireEvent.change(screen.getByLabelText("One thing for next time"), {
        target: { value: "Check the session and my rules." },
      });
      await act(async () =>
        fireEvent.click(
          screen.getByRole("button", { name: "Save reflection" }),
        ),
      );
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      expect(storedTrades()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
describe("animation fallbacks", () => {
  it("uses static feedback under reduced motion without fetching artwork", () => {
    render(<FeedbackAnimation type="success" />);
    expect(document.querySelector(".feedback-fallback svg")).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps the icon when artwork is missing", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const view = render(<FeedbackAnimation type="loss" />);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/lottie/loss.json",
        expect.any(Object),
      ),
    );
    expect(document.querySelector(".feedback-fallback svg")).toBeVisible();
    view.unmount();
  });
});
