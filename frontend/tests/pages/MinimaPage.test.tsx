import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../src/components/ToastProvider";
import { MinimaPage } from "../../src/pages/MinimaPage";

const refresh = vi.fn();
let reportError: (message: string) => void;

vi.mock("../../src/features/minima/useMinimaStatusRefresh", () => ({
  useMinimaStatusRefresh: (_onStatus: unknown, onError: (message: string) => void) => {
    reportError = onError;
    return { refresh };
  },
}));

vi.mock("../../src/features/minima/MinimaSettingsPanel", () => ({
  MinimaSettingsPanel: () => null,
}));
vi.mock("../../src/features/minima/MinimaBackupPanel", () => ({ MinimaBackupPanel: () => null }));
vi.mock("../../src/features/minima/MinimaConsolePanel", () => ({ MinimaConsolePanel: () => null }));
vi.mock("../../src/features/minima/MinimaHealthCard", () => ({
  MinimaHealthCard: () => <div>Node health content</div>,
}));
vi.mock("../../src/features/minima/MinimaContainerCard", () => ({
  MinimaContainerCard: () => <div>Container health content</div>,
}));
vi.mock("../../src/features/minima/MinimaSummaryGrid", () => ({
  MinimaSummaryGrid: () => <div>Summary content</div>,
}));

describe("MinimaPage", () => {
  beforeEach(() => refresh.mockReset().mockResolvedValue(null));

  it("settles first-load failure into a retryable error without unavailable status cards", async () => {
    render(<MinimaPage />, { wrapper: ToastProvider });

    act(() => reportError("status down"));

    expect(screen.getByText("Couldn't load Minima status")).toBeInTheDocument();
    expect(screen.getByText("status down")).toBeInTheDocument();
    expect(screen.queryByText("Node health content")).not.toBeInTheDocument();
    expect(screen.queryByText("Summary content")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
