import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Settings } from "lucide-react";
import type { MinimaNodeStatus } from "../app/types";
import { Button, IconButton } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Page } from "../components/patterns/Page";
import { useToast } from "../components/ToastProvider";
import {
  getMinimaNodeStatus,
  resyncMegammr,
  restartMinimaContainer,
} from "../features/minima/minimaApi";
import { MinimaConsolePanel } from "../features/minima/MinimaConsolePanel";
import { MinimaConsoleWhitelistModal } from "../features/minima/MinimaConsoleWhitelistModal";
import { MinimaContainerCard } from "../features/minima/MinimaContainerCard";
import { MinimaHealthCard } from "../features/minima/MinimaHealthCard";
import { mergeMinimaStatus } from "../features/minima/mergeMinimaStatus";
import { parseMegammrResyncResult, resyncToastForResult } from "../features/minima/minimaResync";
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
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resyncing, setResyncing] = useState(false);
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

  useMinimaStatusRefresh(handleStatus, handleStatusError, {
    enabled: !resyncing && !restarting && !busy,
  });

  async function refreshAfterOperation(): Promise<boolean> {
    setStatusError(null);
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

  async function restartContainer(options?: { silent?: boolean }) {
    setRestarting(true);
    setStatusError("Minima container restart in progress. RPC may be briefly unavailable.");

    let commandSucceeded = false;

    try {
      const result = await restartMinimaContainer();
      commandSucceeded = true;
      showToast({
        tone: "info",
        title: "Minima container restarting",
        message: `Docker service ${result.service} (${result.containerId}) is restarting.`,
        timeoutMs: 10000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Restart failed";
      showToast({ tone: "error", title: "Minima restart failed", message, timeoutMs: 9000 });
      throw error;
    } finally {
      const recovered = await refreshAfterOperation();
      setRestarting(false);

      if (commandSucceeded && !options?.silent) {
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
    setRestartConfirmOpen(false);
    setBusy(true);
    try {
      await restartContainer();
    } finally {
      setBusy(false);
    }
  }

  async function runResync() {
    setBusy(true);
    setResyncing(true);
    setStatusError("Megammr resync in progress. Minima RPC may be briefly unavailable.");

    let restartedContainer = false;

    try {
      const parsed = await resyncMegammr();
      const meta = parseMegammrResyncResult(parsed);

      if (!meta.rpcOk) {
        showToast(resyncToastForResult(parsed));
        return;
      }

      if (meta.needsRestart) {
        setStatusError("Resync complete. Restarting Minima container…");
        setResyncing(false);
        await restartContainer({ silent: true });
        restartedContainer = true;
      }

      const toast = resyncToastForResult(parsed, { restartedContainer });
      showToast({ ...toast, timeoutMs: toast.tone === "info" ? 12000 : 8000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resync failed";
      showToast({ tone: "error", title: "Megammr resync failed", message, timeoutMs: 9000 });
    } finally {
      if (!restartedContainer) {
        await refreshAfterOperation();
      }
      setBusy(false);
      setResyncing(false);
      setRestarting(false);
    }
  }

  // Only let Resync/Restart be pressed once we have a confirmed status and it isn't
  // already mid-operation — before the first successful load, we don't know enough
  // to say either action would do anything useful.
  const actionsBlocked = busy || !nodeStatus || nodeStatus.state === "restarting";

  // Prefer the specific local message for whoever triggered the operation; fall back to
  // a generic one driven by backend truth so the banner survives navigating away and back
  // mid-operation (a fresh mount has no local statusError, but the node status still does).
  const operationBanner =
    statusError ??
    (nodeStatus?.state === "restarting"
      ? "Minima is restarting. RPC may be briefly unavailable."
      : null);

  return (
    <Page
      title="Run the Minima node"
      desc="Start, monitor, and manage the Minima Core node running on the Raspberry Pi Edition."
    >
      {operationBanner && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {operationBanner}
        </div>
      )}

      <section className="gap-detail-close grid w-full items-stretch lg:grid-cols-2">
        <MinimaHealthCard
          status={nodeStatus}
          loading={statusLoading && !nodeStatus}
          refreshing={resyncing || restarting || nodeStatus?.state === "restarting"}
        />
        <MinimaContainerCard
          status={nodeStatus}
          loading={statusLoading && !nodeStatus}
          busy={actionsBlocked}
          refreshing={restarting || nodeStatus?.state === "restarting"}
          onRestart={openRestartConfirm}
        />
      </section>

      <MinimaSummaryGrid
        status={nodeStatus}
        loading={statusLoading && !nodeStatus}
        busy={actionsBlocked}
        refreshing={resyncing || restarting || nodeStatus?.state === "restarting"}
        onResync={runResync}
      />

      <Card className="gap-detail-close flex w-full flex-col">
        <div className="gap-detail-next flex items-start justify-between">
          <button
            type="button"
            onClick={() => setConsoleOpen((open) => !open)}
            aria-expanded={consoleOpen}
            className="gap-detail-next flex min-w-0 flex-1 items-start border-0 bg-transparent p-0 text-left"
          >
            {consoleOpen ? (
              <ChevronDown size={18} className="text-icon-secondary mt-detail-tight shrink-0" />
            ) : (
              <ChevronRight size={18} className="text-icon-secondary mt-detail-tight shrink-0" />
            )}
            <div className="gap-detail-next flex min-w-0 flex-col">
              <h2 className="type-title text-text-primary m-0">RPC console</h2>
              <p className="type-body text-text-secondary m-0">
                Run whitelisted Minima RPC commands and see the raw response.
              </p>
            </div>
          </button>
          <IconButton
            aria-label="Edit console command whitelist"
            variant="secondary"
            onClick={() => setConsoleWhitelistOpen(true)}
          >
            <Settings size={16} />
          </IconButton>
        </div>
        {consoleOpen ? <MinimaConsolePanel disabled={actionsBlocked} /> : null}
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
              <Button type="button" disabled={busy || restarting} onClick={() => void confirmRestart()}>
                Restart
              </Button>
            </>
          }
        />
      ) : null}
    </Page>
  );
}
