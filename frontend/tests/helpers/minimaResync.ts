import type { MinimaResyncOperation } from "../../src/app/types";

export function resyncOperation(
  overrides: Partial<MinimaResyncOperation> = {},
): MinimaResyncOperation {
  return {
    id: "resync-536",
    phase: "starting",
    startedAt: "2026-10-09T10:00:00.000Z",
    updatedAt: "2026-10-09T10:00:03.000Z",
    finishedAt: null,
    outcome: null,
    recovered: false,
    busy: true,
    message: "Resync requested.",
    events: [{ at: "2026-10-09T10:00:00.000Z", phase: "starting", message: "Resync requested." }],
    errorDetails: null,
    ...overrides,
  };
}
