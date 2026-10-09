import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { recordAuditEvent } from "../auth/audit.service.js";
import { getComposeServiceContainer, inspectContainer } from "../status/docker.service.js";
import { startComposeService } from "../status/docker.control.js";
import { redactDeep, redactSecrets } from "../../shared/redact.js";
import { systemError, type StructuredError } from "../../shared/structured-error.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";
import { isMinimaOperationInProgress, recordAutoResyncResult, recordAutoResync } from "./minima-monitoring.js";
import { MinimaResyncConflictError } from "./minima.errors.js";
import { parseMegammrResyncMessage, parseStatusResponse, parseBlockCommandResponse } from "./minima.parse.js";
import { runMinimaPathCommand, fetchMinimaStatus } from "./minima.rpc.js";
import type { MinimaResyncOperation, MinimaResyncPhase, MinimaResyncTrigger } from "./minima.types.js";

const operationSetting = "minima_resync_operation";
const maxEvents = 100;
const maxMessageLength = 2000;
// See docs/adr/0033-observe-resync-after-client-timeout.md.
const rpcResponseTimeoutMs = 5 * 60 * 1000;
const cycleTimeoutMs = 5 * 60 * 1000;
const readinessTimeoutMs = 2 * 60 * 1000;
const observationIntervalMs = 3000;

type StoredOperation = Omit<MinimaResyncOperation, "busy"> & {
  version: 1;
  trigger: MinimaResyncTrigger;
  host: string;
  reserved: boolean;
  dispatchedAt: string | null;
  completionEvidence: boolean;
  responseSettled?: boolean;
  recoveryStartAttempted?: boolean;
  userId?: string | null;
  baseline?: { containerId: string; restartCount: number; startedAt: string };
  cycleDeadline?: string;
  cycleObservedAt?: string;
  auditedResult?: string;
};

type OperationUpdate = {
  phase: MinimaResyncPhase;
  message: string;
  errorDetails?: StructuredError;
  outcome?: MinimaResyncOperation["outcome"];
  recovered?: boolean;
  reserved?: boolean;
  dispatchedAt?: string;
  completionEvidence?: boolean;
  responseSettled?: boolean;
  recoveryStartAttempted?: boolean;
  baseline?: StoredOperation["baseline"];
  cycleDeadline?: string;
  cycleObservedAt?: string;
};

const activeMutations = new Set<symbol>();

function boundedMessage(message: string) {
  return redactSecrets(message).slice(0, maxMessageLength);
}

function readOperation(): StoredOperation | null {
  const value = getSetting(operationSetting);
  if (!value) return null;
  try {
    const operation = JSON.parse(value) as StoredOperation;
    if (operation.version !== 1 || typeof operation.id !== "string" || typeof operation.reserved !== "boolean" || !Array.isArray(operation.events)) {
      throw new Error("Invalid operation snapshot");
    }
    if (operation.baseline && (typeof operation.baseline.containerId !== "string" || !Number.isFinite(operation.baseline.restartCount) || !Number.isFinite(Date.parse(operation.baseline.startedAt)))) {
      throw new Error("Invalid process baseline");
    }
    return redactDeep(operation);
  } catch {
    throw new Error("Unable to read persisted Minima resync state; check the backend database before starting another operation.");
  }
}

function saveOperation(operation: StoredOperation) {
  saveSetting(operationSetting, JSON.stringify(redactDeep(operation)));
}

function toOperation(operation: StoredOperation): MinimaResyncOperation {
  return {
    id: operation.id,
    phase: operation.phase,
    startedAt: operation.startedAt,
    updatedAt: operation.updatedAt,
    finishedAt: operation.finishedAt,
    outcome: operation.outcome,
    recovered: operation.recovered,
    busy: operation.reserved,
    message: operation.message,
    events: operation.events,
    errorDetails: operation.errorDetails
  };
}

export function getMinimaResyncOperation(): MinimaResyncOperation | null {
  const operation = readOperation();
  return operation ? toOperation(operation) : null;
}

export function getMinimaResyncSummary() {
  const operation = getMinimaResyncOperation();
  if (!operation) return null;
  const { id, phase, startedAt, updatedAt, finishedAt, outcome, recovered, busy } = operation;
  return { id, phase, startedAt, updatedAt, finishedAt, outcome, recovered, busy };
}

export function assertNoMinimaResync() {
  if (readOperation()?.reserved) throw new MinimaResyncConflictError();
}

export function reserveMinimaMutation() {
  assertNoMinimaResync();
  const owner = Symbol();
  activeMutations.add(owner);
  return () => { activeMutations.delete(owner); };
}

