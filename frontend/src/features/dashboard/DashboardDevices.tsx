import { useEffect, useState } from "react";
import type { Status } from "../../app/types";
import { MinimaIcon } from "../../components/MinimaIcon";
import { MetricCard } from "../../components/patterns/MetricCard";
import { formatAmountThreshold } from "../../lib/format";
import { getDeviceStatus } from "../status/statusApi";
import type { DeviceNodeState, DeviceStatus } from "../status/statusTypes";
import { getWalletStatus } from "../wallet/walletApi";

const DASHBOARD_POLL_INTERVAL_MS = 30_000;
const STATUS_RESTARTING_INTERVAL_MS = 3_000;

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function pct(used: number, total: number) {
  return `${Math.round((used / total) * 100)}%`;
}

// Local for now — extract to statusDisplay.ts (or similar) if Minima / another surface needs the same maps.
function deviceNodeStatus(state: DeviceNodeState): Status {
  if (state === "running") return "success";
  if (state === "error") return "error";
  if (state === "stopped") return "warning";
  return "neutral"; // restarting | unknown
}

function integritasConnectionStatus(connected: boolean | null): Status {
  if (connected === null) return "neutral";
  return connected ? "success" : "warning";
}

export function DashboardDevices() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    // Wallet balance is only meaningful when the node can actually answer RPC calls,
    // so fetch it in lockstep with node status instead of on its own independent timer —
    // otherwise the two drift out of sync (e.g. wallet still shows a pre-restart balance
    // after the node status has already flipped to "restarting").
    const tick = () => {
      getDeviceStatus()
        .then((nextStatus) => {
          if (cancelled) return;
          setStatus(nextStatus);

          if (nextStatus.node.state === "restarting") {
            setWalletLoading(true);
            setWalletBalance(null);
            timer = window.setTimeout(tick, STATUS_RESTARTING_INTERVAL_MS);
            return;
          }

          getWalletStatus()
            .then((ws) => {
              if (cancelled) return;
              const native = ws.tokens.find((t) => t.isNative);
              setWalletBalance(native?.confirmed ?? "0");
            })
            .catch(() => {
              if (cancelled) return;
              setWalletBalance(null);
            })
            .finally(() => {
              if (cancelled) return;
              setWalletLoading(false);
              timer = window.setTimeout(tick, DASHBOARD_POLL_INTERVAL_MS);
            });
        })
        .catch(() => {
          if (cancelled) return;
          timer = window.setTimeout(tick, DASHBOARD_POLL_INTERVAL_MS);
        });
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const device = status?.device ?? null;
  const app = status?.app ?? null;
  const node = status?.node ?? null;
  const nodeRestarting = node?.state === "restarting";
  const cpuPct = device ? `${Math.round((device.loadAvg[0] / device.cpuCount) * 100)}%` : null;
  const diskValue = device ? (device.disk ? formatBytes(device.disk.usedBytes) : "N/A") : null;
  const diskDescription = device
    ? device.disk
      ? `of ${formatBytes(device.disk.totalBytes)} · ${pct(device.disk.usedBytes, device.disk.totalBytes)} used`
      : "/data unavailable"
    : undefined;
  const walletUnavailable = nodeRestarting || walletBalance === null;

  return (
    <div className="gap-detail-close grid w-full grid-cols-2 xl:grid-cols-3">
      <MetricCard
        label="Wallet balance"
        icon={<MinimaIcon size={20} />}
        loading={walletLoading && !nodeRestarting}
        value={
          walletUnavailable ? (
            "Unavailable"
          ) : (
            <span className="block min-w-0 truncate" title={walletBalance ?? undefined}>
              {formatAmountThreshold(walletBalance!)}
            </span>
          )
        }
        description="Primary Pi Wallet"
      />
      <MetricCard
        label="Node status"
        loading={!node}
        value={node ? node.state.charAt(0).toUpperCase() + node.state.slice(1) : undefined}
        description="Minima node"
        status={node ? deviceNodeStatus(node.state) : "neutral"}
      />
      <MetricCard
        label="Integritas API"
        loading={!app}
        value={
          app?.integritasConnected === null
            ? "Not configured"
            : app?.integritasConnected
              ? "Connected"
              : "Unreachable"
        }
        description="API connection"
        status={app ? integritasConnectionStatus(app.integritasConnected) : "neutral"}
      />
      <MetricCard
        label="Device"
        loading={!device}
        value={device?.hostname}
        description={device ? `${device.platform} · ${device.arch}` : undefined}
      />
      <MetricCard
        label="Device CPU"
        loading={!device}
        value={cpuPct}
        description={
          device ? `${device.cpuCount}-core · ${device.loadAvg[0].toFixed(2)} 1m avg` : undefined
        }
      />
      <MetricCard
        label="Device Memory"
        loading={!device}
        value={device ? formatBytes(device.memory.usedBytes) : undefined}
        description={
          device
            ? `of ${formatBytes(device.memory.totalBytes)} · ${pct(device.memory.usedBytes, device.memory.totalBytes)} used`
            : undefined
        }
      />
      <MetricCard
        label="Device Disk"
        loading={!device}
        value={diskValue}
        description={diskDescription}
      />
    </div>
  );
}
