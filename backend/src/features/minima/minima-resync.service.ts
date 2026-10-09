import { randomUUID } from "node:crypto";
import { redactDeep, redactSecrets } from "../../shared/redact.js";
import { systemError, type StructuredError } from "../../shared/structured-error.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";
import { isMinimaOperationInProgress } from "./minima-monitoring.js";
import { MinimaResyncConflictError } from "./minima.errors.js";
import { parseMegammrResyncMessage } from "./minima.parse.js";
import { runMinimaPathCommand } from "./minima.rpc.js";
import type { MinimaResyncOperation, MinimaResyncPhase, MinimaResyncTrigger } from "./minima.types.js";

const operationSetting = "minima_resync_operation";
const maxEvents = 100;
const maxMessageLength = 2000;
// See docs/adr/0033-observe-resync-after-client-timeout.md.
const rpcResponseTimeoutMs = 5 * 60 * 1000;

type StoredOperation = Omit<MinimaResyncOperation, "busy"> & {
  version: 1;
  trigger: MinimaResyncTrigger;
  host: string;
  reserved: boolean;
  dispatchedAt: string | null;
  completionEvidence: boolean;
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
    || (update.completionEvidence !== undefined && operation.completionEvidence !== update.completionEvidence);
  if (!changed) return true;
  const updatedAt = new Date().toISOString();
  const terminal = update.phase === "completed" || update.phase === "failed" || update.phase === "unconfirmed";
  saveOperation({
    ...operation,
    ...update,
    message,
    errorDetails,
    updatedAt,
    finishedAt: terminal ? operation.finishedAt ?? updatedAt : null,
    events: [...operation.events, { at: updatedAt, phase: update.phase, message, ...(update.errorDetails && errorDetails ? { errorDetails } : {}) }].slice(-maxEvents)
  });
  return true;
}

async function dispatchResync(id: string, host: string) {
  if (!updateMinimaResyncOperation(id, {
    phase: "starting", message: "Resync request dispatched; waiting for the node response.", dispatchedAt: new Date().toISOString()
  })) return;
  try {
    const result = await runMinimaPathCommand(`megammrsync action:resync host:${host}`, rpcResponseTimeoutMs);
    const envelope = result.body && typeof result.body === "object" ? result.body as Record<string, unknown> : null;
    const parsed = parseMegammrResyncMessage(result.body);
    if (!result.ok || envelope?.status === false) {
      const nativeMessage = typeof envelope?.error === "string" ? envelope.error : `Minima RPC returned HTTP ${result.status}`;
      updateMinimaResyncOperation(id, {
        phase: "failed", outcome: "failed", reserved: false, message: "The node rejected the resync request.",
        errorDetails: systemError({ type: "minima_resync_rejected", message: "The node rejected the resync request.", nativeMessage })
      });
    } else if (parsed.ok) {
      updateMinimaResyncOperation(id, {
        phase: parsed.finished ? "recovering" : "in_progress",
        message: parsed.finished ? "Resync reported completion; waiting for node recovery." : "The node accepted the resync request.",
        completionEvidence: parsed.finished
      });
    } else {
      updateMinimaResyncOperation(id, {
        phase: "recovering", message: "The node response did not confirm the resync outcome.",
        errorDetails: systemError({ type: "minima_resync_unconfirmed_response", message: "The node response did not confirm the resync outcome." })
      });
    }
  } catch (error) {
    updateMinimaResyncOperation(id, {
      phase: "recovering", message: "Resync connection interrupted; the node may still be processing the request.",
      errorDetails: systemError({
        type: "minima_resync_transport_uncertain", message: "Resync connection interrupted; the node may still be processing the request.",
        nativeMessage: error instanceof Error ? error.message : "Unknown RPC error"
      })
    });
  }
}

export function startMinimaResync(host: string, trigger: MinimaResyncTrigger = "manual"): MinimaResyncOperation {
  assertNoMinimaResync();
  if (activeMutations.size > 0 || isMinimaOperationInProgress()) throw new MinimaResyncConflictError();
  const startedAt = new Date().toISOString();
  const operation: StoredOperation = {
    version: 1, id: randomUUID(), trigger, host: boundedMessage(host), reserved: true,
    dispatchedAt: null, completionEvidence: false, phase: "starting", startedAt, updatedAt: startedAt,
    finishedAt: null, outcome: null, recovered: false, message: "Resync requested.", errorDetails: null,
    events: [{ at: startedAt, phase: "starting", message: "Resync requested." }]
  };
  saveOperation(operation);
  queueMicrotask(() => {
    void dispatchResync(operation.id, host).catch((error) => {
      console.error("Minima resync tracking failed:", boundedMessage(error instanceof Error ? error.message : "Unknown error"));
    });
  });
  return toOperation(operation);
}