export function updateMinimaResyncOperation(id: string, update: OperationUpdate): boolean {
  const operation = readOperation();
  if (!operation || operation.id !== id || !operation.reserved) return false;
  const message = boundedMessage(update.message);
  const errorDetails = update.errorDetails ? redactDeep({
    ...update.errorDetails,
    message: boundedMessage(update.errorDetails.message),
    nativeMessage: update.errorDetails.nativeMessage ? boundedMessage(update.errorDetails.nativeMessage) : undefined
  }) : operation.errorDetails;
  const changed = operation.phase !== update.phase || operation.message !== message
    || JSON.stringify(operation.errorDetails) !== JSON.stringify(errorDetails)
    || (update.recovered !== undefined && operation.recovered !== update.recovered)
    || (update.reserved !== undefined && operation.reserved !== update.reserved)
    || (update.outcome !== undefined && operation.outcome !== update.outcome)
    || (update.dispatchedAt !== undefined && operation.dispatchedAt !== update.dispatchedAt)
    || (update.completionEvidence !== undefined && operation.completionEvidence !== update.completionEvidence)
    || (update.baseline !== undefined && JSON.stringify(operation.baseline) !== JSON.stringify(update.baseline))
    || (update.cycleDeadline !== undefined && operation.cycleDeadline !== update.cycleDeadline)
    || (update.responseSettled !== undefined && operation.responseSettled !== update.responseSettled)
    || (update.recoveryStartAttempted !== undefined && operation.recoveryStartAttempted !== update.recoveryStartAttempted)
    || (update.cycleObservedAt !== undefined && operation.cycleObservedAt !== update.cycleObservedAt);
  if (!changed) return true;
  const updatedAt = new Date().toISOString();
  const terminal = update.phase === "completed" || update.phase === "failed" || update.phase === "unconfirmed";
  const next: StoredOperation = {
    ...operation,
    ...update,
    message,
    errorDetails,
    updatedAt,
    finishedAt: terminal ? (update.outcome !== undefined && update.outcome !== operation.outcome || update.reserved === false ? updatedAt : operation.finishedAt ?? updatedAt) : null,
    events: [...operation.events, { at: updatedAt, phase: update.phase, message, ...(update.errorDetails && errorDetails ? { errorDetails } : {}) }].slice(-maxEvents)
  };
  saveOperation(next);
  if (next.outcome) {
    const result = JSON.stringify({ id, trigger: next.trigger, outcome: next.outcome, recovered: next.recovered, busy: next.reserved });
    if (result !== next.auditedResult) {
      recordAuditEvent("minima.resync.result", { userId: next.userId, detail: result });
      saveOperation({ ...next, auditedResult: result });
    }
    if (next.trigger === "auto") recordAutoResyncResult(next.message);
  }
  return true;
}

let observerGeneration = 0;
let observer: { id: string; timer: NodeJS.Timeout | null } | null = null;

export function stopMinimaResyncObserver() {
  observerGeneration++;
  if (observer?.timer) clearTimeout(observer.timer);
  observer = null;
}

function startObserver(id: string) {
  stopMinimaResyncObserver();
  const owner = { id, timer: null as NodeJS.Timeout | null };
  observer = owner;
  const poll = async () => {
    if (observer !== owner) return;
    try {
      await observeResync(id, () => observer === owner);
      if (observer !== owner) return;
      const operation = readOperation();
      if (!operation?.reserved || operation.id !== id) { stopMinimaResyncObserver(); return; }
      owner.timer = setTimeout(() => { void poll(); }, operation.outcome === "unconfirmed" ? 30_000 : observationIntervalMs);
      owner.timer.unref();
    } catch (error) {
      if (observer === owner) {
        console.error("Minima resync observation failed:", boundedMessage(error instanceof Error ? error.message : "Unknown error"));
        stopMinimaResyncObserver();
      }
    }
  };
  owner.timer = setTimeout(() => { void poll(); }, observationIntervalMs);
  owner.timer.unref();
  return owner;
}

function unconfirmed(id: string, message: string) {
  updateMinimaResyncOperation(id, { phase: "unconfirmed", outcome: "unconfirmed", message,
    errorDetails: systemError({ type: "minima_resync_observation_expired", message }) });
}

