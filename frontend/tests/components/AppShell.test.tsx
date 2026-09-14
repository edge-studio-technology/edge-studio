import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../src/components/AppShell";

const getStatusOverview = vi.fn();
const getUpdateStatusSummary = vi.fn();

vi.mock("../../src/features/status/statusApi", () => ({
  getStatusOverview: (...args: unknown[]) => getStatusOverview(...args),
}));
vi.mock("../../src/features/update/updateApi", () => ({
  getUpdateStatusSummary: (...args: unknown[]) => getUpdateStatusSummary(...args),
}));
// FeedbackModal is a large, independently-scoped feature component with its own
// network calls (see features/feedback) — stub it so AppShell tests only assert
// that it's opened/closed with the right props, not its internal form behavior.
vi.mock("../../src/features/feedback/FeedbackModal", () => ({
  FeedbackModal: ({
    pagePath,
    pageLabel,
    onClose,
  }: {
    pagePath: string;
    pageLabel: string;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Feedback modal stub">
      <p>{`path:${pagePath}`}</p>
      <p>{`label:${pageLabel}`}</p>
      <button onClick={onClose}>Close feedback</button>
    </div>
  ),
}));

function renderShell(props?: Partial<ComponentProps<typeof AppShell>>) {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AppShell onSignOut={vi.fn()} {...props}>
        <p>Page content</p>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    getStatusOverview.mockResolvedValue(null);
    getUpdateStatusSummary.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the sidebar, status bar, and page content", async () => {
    renderShell();
    expect(screen.getByRole("link", { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "System status" })).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
    await act(async () => {});
  });

  it("hides the status bar when fullBleed is set", async () => {
    renderShell({ fullBleed: true });
    expect(screen.queryByRole("status", { name: "System status" })).not.toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
    await act(async () => {});
  });

  it("shows pending status labels before the overview resolves", async () => {
    renderShell();
    const statusBar = screen.getByRole("status", { name: "System status" });
    expect(within(statusBar).getByText("Node")).toBeInTheDocument();
    expect(within(statusBar).getByText("Integritas")).toBeInTheDocument();
    await act(async () => {});
  });

  it("reflects service health once the overview resolves", async () => {
    getStatusOverview.mockResolvedValue({
      generatedAt: "2026-08-20T00:00:00.000Z",
      services: [
        { name: "minima", ok: true, status: "ok", checkedAt: "2026-08-20T00:00:00.000Z" },
        { name: "integritas", ok: false, status: "error", error: "Not connected" },
      ],
    });

    renderShell();
    const statusBar = screen.getByRole("status", { name: "System status" });
    expect(await within(statusBar).findByText("Node online")).toBeInTheDocument();
    expect(within(statusBar).getByText("Integritas disconnected")).toBeInTheDocument();
  });

  it("opens the feedback modal with the current page path/label and closes it", async () => {
    renderShell();
    await act(async () => {});

    await userEvent.click(screen.getByRole("button", { name: "Feedback" }));
    expect(screen.getByRole("dialog", { name: "Feedback modal stub" })).toBeInTheDocument();
    expect(screen.getByText("path:/dashboard")).toBeInTheDocument();
    expect(screen.getByText("label:Dashboard")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close feedback" }));
    expect(screen.queryByRole("dialog", { name: "Feedback modal stub" })).not.toBeInTheDocument();
  });

  it("shows an update notice with the available version and navigates to /update", async () => {
    getUpdateStatusSummary.mockResolvedValue({
      checkedAt: "2026-08-20T00:00:00.000Z",
      services: [{ service: "frontend", currentImage: "a", targetImage: "b", upToDate: false }],
      currentVersion: "1.0.0",
      availableVersion: "1.1.0",
    });

    renderShell();
    expect(await screen.findByText("Update available")).toBeInTheDocument();
    expect(screen.getByText("Version 1.1.0 is ready to install.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "View update" }));
  });

  it("dismisses the update notice for the current version without re-showing it", async () => {
    getUpdateStatusSummary.mockResolvedValue({
      checkedAt: "2026-08-20T00:00:00.000Z",
      services: [{ service: "frontend", currentImage: "a", targetImage: "b", upToDate: false }],
      currentVersion: "1.0.0",
      availableVersion: "1.1.0",
    });

    renderShell();
    await screen.findByText("Update available");

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Update available")).not.toBeInTheDocument();
  });
});
