import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardDevices } from "../../../src/features/dashboard/DashboardDevices";
import type { DeviceStatus } from "../../../src/features/status/statusTypes";
import type { WalletStatus } from "../../../src/features/wallet/walletTypes";

const getDeviceStatus = vi.fn();
const getWalletStatus = vi.fn();

vi.mock("../../../src/features/status/statusApi", () => ({
  getDeviceStatus: (...args: unknown[]) => getDeviceStatus(...args),
}));

vi.mock("../../../src/features/wallet/walletApi", () => ({
  getWalletStatus: (...args: unknown[]) => getWalletStatus(...args),
}));

function deviceStatus(overrides: Partial<DeviceStatus> = {}): DeviceStatus {
  return {
    checkedAt: "2026-08-20T00:00:00.000Z",
    device: {
      id: "d1",
      hostname: "pi-1",
      platform: "linux",
      arch: "arm64",
      uptimeSeconds: 100,
      cpuCount: 4,
      memory: {
        totalBytes: 8 * 1024 ** 3,
        freeBytes: 4 * 1024 ** 3,
        usedBytes: 4 * 1024 ** 3,
      },
      loadAvg: [2, 1, 0.5],
      disk: {
        path: "/data",
        totalBytes: 100 * 1024 ** 3,
        freeBytes: 60 * 1024 ** 3,
        usedBytes: 40 * 1024 ** 3,
      },
    },
    app: {
      running: true,
      setupComplete: true,
      integritasConfigured: true,
      integritasConnected: true,
    },
    node: { state: "running", lastCheckedAt: "2026-08-20T00:00:00.000Z" },
    ...overrides,
  };
}

function walletStatus(overrides: Partial<WalletStatus> = {}): WalletStatus {
  return {
    checkedAt: "2026-08-20T00:00:00.000Z",
    tokens: [
      {
        tokenId: "0x00",
        name: "Minima",
        confirmed: "12.5",
        unconfirmed: "0",
        sendable: "12.5",
        isNative: true,
      },
    ],
    ...overrides,
  };
}

describe("DashboardDevices", () => {
  beforeEach(() => {
    getDeviceStatus.mockReset();
    getWalletStatus.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading indicators before status resolves", () => {
    getDeviceStatus.mockReturnValue(new Promise(() => {}));
    getWalletStatus.mockReturnValue(new Promise(() => {}));

    render(<DashboardDevices />);

    expect(screen.getAllByRole("status", { name: "Loading" }).length).toBeGreaterThan(0);
  });

  it("renders wallet balance, node, integritas, and device metrics once loaded", async () => {
    getDeviceStatus.mockResolvedValue(deviceStatus());
    getWalletStatus.mockResolvedValue(walletStatus());

    render(<DashboardDevices />);

    await waitFor(() => expect(screen.getByText("12.5")).toBeInTheDocument());

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("pi-1")).toBeInTheDocument();
    expect(screen.getByText("linux · arm64")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument(); // CPU: loadAvg[0]=2 / cpuCount=4
    expect(screen.getByText("4-core · 2.00 1m avg")).toBeInTheDocument();
    expect(screen.getByText("4.0 GB")).toBeInTheDocument(); // memory used
    expect(screen.getByText("of 8.0 GB · 50% used")).toBeInTheDocument();
    expect(screen.getByText("40.0 GB")).toBeInTheDocument(); // disk used
    expect(screen.getByText("of 100.0 GB · 40% used")).toBeInTheDocument();
    expect(screen.queryAllByRole("status", { name: "Loading" })).toHaveLength(0);
  });

  it("shows integritas as not configured when integritasConnected is null", async () => {
    getDeviceStatus.mockResolvedValue(
      deviceStatus({ app: { running: true, setupComplete: true, integritasConfigured: false, integritasConnected: null } }),
    );
    getWalletStatus.mockResolvedValue(walletStatus());

    render(<DashboardDevices />);

    await waitFor(() => expect(screen.getByText("Not configured")).toBeInTheDocument());
  });

  it("shows integritas as unreachable when integritasConnected is false", async () => {
    getDeviceStatus.mockResolvedValue(
      deviceStatus({ app: { running: true, setupComplete: true, integritasConfigured: true, integritasConnected: false } }),
    );
    getWalletStatus.mockResolvedValue(walletStatus());

    render(<DashboardDevices />);

    await waitFor(() => expect(screen.getByText("Unreachable")).toBeInTheDocument());
  });

  it("shows N/A and an unavailable disk description when disk info is missing", async () => {
    getDeviceStatus.mockResolvedValue(deviceStatus({ device: { ...deviceStatus().device, disk: null } }));
    getWalletStatus.mockResolvedValue(walletStatus());

    render(<DashboardDevices />);

    await waitFor(() => expect(screen.getByText("N/A")).toBeInTheDocument());
    expect(screen.getByText("/data unavailable")).toBeInTheDocument();
  });

  it("marks wallet unavailable and skips the wallet fetch while the node is restarting", async () => {
    getDeviceStatus.mockResolvedValue(deviceStatus({ node: { state: "restarting", lastCheckedAt: null } }));
    getWalletStatus.mockResolvedValue(walletStatus());

    render(<DashboardDevices />);

    await waitFor(() => expect(screen.getByText("Restarting")).toBeInTheDocument());
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(getWalletStatus).not.toHaveBeenCalled();
  });

  it("marks wallet unavailable when the wallet fetch fails", async () => {
    getDeviceStatus.mockResolvedValue(deviceStatus());
    getWalletStatus.mockRejectedValue(new Error("wallet unreachable"));

    render(<DashboardDevices />);

    await waitFor(() => expect(screen.getByText("Unavailable")).toBeInTheDocument());
  });

  it("stays in a loading state when the status fetch fails", async () => {
    getDeviceStatus.mockRejectedValue(new Error("status unreachable"));
    getWalletStatus.mockResolvedValue(walletStatus());

    render(<DashboardDevices />);

    await waitFor(() => expect(getDeviceStatus).toHaveBeenCalled());
    expect(screen.getAllByRole("status", { name: "Loading" }).length).toBeGreaterThan(0);
    expect(getWalletStatus).not.toHaveBeenCalled();
  });
});