async function observeResync(id: string, active: () => boolean) {
  let operation = readOperation();
  if (!operation?.reserved || operation.id !== id || !operation.baseline) return;
  const container = await getComposeServiceContainer("minima").catch(() => null);
  const info = container ? await inspectContainer(container.Id).catch(() => null) : null;
  if (!active()) return;
  operation = readOperation();
  if (!operation?.reserved || operation.id !== id) return;
  const baseline = operation.baseline!;
  const cycled = !!info && (container!.Id !== baseline.containerId || info.RestartCount !== baseline.restartCount || info.State.StartedAt !== baseline.startedAt);
  if (cycled && !operation.cycleObservedAt) {
    updateMinimaResyncOperation(id, { phase: operation.outcome ? "unconfirmed" : "recovering", message: "Node process cycle observed; checking RPC and chain readiness.", cycleObservedAt: new Date().toISOString() });
    operation = readOperation()!;
  }
  if (info && !info.State.Running && info.State.Status === "exited" && operation.completionEvidence && !operation.recoveryStartAttempted && !operation.outcome) {
    updateMinimaResyncOperation(id, { phase: "recovering", message: "Starting the stopped node after confirmed resync completion.", recoveryStartAttempted: true });
    try {
      await startComposeService("minima");
      if (!active()) return;
      updateMinimaResyncOperation(id, { phase: "recovering", message: "Resync completed and the node stopped; starting the node." });
    } catch (error) {
      if (!active()) return;
      updateMinimaResyncOperation(id, { phase: "failed", outcome: "failed", message: "Resync completed but starting the node failed; check the host before recovery.",
        errorDetails: systemError({ type: "minima_resync_start_failed", message: "Starting the node after resync failed.", nativeMessage: error instanceof Error ? error.message : "Unknown Docker error" }) });
    }
    return;
  }
  if (operation.cycleObservedAt && info?.State.Running && operation.responseSettled) {
    const result = await fetchMinimaStatus().catch(() => null);
    if (!active()) return;
    const parsed = parseStatusResponse(result?.body);
    if (result?.ok && parsed.rpcOk && parsed.block !== null) {
      let age = parsed.blockAgeSeconds;
      if (age === null) {
        const block = await runMinimaPathCommand("block").catch(() => null);
        if (!active()) return;
        if (block?.ok) age = parseBlockCommandResponse(block.body).blockAgeSeconds;
      }
      operation = readOperation()!;
      const confirmed = operation.completionEvidence;
      const chainWarning = age === null ? " Chain freshness is unavailable." : age > env.minimaStallBlockAgeSeconds ? " The chain is still catching up or stale." : "";
      updateMinimaResyncOperation(id, { phase: confirmed ? "completed" : "unconfirmed", outcome: confirmed ? "completed" : "unconfirmed", reserved: false,
        recovered: true, message: (confirmed ? "Resync completed; the node is back online." : "The node recovered, but the resync outcome could not be confirmed.") + chainWarning });
      return;
    }
  }
  operation = readOperation()!;
  if (operation.outcome || !operation.responseSettled) return;
  if (operation.cycleObservedAt && Date.now() >= Date.parse(operation.cycleObservedAt) + readinessTimeoutMs) {
    unconfirmed(id, "Node process cycle observed, but usable RPC and chain readiness were not confirmed. Check the host; resync remains reserved.");
  } else if (!operation.cycleObservedAt && operation.cycleDeadline && Date.now() >= Date.parse(operation.cycleDeadline)) {
    unconfirmed(id, "Could not confirm resync outcome or node process cycle. Check host diagnostics and confirm work has stopped before recovery; resync remains reserved.");
  }
}

export function reconcileMinimaResync() {
  const operation = readOperation();
  if (operation?.trigger === "auto") recordAutoResync(operation.message, operation.startedAt);
  if (!operation?.reserved) return;
  if (!operation.dispatchedAt) {
    updateMinimaResyncOperation(operation.id, { phase: "unconfirmed", outcome: "unconfirmed", reserved: false, message: "Backend stopped before resync dispatch; no request was replayed." });
    return;
  }
  if (!operation.baseline || !operation.cycleDeadline) {
    unconfirmed(operation.id, "Persisted resync has no process baseline or observation deadline; check host diagnostics before recovery. No request was replayed; resync remains reserved.");
    return;
  }
  if (!operation.outcome) updateMinimaResyncOperation(operation.id, { phase: "recovering", responseSettled: true, message: "Backend resumed resync observation; no request was replayed." });
  startObserver(operation.id);
}

