export const RETENTION_POLICIES = {
  automationRuns: {
    strategy: "configured-per-workflow", batchSize: 500
  },
  automationBlockRuns: {
    strategy: "with-parent-run"
  },
  automationInboxItems: {
    strategy: "deleted-or-opt-in-expiry",
    batchSize: 500
  },
  dataSourceReads: {
    strategy: "configured-age-proof-protected"
  },
  integritasProofs: {
    strategy: "explicit-deletion"
  }
} as const;

export const RETENTION_INTERVAL_MS = 60 * 60 * 1000;
