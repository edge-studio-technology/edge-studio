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

  it("shows the verified current version and the target version", async () => {
    getUpdateStatus.mockResolvedValue({
      ...currentStatus,
      services: [{ ...currentStatus.services[0], currentImage: "frontend@sha256:0", upToDate: false }],
      currentVersion: "1.2.2",
    });

    render(<UpdatePage />);

    expect(await screen.findByText("1.2.2 → 1.2.3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update now" })).toBeInTheDocument();
  });

  it("warns instead of showing vX → vX when the reported version equals the target", async () => {
    getUpdateStatus.mockResolvedValue({
      ...currentStatus,
      services: [{ ...currentStatus.services[0], currentImage: "frontend@sha256:0", upToDate: false }],
      currentVersion: "1.2.3",
    });

    render(<UpdatePage />);

    expect(await screen.findByText("This installation doesn't match a release.")).toBeInTheDocument();
    expect(screen.getByText("Version 1.2.3 is available.")).toBeInTheDocument();
    expect(screen.queryByText("1.2.3 → 1.2.3")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update now" })).toBeInTheDocument();
  });

  it("warns when no verified version is reported", async () => {
    getUpdateStatus.mockResolvedValue({
      ...currentStatus,
      services: [{ ...currentStatus.services[0], currentImage: "frontend@sha256:0", upToDate: false }],
      currentVersion: null,
    });

    render(<UpdatePage />);

    expect(await screen.findByText("This installation doesn't match a release.")).toBeInTheDocument();
    expect(screen.getByText("Version 1.2.3 is available.")).toBeInTheDocument();
  });

  it("does not warn when the verified version is behind the target", async () => {
    getUpdateStatus.mockResolvedValue({
      ...currentStatus,
      services: [{ ...currentStatus.services[0], currentImage: "frontend@sha256:0", upToDate: false }],
      currentVersion: "1.2.2",
    });

    render(<UpdatePage />);

    expect(await screen.findByText("1.2.2 → 1.2.3")).toBeInTheDocument();
    expect(screen.queryByText("This installation doesn't match a release.")).not.toBeInTheDocument();
  });

  it("reports the running version while only the update service is still updating itself", async () => {
    getUpdateStatus.mockResolvedValue({
      ...currentStatus,
      services: [
        ...currentStatus.services,
        { service: "update-agent", currentImage: "update-agent@sha256:0", targetImage: "update-agent@sha256:1", upToDate: false },
      ],
    });

    render(<UpdatePage />);

    expect(await screen.findByText("Running version 1.2.3. The update service is still updating itself.")).toBeInTheDocument();
  });
});
