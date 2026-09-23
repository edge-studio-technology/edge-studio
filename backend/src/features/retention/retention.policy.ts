const EXECUTION_HISTORY_LIMITS = {
  strategy: "age-and-count",
  maxAgeDays: 30,
  maxRows: 10_000,
  batchSize: 500
} as const;

export const RETENTION_POLICIES = {
  automationRuns: EXECUTION_HISTORY_LIMITS,
  automationBlockRuns: EXECUTION_HISTORY_LIMITS,
  automationInboxItems: {
    strategy: "deleted-only",
    batchSize: 500
  },
  dataSourceReads: {
    strategy: "preserve"
  },
  integritasProofs: {
    strategy: "explicit-deletion"
  }
} as const;

export const RETENTION_INTERVAL_MS = 60 * 60 * 1000;
