import { useEffect, useState } from "react";
import type { MinimaConfig, MinimaNodeState, MinimaPeersResponse } from "../../app/types";
import { Card } from "../../components/Card";
import { ErrorText } from "../../components/Text";
import { useToast } from "../../components/ToastProvider";
import {
  addMinimaPeers,
  getAutoRestartEnabled,
  getMinimaConfig,
  getMinimaPeers,
  saveMinimaConfig,
  setAutoRestartEnabled
} from "./minimaApi";
import { MinimaRuntimeConfig } from "./MinimaRuntimeConfig";
import { useMinimaStatusRefresh } from "./useMinimaStatusRefresh";

export function MinimaSettingsPanel({ bare = false }: { bare?: boolean } = {}) {
  const { showToast } = useToast();
  const [minimaState, setMinimaState] = useState<MinimaNodeState | null>(null);
  useMinimaStatusRefresh(
    (status) => setMinimaState(status.state),
    () => {}
  );
  // Same "confirmed running" gate used on the Wallet settings panel and the Minima
  // Core page's own Resync/Restart buttons — config/peer RPC calls would just fail
  // while the node isn't up.
  const actionsBlocked = minimaState !== "running";

  const [config, setConfig] = useState<MinimaConfig | null>(null);
  const [megammrHostInput, setMegammrHostInput] = useState("megammr.minima.global:9001");
  const [peerslistInput, setPeerslistInput] = useState("megammr.minima.global:9001");
  const [peers, setPeers] = useState<MinimaPeersResponse | null>(null);
  const [peersLoading, setPeersLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [autoRestartEnabled, setAutoRestartEnabledState] = useState<boolean | null>(null);
  const [togglingAutoRestart, setTogglingAutoRestart] = useState(false);

  useEffect(() => {
    refreshConfig().catch((err: Error) => setConfigError(err.message));
    getAutoRestartEnabled()
      .then((res) => setAutoRestartEnabledState(res.autoRestartEnabled))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // Wait for a confirmed "running" state before fetching peers — during a
    // user-triggered resync/restart the node briefly reports "restarting" (or
    // status hasn't resolved yet), and hitting the peers RPC then would just
    // fail as an expected side effect, not a real error.
    if (actionsBlocked) return;
    refreshPeers().catch(() => undefined);
  }, [actionsBlocked]);

  async function refreshConfig() {
    const parsed = await getMinimaConfig();
    setConfig(parsed);
    setMegammrHostInput(parsed.megammrHost);
  }

  async function refreshPeers() {
    setPeersLoading(true);
    try {
      setPeers(await getMinimaPeers());
    } catch (error) {
      showToast({
        tone: "error",
        title: "Failed to load peers",
        message: error instanceof Error ? error.message : "Unknown error",
        timeoutMs: 8000
      });
    } finally {
      setPeersLoading(false);
    }
  }

  async function saveConfig() {
    setBusy(true);
    setConfigError(null);
    try {
      const parsed = await saveMinimaConfig(megammrHostInput);
      setConfig(parsed);
      setMegammrHostInput(parsed.megammrHost);
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function runAddPeers() {
    if (!peerslistInput.trim()) return;

    setBusy(true);
    setConfigError(null);
    try {
      await addMinimaPeers(peerslistInput);
      showToast({
        tone: "success",
        title: "Peers added",
        message: "Minima accepted the add-peers request.",
        timeoutMs: 8000
      });
      await refreshPeers();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Add peers failed";
      setConfigError(message);
      showToast({ tone: "error", title: "Add peers failed", message, timeoutMs: 9000 });
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleAutoRestart() {
    if (autoRestartEnabled === null) return;
    setTogglingAutoRestart(true);
    try {
      const res = await setAutoRestartEnabled(!autoRestartEnabled);
      setAutoRestartEnabledState(res.autoRestartEnabled);
    } catch (error) {
      showToast({
        tone: "error",
        title: "Failed to update auto-restart",
        message: error instanceof Error ? error.message : "Unknown error",
        timeoutMs: 9000
      });
    } finally {
      setTogglingAutoRestart(false);
    }
  }

  const content = (
    <>
      {!bare && (
        <div className="mb-4 grid gap-1">
          <h3 style={{ margin: 0 }}>Minima node settings</h3>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
            Configure the megammr sync host and manage peer connections.
          </p>
        </div>
      )}

      {actionsBlocked && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <p className="text-sm text-amber-800" style={{ margin: 0 }}>
            Unavailable until Minima is running.
          </p>
        </div>
      )}

      <MinimaRuntimeConfig
        config={config}
        megammrHostInput={megammrHostInput}
        setMegammrHostInput={setMegammrHostInput}
        peers={peers}
        peersLoading={peersLoading}
        peerslistInput={peerslistInput}
        setPeerslistInput={setPeerslistInput}
        busy={busy || actionsBlocked}
        onSave={saveConfig}
        onAddPeers={runAddPeers}
      />
      {configError && <ErrorText>{configError}</ErrorText>}

      {/* Auto restart is disabled for now — deferred until automations get graceful
          handling around node restarts. See docs/TASKS.md. */}
      {/* <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2" style={{ marginTop: 16 }}>
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded border-slate-300"
          checked={autoRestartEnabled ?? false}
          disabled={autoRestartEnabled === null || togglingAutoRestart || actionsBlocked}
          onChange={() => void handleToggleAutoRestart()}
        />
        <span className="grid gap-0.5">
          <span className="text-sm font-semibold text-slate-700">Auto restart (every 48h)</span>
          <span className="text-xs text-slate-500">
            Restarts the Minima container on the same nightly schedule as auto backups, but only every other
            night, as a preventive node health measure.
          </span>
        </span>
      </label> */}
    </>
  );

  return bare ? content : <Card>{content}</Card>;
}
