import { useCallback, useState } from "react";
import type { MinimaNodeStatus } from "../app/types";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Disclosure } from "../components/ui/Disclosure";
import { Modal } from "../components/ui/Modal";
import { Pill } from "../components/ui/Pill";
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
  const [statusLoading, setStatusLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [consoleWhitelistOpen, setConsoleWhitelistOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);

  const handleStatus = useCallback((status: MinimaNodeStatus) => {
    setNodeStatus((previous) => mergeMinimaStatus(previous, status));
    setStatusLoading(false);
  }, []);

  const handleStatusError = useCallback((_message: string) => {
    setStatusLoading(false);
  }, []);

  useMinimaStatusRefresh(handleStatus, handleStatusError, {
    enabled: !resyncing && !restarting && !busy,
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

  async function restartContainer(options?: { silent?: boolean }) {
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
    showToast({
      tone: "info",
      title: "Megammr resync in progress",
      message: "Minima RPC may be briefly unavailable.",
      timeoutMs: 10000,
    });

    let restartedContainer = false;

    try {
      const parsed = await resyncMegammr();
      const meta = parseMegammrResyncResult(parsed);

      if (!meta.rpcOk) {
        showToast(resyncToastForResult(parsed));
        return;
      }

      if (meta.needsRestart) {
        setResyncing(false);
        showToast({
          tone: "info",
          title: "Resync complete",
          message: "Restarting Minima container…",
          timeoutMs: 10000,
        });
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
  const nodeRestarting = restarting || nodeStatus?.state === "restarting";

  return (
    <Page
      title="Minima"
      desc="Start, monitor, and manage the Minima node running on this device."
    >
      <section className="gap-detail-close grid w-full items-stretch lg:grid-cols-2">
        <MinimaHealthCard
          status={nodeStatus}
          loading={statusLoading && !nodeStatus}
          refreshing={resyncing || nodeRestarting}
        />
        <MinimaContainerCard
          status={nodeStatus}
          loading={statusLoading && !nodeStatus}
          busy={actionsBlocked}
          refreshing={nodeRestarting}
          onRestart={openRestartConfirm}
        />
      </section>

      <MinimaSummaryGrid
        status={nodeStatus}
        loading={statusLoading && !nodeStatus}
        busy={actionsBlocked}
        resyncing={resyncing}
        refreshing={resyncing || nodeRestarting}
        onResync={runResync}
      />

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
            disabled={actionsBlocked}
            onEditWhitelist={() => setConsoleWhitelistOpen(true)}
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
                disabled={busy || restarting}
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
