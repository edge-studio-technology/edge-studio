import { useEffect, useState } from "react";
import { Cpu, HardDrive, MemoryStick, RadioTower, Server, ShieldCheck } from "lucide-react";
import { LoadingDots } from "../../components/LoadingDots";
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

function nodeStateValueClass(state: DeviceNodeState) {
  if (state === "running") return "text-text-success";
  if (state === "restarting") return "text-text-accent";
  if (state === "unknown") return "text-text-tertiary";
  return "text-text-warning";
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
  const diskHelper = device
    ? device.disk
      ? `of ${formatBytes(device.disk.totalBytes)} · ${pct(device.disk.usedBytes, device.disk.totalBytes)} used`
      : "/data unavailable"
    : undefined;
  const walletUnavailable = walletLoading || walletBalance === null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Wallet balance"
          icon={<MinimaIcon size={20} />}
          value={
            walletLoading && !nodeRestarting ? (
              <LoadingDots />
            ) : nodeRestarting || walletBalance === null ? (
              "Unavailable"
            ) : (
              <span className="block min-w-0 truncate" title={walletBalance}>
                {formatAmountThreshold(walletBalance)}
              </span>
            )
          }
          helper="Primary Pi Wallet"
          valueClassName={walletUnavailable ? "text-text-tertiary" : undefined}
        />
        <MetricCard
          label="Node status"
          icon={<RadioTower size={20} />}
          value={node ? node.state.charAt(0).toUpperCase() + node.state.slice(1) : <LoadingDots />}
          helper="Minima node"
          valueClassName={node ? nodeStateValueClass(node.state) : "text-text-tertiary"}
        />
        <MetricCard
          label="Integritas API"
          icon={<ShieldCheck size={20} />}
          value={
            !app ? (
              <LoadingDots />
            ) : app.integritasConnected === null ? (
              "Not configured"
            ) : app.integritasConnected ? (
              "Connected"
            ) : (
              "Unreachable"
            )
          }
          helper="API connection"
          valueClassName={
            !app || app.integritasConnected === null
              ? "text-text-tertiary"
              : app.integritasConnected
                ? "text-text-success"
                : "text-text-warning"
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Device"
          icon={<Server size={20} />}
          value={device ? device.hostname : <LoadingDots />}
          helper={device ? `${device.platform} · ${device.arch}` : undefined}
        />
        <MetricCard
          label="Device CPU"
          icon={<Cpu size={20} />}
          value={cpuPct ?? <LoadingDots />}
          helper={
            device ? `${device.cpuCount}-core · ${device.loadAvg[0].toFixed(2)} 1m avg` : undefined
          }
        />
        <MetricCard
          label="Device Memory"
          icon={<MemoryStick size={20} />}
          value={device ? formatBytes(device.memory.usedBytes) : <LoadingDots />}
          helper={
            device
              ? `of ${formatBytes(device.memory.totalBytes)} · ${pct(device.memory.usedBytes, device.memory.totalBytes)} used`
              : undefined
          }
        />
        <MetricCard
          label="Device Disk"
          icon={<HardDrive size={20} />}
          value={diskValue ?? <LoadingDots />}
          helper={diskHelper}
        />
      </div>
    </>
  );
}
