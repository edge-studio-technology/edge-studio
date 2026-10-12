import { useCallback, useEffect, useRef, useState } from "react";
import { Database } from "lucide-react";
import type { MinimaNodeStatus, MinimaResyncOperation } from "../app/types";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Disclosure } from "../components/ui/Disclosure";
import { Modal } from "../components/ui/Modal";
import { Pill } from "../components/ui/Pill";
import { Page } from "../components/patterns/Page";
import { ErrorContentState } from "../components/patterns/ErrorContentState";
import { ErrorAlert } from "../components/patterns/ErrorAlert";
import { formatLocalDateTime } from "../lib/time";
import { describeLoadFailure } from "../lib/errors";
import { SubSection } from "../components/patterns/SubSection";
import { useToast } from "../components/ToastProvider";
import {
  getMinimaNodeStatus,
  resyncMegammr,
  restartMinimaContainer,
} from "../features/minima/minimaApi";
import { MinimaBackupPanel } from "../features/minima/MinimaBackupPanel";
import { MinimaConsolePanel } from "../features/minima/MinimaConsolePanel";
import { MinimaConsoleWhitelistModal } from "../features/minima/MinimaConsoleWhitelistModal";
import { MinimaContainerCard } from "../features/minima/MinimaContainerCard";
import { MinimaHealthCard } from "../features/minima/MinimaHealthCard";
import { mergeMinimaStatus } from "../features/minima/mergeMinimaStatus";
import { resyncPhaseLabel } from "../features/minima/minimaResync";
import { useMinimaResync } from "../features/minima/useMinimaResync";
import { MinimaResyncProgressPanel } from "../features/minima/MinimaResyncProgressPanel";
import type { ApiError } from "../lib/api";
import { MinimaSettingsPanel } from "../features/minima/MinimaSettingsPanel";
import { MinimaSummaryGrid } from "../features/minima/MinimaSummaryGrid";
import { useMinimaStatusRefresh } from "../features/minima/useMinimaStatusRefresh";

// A real container restart (JVM stop/start, chain reload) can easily take longer than a
// few seconds — this needs to stay in the same ballpark as the backend's own operation
// window (minima-monitoring.ts, ~120s) so the toast doesn't give up on a restart the
// backend still considers normal and in-progress.
const REFRESH_AFTER_OPERATION_INTERVAL_MS = 3000;
const REFRESH_AFTER_OPERATION_MAX_MS = 90000;

