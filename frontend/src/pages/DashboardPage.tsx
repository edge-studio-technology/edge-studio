import { useEffect, useMemo, useState } from "react";
import { Page } from "../components/patterns/Page";
import { Card } from "../components/ui/Card";
import { Pill } from "../components/ui/Pill";
import { DashboardDevices } from "../features/dashboard/DashboardDevices";
import { DashboardNextAction } from "../features/dashboard/DashboardNextAction";
import { listDataReads } from "../features/data-reads/dataReadsApi";
import type { DataSourceRead } from "../features/data-reads/dataReadTypes";
import { getHistory } from "../features/integritas/integritasApi";
import type { IntegritasProofRecord } from "../features/integritas/integritasTypes";
import { useIntegritasHistoryAutoRefresh } from "../features/integritas/useIntegritasHistoryAutoRefresh";
import { formatLocalDateTime } from "../lib/time";
import { APP_NAME } from "../app/names";
import type { Tone } from "../app/types";

type ActivityItem = {
  id: string;
  createdAt: string;
  category: string;
  message: string;
  status: string;
  tone: Tone;
};

export function DashboardPage() {
  const [proofs, setProofs] = useState<IntegritasProofRecord[]>([]);
  const [reads, setReads] = useState<DataSourceRead[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getHistory({ page: 1, pageSize: 100 }), listDataReads({ page: 1, pageSize: 100 })])
      .then(([proofHistory, readHistory]) => {
        setProofs(proofHistory.items);
        setReads(readHistory.items);
      })
      .catch((err: Error) => setActivityError(err.message));
  }, []);

  useIntegritasHistoryAutoRefresh(proofs, setProofs, { query: { page: 1, pageSize: 100 } });

  const activity = useMemo(() => buildActivity(proofs, reads), [proofs, reads]);

  return (
    <Page
      title={`${APP_NAME} dashboard`}
      desc="Node and device status, wallet balance, and recent proof and read activity."
    >
      <DashboardNextAction />
      <DashboardDevices />

      <Card className="gap-detail-close flex w-full flex-col">
        <div className="gap-detail-next flex flex-col">
          <h2 className="type-title text-text-primary m-0">Live activity</h2>
          <p className="type-body text-text-secondary m-0">
            Events, attestations, and actions from proofs and data reads.
          </p>
        </div>
        {activityError ? <p className="type-meta text-text-error">{activityError}</p> : null}
        <div className="gap-detail-next flex flex-col">
          {activity.map((item) => (
            <article
              className="border-stroke-secondary bg-surface-primary gap-detail-close rounded-soft p-detail-close grid items-center border sm:grid-cols-[minmax(0,1fr)_auto_auto]"
              key={item.id}
            >
              <div className="min-w-0">
                <p className="type-body-em text-text-primary m-0">{item.category}</p>
                <p className="type-meta text-text-secondary mt-detail-tight m-0">{item.message}</p>
              </div>
              <time className="type-meta text-text-secondary" dateTime={item.createdAt}>
                {formatLocalDateTime(item.createdAt)}
              </time>
              <Pill tone={item.tone} indicator>
                {item.status}
              </Pill>
            </article>
          ))}
        </div>
        {activity.length === 0 && !activityError ? (
          <div className="border-stroke-secondary bg-surface-primary gap-detail-close rounded-soft p-detail-close grid items-center border sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <p className="type-body text-text-secondary m-0">No live activity yet.</p>
          </div>
        ) : null}
      </Card>
    </Page>
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
    tone: proof.proof_status === "ready" ? "good" : proof.proof_status === "failed" ? "error" : "neutral",
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
    tone: read.status === "success" ? "good" : "error",
  }));

  return [...proofItems, ...readItems]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 10);
}
