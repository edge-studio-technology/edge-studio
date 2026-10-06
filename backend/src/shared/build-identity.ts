import { env } from "../config/env.js";

export type BuildIdentity = { version: string; commit: string };

/** The identity baked into this backend image at build time, or null for an unlabelled build. See docs/adr/0029-verified-version-identity.md. */
export function getBuildIdentity(): BuildIdentity | null {
  if (!env.buildVersion || env.buildVersion === "unknown") return null;
  return { version: env.buildVersion, commit: env.buildCommit || "unknown" };
}