export function MinimaPage() {
  const { showToast } = useToast();
  const [nodeStatus, setNodeStatus] = useState<MinimaNodeStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resyncSubmitting, setResyncSubmitting] = useState(false);
  const resync = useMinimaResync();
  const previousOperation = useRef<MinimaResyncOperation | null>(null);
  const notified = useRef<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [consoleWhitelistOpen, setConsoleWhitelistOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);

  const handleStatus = useCallback((status: MinimaNodeStatus) => {
    setNodeStatus((previous) => mergeMinimaStatus(previous, status));
    setStatusError(null);
    setStatusLoading(false);
  }, []);

  const handleStatusError = useCallback((message: string) => {
    setStatusError(message);
    setStatusLoading(false);
  }, []);

  const { refresh: refreshStatus } = useMinimaStatusRefresh(handleStatus, handleStatusError, {
    enabled: !restarting && !busy,
    reportTransientErrors: true,
  });

  async function refreshAfterOperation(): Promise<boolean> {
    const deadline = Date.now() + REFRESH_AFTER_OPERATION_MAX_MS;

    while (true) {
      try {
        const status = await getMinimaNodeStatus();
        handleStatus(status);
        if (status.rpc.ok) return true;
      } catch {
        // Keep last known stats; polling will retry when enabled.
      }
      if (Date.now() >= deadline) return false;
      await new Promise((resolve) =>
        window.setTimeout(resolve, REFRESH_AFTER_OPERATION_INTERVAL_MS),
      );
    }
  }

  async function restartContainer() {
    setRestarting(true);
    showToast({
      tone: "info",
      title: "Minima container restarting",
      message: "RPC may be briefly unavailable while the Docker container restarts.",
      timeoutMs: 10000,
    });

    let commandSucceeded = false;

    try {
      await restartMinimaContainer();
      commandSucceeded = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Restart failed";
      showToast({ tone: "error", title: "Minima restart failed", message, timeoutMs: 9000 });
      throw error;
    } finally {
      const recovered = await refreshAfterOperation();
      setRestarting(false);

      if (commandSucceeded) {
        showToast(
          recovered
            ? {
                tone: "success",
                title: "Restart complete",
                message: "Minima container is back online.",
                timeoutMs: 8000,
              }
            : {
                tone: "error",
                title: "Restart taking longer than expected",
                message: "Minima RPC hasn't responded yet — check Node health.",
                timeoutMs: 9000,
              },
        );
      }
    }
  }

  function openRestartConfirm() {
    setRestartConfirmOpen(true);
  }

  function closeRestartConfirm() {
    if (busy || restarting) return;
    setRestartConfirmOpen(false);
  }

  async function confirmRestart() {
    if (actionsBlocked) return;
    setRestartConfirmOpen(false);
    setBusy(true);
    try {
      await restartContainer();
    } catch {
      // restartContainer already reported the failure through a toast.
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const operation = resync.operation;
    const previous = previousOperation.current;
    previousOperation.current = operation;
    if (!operation?.outcome || previous?.id !== operation.id) return;
    const transition = `${operation.id}:${operation.outcome}:${operation.recovered}:${operation.busy}`;
    if (notified.current === transition || (previous.outcome === operation.outcome && previous.recovered === operation.recovered && previous.busy === operation.busy)) return;
    notified.current = transition;
    showToast({
      tone: operation.outcome === "completed" ? "success" : operation.outcome === "failed" ? "error" : "warning",
      title: resyncPhaseLabel[operation.phase],
      message: operation.message,
      timeoutMs: 9000,
    });
  }, [resync.operation, showToast]);

  useEffect(() => {
    if (nodeStatus?.resync) void resync.refresh();
  }, [nodeStatus?.resync?.id, nodeStatus?.resync?.updatedAt, resync.refresh]);

  async function runResync() {
    if (resyncSubmitting || actionsBlocked) return;
    setResyncSubmitting(true);
    try {
      const operation = await resyncMegammr();
      resync.accept(operation);
      showToast({ tone: "info", title: "Resync starting", message: "The backend is checking the node and dispatching the request.", timeoutMs: 10000 });
    } catch (error) {
      const status = (error as ApiError)?.status;
      const rejected = status !== undefined && status >= 400 && status < 500;
      showToast({
        tone: rejected ? "error" : "warning",
        title: status === 409 ? "Node operation already active" : rejected ? "Could not start resync" : "Resync start not confirmed",
        message: rejected ? describeLoadFailure(error instanceof Error ? error.message : "Resync request rejected") : "The connection was interrupted. Checking backend progress before another request.",
        timeoutMs: 9000,
      });
      await resync.refresh();
    } finally {
      setResyncSubmitting(false);
    }
  }

  // Only let Resync/Restart be pressed once we have a confirmed status and it isn't
  // already mid-operation — before the first successful load, we don't know enough
  // to say either action would do anything useful.
  const statusResync = nodeStatus?.resync;
  const resyncSummary = statusResync && (!resync.operation || statusResync.startedAt > resync.operation.startedAt || statusResync.updatedAt > resync.operation.updatedAt)
    ? statusResync : resync.operation ?? statusResync ?? null;
  const operationBusy = !!resyncSummary?.busy;
  const actionsBlocked = busy || resyncSubmitting || resync.loading || !!resync.error || operationBusy || !nodeStatus || nodeStatus.state === "restarting";
  const nodeRestarting = restarting || nodeStatus?.state === "restarting";

  return (
    <Page title="Minima" desc="Start, monitor, and manage the Minima node running on this device.">
      <Card className="gap-detail-close grid w-full">
        <Disclosure
          title={
            <span className="gap-detail-close flex flex-wrap items-center">
              <h2 className="type-title text-text-primary m-0">Minima settings</h2>
            </span>
          }
          defaultOpen={false}
          contentClassName="gap-detail-close grid"
        >
          <MinimaSettingsPanel bare minimaState={nodeStatus?.state ?? null} />
          <SubSection
            icon={<Database size={13} />}
            title="Node backup & restore"
            description="Full node backups include the seed phrase, private keys, coin proofs, and transaction history — a superset of a plain seed-phrase wallet import."
          >
            <MinimaBackupPanel bare minimaState={nodeStatus?.state ?? null} operationBusy={actionsBlocked} />
          </SubSection>
          {/* Deprecated in favor of Node backup & restore above (superset: full node backup
              vs. wallet-keys-only). Seed-phrase-only restore is still a distinct recovery path
              (no backup file needed) and is planned as a "coming soon" option in
              MinimaBackupPanel for v1.5 — see docs/TASKS.md. Left commented, not deleted, for
              an easy revert. */}
          {/* <WalletSettingsPanel /> */}
        </Disclosure>
      </Card>

      {statusError && nodeStatus ? (
        <ErrorAlert title="Node status update unavailable" action={<Button size="sm" variant="secondary" onClick={() => void refreshStatus()}>Retry node status</Button>}>
          {describeLoadFailure(statusError)} Showing metrics last observed {formatLocalDateTime(nodeStatus.metricsObservedAt ?? nodeStatus.checkedAt)}.
        </ErrorAlert>
      ) : null}

      <section className="gap-detail-close grid w-full items-stretch lg:grid-cols-2">
        {statusError && !nodeStatus ? (
          <ErrorContentState
            title="Minima status isn't available"
            description={describeLoadFailure(statusError)}
            className="lg:col-span-2"
            onRetry={() => {
              setStatusLoading(true);
              setStatusError(null);
              void refreshStatus();
            }}
          />
        ) : null}
        {!statusError || nodeStatus ? (
          <>
            <MinimaHealthCard
              status={nodeStatus}
              loading={statusLoading && !nodeStatus}
              refreshing={nodeRestarting && !operationBusy}
              resync={resyncSummary}
            />
            <MinimaContainerCard
              status={nodeStatus}
              loading={statusLoading && !nodeStatus}
              busy={actionsBlocked}
              refreshing={nodeRestarting && !operationBusy}
              resync={resyncSummary}
              onRestart={openRestartConfirm}
            />
          </>
        ) : null}
      </section>

      {!statusError || nodeStatus ? (
        <MinimaSummaryGrid
          status={nodeStatus}
          loading={statusLoading && !nodeStatus}
          busy={actionsBlocked || !!statusError}
          resyncing={operationBusy}
          resync={resyncSummary}
          refreshing={nodeRestarting && !operationBusy}
          onResync={runResync}
        />
      ) : null}

      <MinimaResyncProgressPanel operation={resync.operation} loading={resync.loading} error={resync.error} onRetry={() => void resync.refresh()} />

      <Card className="gap-detail-close flex w-full flex-col">
        <Disclosure
          title={
            <div className="gap-detail-next flex min-w-0 items-center">
              <h2 className="type-title text-text-primary m-0">RPC console</h2>
              <Pill>Beta</Pill>
            </div>
          }
          contentClassName="gap-detail-close grid"
          open={consoleOpen}
          onToggle={(event) => setConsoleOpen(event.currentTarget.open)}
        >
          <p className="type-body text-text-secondary m-0">
            Run whitelisted Minima RPC commands and see the raw response.
          </p>
          <MinimaConsolePanel
            disabled={actionsBlocked || !!statusError || nodeStatus?.state !== "running"}
            onEditWhitelist={() => setConsoleWhitelistOpen(true)}
            onCommandComplete={() => void resync.refresh()}
          />
        </Disclosure>
      </Card>

      {consoleWhitelistOpen ? (
        <MinimaConsoleWhitelistModal onClose={() => setConsoleWhitelistOpen(false)} />
      ) : null}

      {restartConfirmOpen ? (
        <Modal
          title="Restart Minima container?"
          description="RPC will be briefly unavailable while the Docker container restarts."
          onClose={closeRestartConfirm}
          closeDisabled={busy || restarting}
          className="!max-w-[420px]"
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || restarting}
                onClick={closeRestartConfirm}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={actionsBlocked || restarting}
                onClick={() => void confirmRestart()}
              >
                Restart
              </Button>
            </>
          }
        />
      ) : null}
    </Page>
  );
}
