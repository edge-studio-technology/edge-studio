export const RETENTION_POLICIES = {
  automationRuns: {
    strategy: "preserve"
  },
  automationBlockRuns: {
    strategy: "preserve"
  },
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