async function dispatchResync(id: string, host: string) {
  const operation = readOperation();
  if (operation?.id !== id || !operation.reserved) return;
  const owner = startObserver(id);
  const active = () => observer === owner;
  try {
    const container = await getComposeServiceContainer("minima");
    if (!container) throw new Error("Minima Docker container not found");
    const info = await inspectContainer(container.Id);
    if (!info.State.Running) throw new Error("Minima node is not running");
    if (!active()) return;
    updateMinimaResyncOperation(id, { phase: "starting", message: "Node process baseline captured.",
      baseline: { containerId: container.Id, restartCount: info.RestartCount, startedAt: info.State.StartedAt } });
  } catch (error) {
    if (!active()) return;
    updateMinimaResyncOperation(id, { phase: "failed", outcome: "failed", reserved: false, message: "Could not inspect the node before dispatch; no resync request was sent.",
      errorDetails: systemError({ type: "minima_resync_preflight_failed", message: "Could not inspect the node before resync.", nativeMessage: error instanceof Error ? error.message : "Unknown Docker error" }) });
    stopMinimaResyncObserver();
    return;
  }
  if (!updateMinimaResyncOperation(id, {
    phase: "starting", message: "Resync request dispatched; waiting for the node response.", dispatchedAt: new Date().toISOString(), cycleDeadline: new Date(Date.now() + rpcResponseTimeoutMs + cycleTimeoutMs).toISOString()
  })) return;
  try {
    const result = await runMinimaPathCommand(`megammrsync action:resync host:${host}`, rpcResponseTimeoutMs);
    if (!active()) return;
    const envelope = result.body && typeof result.body === "object" ? result.body as Record<string, unknown> : null;
    const parsed = parseMegammrResyncMessage(result.body);
    if (!result.ok || envelope?.status === false) {
      const nativeMessage = typeof envelope?.error === "string" ? envelope.error : `Minima RPC returned HTTP ${result.status}`;
      updateMinimaResyncOperation(id, {
        responseSettled: true, phase: "failed", outcome: "failed", reserved: false, message: "The node rejected the resync request.",
        errorDetails: systemError({ type: "minima_resync_rejected", message: "The node rejected the resync request.", nativeMessage })
      });
    } else if (parsed.ok) {
      updateMinimaResyncOperation(id, {
        responseSettled: true, phase: parsed.finished ? "recovering" : "in_progress",
        message: parsed.finished ? "Resync reported completion; waiting for node recovery." : "The node accepted the resync request.",
        cycleDeadline: new Date(Date.now() + cycleTimeoutMs).toISOString(), completionEvidence: parsed.finished
      });
    } else {
      updateMinimaResyncOperation(id, {
        responseSettled: true, phase: "recovering", cycleDeadline: new Date(Date.now() + cycleTimeoutMs).toISOString(), message: "The node response did not confirm the resync outcome.",
        errorDetails: systemError({ type: "minima_resync_unconfirmed_response", message: "The node response did not confirm the resync outcome." })
      });
    }
  } catch (error) {
    if (!active()) return;
    updateMinimaResyncOperation(id, {
      responseSettled: true, cycleDeadline: new Date(Date.now() + cycleTimeoutMs).toISOString(), phase: "recovering", message: "Resync connection interrupted; the node may still be processing the request.",
      errorDetails: systemError({
        type: "minima_resync_transport_uncertain", message: "Resync connection interrupted; the node may still be processing the request.",
        nativeMessage: error instanceof Error ? error.message : "Unknown RPC error"
      })
    });
  }
}

export function startMinimaResync(host: string, trigger: MinimaResyncTrigger = "manual", userId?: string | null): MinimaResyncOperation {
  assertNoMinimaResync();
  if (activeMutations.size > 0 || isMinimaOperationInProgress()) throw new MinimaResyncConflictError();
  const startedAt = new Date().toISOString();
  const operation: StoredOperation = {
    version: 1, id: randomUUID(), trigger, userId, host: boundedMessage(host), reserved: true,
    dispatchedAt: null, completionEvidence: false, phase: "starting", startedAt, updatedAt: startedAt,
    finishedAt: null, outcome: null, recovered: false, message: "Resync requested.", errorDetails: null,
    events: [{ at: startedAt, phase: "starting", message: "Resync requested." }]
  };
  saveOperation(operation);
  recordAuditEvent("minima.resync.started", { userId, detail: JSON.stringify({ id: operation.id, trigger }) });
  const generation = observerGeneration;
  queueMicrotask(() => {
    if (generation !== observerGeneration) return;
    void dispatchResync(operation.id, host).catch((error) => {
      console.error("Minima resync tracking failed:", boundedMessage(error instanceof Error ? error.message : "Unknown error"));
    });
  });
  return toOperation(operation);
}
