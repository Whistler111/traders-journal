import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { mkdirSync, writeFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
import { OnboardingTour, TOUR_STEPS } from "../app/components/onboarding-tour";
import type { TourProgress } from "../app/lib/onboarding-repo";
const fake = vi.hoisted(() => ({
  progress: null as TourProgress | null,
  load: vi.fn(),
  save: vi.fn(),
}));
vi.mock("../app/components/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "fictional-tour-owner" } }),
}));
vi.mock("../app/lib/onboarding-repo", () => ({
  onboardingRepo: { load: fake.load, save: fake.save },
}));
function Surface() {
  const location = useLocation();
  return (
    <>
      <div id="content">
        {TOUR_STEPS.filter((s) => s.route === location.pathname).map((s) => (
          <section key={s.target} data-tour={s.target}>
            {s.target}
          </section>
        ))}
      </div>
      <output data-testid="route">{location.pathname}</output>
      <OnboardingTour enabled />
    </>
  );
}
function app() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Surface />
    </MemoryRouter>,
  );
}
function capture(dialog: HTMLElement, step: number) {
  if (process.env.JOURNAL_TOUR_VISUAL_CAPTURE !== "1") return;
  mkdirSync("test-results/tour-markup", { recursive: true });
  writeFileSync(`test-results/tour-markup/step-${step}.html`, dialog.outerHTML);
}
beforeEach(() => {
  fake.progress = null;
  fake.load.mockReset();
  fake.save.mockReset();
  fake.load.mockImplementation(async () => fake.progress);
  fake.save.mockImplementation(async (_uid, state) => {
    fake.progress = state;
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
it("introduces five steps, completes once and can be replayed", async () => {
  const view = app();
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Step 1 of 5")).toBeInTheDocument();
  expect(document.body.style.overflow).toBe("hidden");
  for (let step = 1; step <= 4; step++) {
    capture(dialog, step);
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(
        within(dialog).getByText(`Step ${step + 1} of 5`),
      ).toBeInTheDocument(),
    );
  }
  capture(dialog, 5);
  fireEvent.click(within(dialog).getByRole("button", { name: "Finish tour" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(fake.progress).toEqual({ version: 1, step: 4, status: "completed" });
  expect(document.body.style.overflow).toBe("");
  view.unmount();
  app();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Quick tour" })).toBeEnabled(),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Quick tour" }));
  expect(await screen.findByRole("dialog")).toHaveTextContent("Step 1 of 5");
});
it("resumes the saved step, supports Back and persists Skip", async () => {
  fake.progress = { version: 1, step: 3, status: "active" };
  app();
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent("Step 4 of 5");
  await waitFor(() =>
    expect(screen.getByTestId("route")).toHaveTextContent("/review"),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));
  await waitFor(() => expect(dialog).toHaveTextContent("Step 3 of 5"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Skip tour" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(fake.progress?.status).toBe("skipped");
});
it("keeps progress on save failure and allows closing without writing", async () => {
  fake.save.mockRejectedValue(Error("Fictional connection failure"));
  app();
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Fictional connection failure",
  );
  expect(dialog).toHaveTextContent("Step 1 of 5");
  expect(fake.progress).toBeNull();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Close for now" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("handles Escape as Skip and prevents duplicate saves while pending", async () => {
  let finish: (() => void) | undefined;
  fake.save.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  app();
  const dialog = await screen.findByRole("dialog"),
    next = within(dialog).getByRole("button", { name: "Next" });
  fireEvent.click(next);
  fireEvent.click(next);
  expect(fake.save).toHaveBeenCalledTimes(1);
  await act(async () => finish?.());
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(fake.progress?.status).toBe("skipped");
});
