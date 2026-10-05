import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UpdateStatus } from "../../src/app/types";
import { UpdatePage } from "../../src/pages/UpdatePage";

const getUpdateStatus = vi.hoisted(() => vi.fn());
const startUpdateApply = vi.hoisted(() => vi.fn());

vi.mock("../../src/features/update/updateApi", () => ({
  getUpdateStatus: (...args: unknown[]) => getUpdateStatus(...args),
  startUpdateApply: (...args: unknown[]) => startUpdateApply(...args),
}));

vi.mock("../../src/features/update/ChangelogPreview", () => ({
  ChangelogPreview: () => <div>Changelog</div>,
}));

const currentStatus: UpdateStatus = {
  manifest: {
    frontend: "frontend@sha256:1",
    backend: "backend@sha256:1",
    updateAgent: "update-agent@sha256:1",
    version: "1.2.3",
    createdAt: "2026-09-22T00:00:00.000Z",
  },
  services: [
    {
      service: "frontend",
      currentImage: "frontend@sha256:1",
      targetImage: "frontend@sha256:1",
      upToDate: true,
    },
  ],
  currentVersion: "1.2.3",
};

describe("UpdatePage", () => {
  it("settles an unavailable update agent into an error and recovers through Retry", async () => {
    getUpdateStatus
      .mockRejectedValueOnce(new Error("update agent unavailable"))
      .mockResolvedValueOnce(currentStatus);

    render(<UpdatePage />);

    expect(screen.getByText("Checking for updates")).toBeInTheDocument();
    expect(await screen.findByText("Update status isn't available")).toBeInTheDocument();
    expect(screen.getByText("update agent unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Up to date")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Up to date")).toBeInTheDocument();
    expect(getUpdateStatus).toHaveBeenCalledTimes(2);
  });
});
