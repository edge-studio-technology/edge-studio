import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  RadioTower,
  Server,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DarkHeroCard } from "../components/DarkHeroCard";
import { LoadingDots } from "../components/LoadingDots";
import { MinimaIcon } from "../components/MinimaIcon";
import { Page } from "../components/Page";
import { Pill } from "../components/Pill";
import { MetricCard } from "../components/patterns/MetricCard";
import { ErrorText, Eyebrow, MutedText } from "../components/Text";
import { listDataReads } from "../features/data-reads/dataReadsApi";
import type { DataSourceRead } from "../features/data-reads/dataReadTypes";
import { getHistory } from "../features/integritas/integritasApi";
import type { IntegritasProofRecord } from "../features/integritas/integritasTypes";
import { useIntegritasHistoryAutoRefresh } from "../features/integritas/useIntegritasHistoryAutoRefresh";
import { getDeviceStatus } from "../features/status/statusApi";
import type { DeviceNodeState, DeviceStatus } from "../features/status/statusTypes";
import { getWalletStatus } from "../features/wallet/walletApi";
import { formatAmountThreshold } from "../lib/format";
import { formatLocalTime } from "../lib/time";
import { APP_NAME } from "../app/names";
import { DashboardNextAction } from "./DashboardNextAction";

const DASHBOARD_POLL_INTERVAL_MS = 30_000;
const STATUS_RESTARTING_INTERVAL_MS = 3_000;

type ActivityItem = {
  id: string;
  createdAt: string;
  category: string;
  message: string;
  status: string;
  good: boolean;
};

const useCaseSteps = [
  {
    number: "01",
    title: "Connect data",
    text: "Sensor, file, API, webhook, or device log",
    icon: Database,
  },
  {
    number: "02",
    title: "Prove data",
    text: "Integritas timestamp, integrity check, and provenance",
    icon: ShieldCheck,
  },
  {
    number: "03",
    title: "Trigger action",
    text: "Run workflows from data, proofs, or token events",
    icon: Zap,
  },
  {
    number: "04",
    title: "Settle value",
    text: "Wallet payments, token access, and future marketplace revenue",
    icon: Wallet,
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [proofs, setProofs] = useState<IntegritasProofRecord[]>([]);
  const [reads, setReads] = useState<DataSourceRead[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    // Wallet balance is only meaningful when the node can actually answer RPC calls,
    // so fetch it in lockstep with node status instead of on its own independent timer —
    // otherwise the two drift out of sync (e.g. wallet still shows a pre-restart balance
    // after the node status has already flipped to "restarting").
    const tick = () => {
      getDeviceStatus()
        .then((status) => {
          if (cancelled) return;
          setDeviceStatus(status);

          if (status.node.state === "restarting") {
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

    Promise.all([getHistory({ page: 1, pageSize: 100 }), listDataReads({ page: 1, pageSize: 100 })])
      .then(([proofHistory, readHistory]) => {
        setProofs(proofHistory.items);
        setReads(readHistory.items);
      })
      .catch((err: Error) => setActivityError(err.message));

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useIntegritasHistoryAutoRefresh(proofs, setProofs, { query: { page: 1, pageSize: 100 } });

  const activity = useMemo(() => buildActivity(proofs, reads), [proofs, reads]);

  return (
    <Page
      title={`${APP_NAME} dashboard`}
      desc="Your workspace for trusted data, proofs, automation and value flows at the edge."
    >
      <DashboardNextAction />

      <DeviceStatusCard
        status={deviceStatus}
        walletBalance={walletBalance}
        walletLoading={walletLoading}
      />

      <Card className="grid gap-5">
        <div>
          <Eyebrow>Live activity</Eyebrow>
          <h3 className="my-2 text-2xl text-slate-950">Events, attestations, and actions</h3>
          <MutedText className="m-0">
            A clear activity layer helps users understand what the Pi is doing in the background.
          </MutedText>
        </div>
        {activityError && <ErrorText>{activityError}</ErrorText>}
        <div className="grid gap-2.5">
          {activity.map((item) => (
            <article
              className="grid items-center gap-3.5 rounded-[18px] border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
              key={item.id}
            >
              <div>
                <strong>{item.category}</strong>
                <MutedText className="m-0 mt-1.5 leading-relaxed">{item.message}</MutedText>
              </div>
              <time className="font-mono text-sm font-extrabold text-slate-600">
                {formatLocalTime(item.createdAt)}
              </time>
              <Pill tone={item.good ? "good" : "warn"}>{item.status}</Pill>
            </article>
          ))}
        </div>
        {activity.length === 0 && !activityError && (
          <MutedText>No Diagnostics history entries yet.</MutedText>
        )}
      </Card>
    </Page>
  );
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

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

function DeviceStatusCard({
  status,
  walletBalance,
  walletLoading,
}: {
  status: DeviceStatus | null;
  walletBalance: string | null;
  walletLoading: boolean;
}) {
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

function buildActivity(proofs: IntegritasProofRecord[], reads: DataSourceRead[]) {
  const proofItems: ActivityItem[] = proofs.map((proof) => ({
    id: `proof-${proof.id}`,
    createdAt: proof.created_at,
    category: "Integritas API log",
    message: `Attestation created for ${proof.file_name ?? proof.hash.slice(0, 16)}`,
    status:
      proof.proof_status === "ready"
        ? "Success"
        : proof.proof_status === "failed"
          ? "Failed"
          : "Pending",
    good: proof.proof_status !== "failed",
  }));

  const readItems: ActivityItem[] = reads.map((read) => ({
    id: `read-${read.id}`,
    createdAt: read.createdAt,
    category:
      read.triggerType === "automation"
        ? "Trigger history"
        : read.triggerType === "mqtt"
          ? "MQTT event"
          : read.triggerType === "webhook"
            ? "Webhook event"
            : read.triggerType === "gpio"
              ? "GPIO event"
              : "Data read log",
    message: `${read.sourceName} ${read.triggerType === "automation" ? "automation poll" : read.triggerType === "mqtt" ? "MQTT message received" : read.triggerType === "webhook" ? "webhook payload received" : read.triggerType === "gpio" ? "GPIO edge detected" : "manual read"}`,
    status: read.status === "success" ? "Success" : "Failed",
    good: read.status === "success",
  }));

  return [...proofItems, ...readItems]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 10);
}
