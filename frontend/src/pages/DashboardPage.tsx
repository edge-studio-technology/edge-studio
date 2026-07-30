import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { Page } from "../components/Page";
import { Pill } from "../components/Pill";
import { ErrorText, Eyebrow, MutedText } from "../components/Text";
import { DashboardDevices } from "../features/dashboard/DashboardDevices";
import { DashboardNextAction } from "../features/dashboard/DashboardNextAction";
import { listDataReads } from "../features/data-reads/dataReadsApi";
import type { DataSourceRead } from "../features/data-reads/dataReadTypes";
import { getHistory } from "../features/integritas/integritasApi";
import type { IntegritasProofRecord } from "../features/integritas/integritasTypes";
import { useIntegritasHistoryAutoRefresh } from "../features/integritas/useIntegritasHistoryAutoRefresh";
import { formatLocalTime } from "../lib/time";
import { APP_NAME } from "../app/names";

type ActivityItem = {
  id: string;
  createdAt: string;
  category: string;
  message: string;
  status: string;
  good: boolean;
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
      desc="Your workspace for trusted data, proofs, automation and value flows at the edge."
    >
      <DashboardNextAction />
      <DashboardDevices />

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
