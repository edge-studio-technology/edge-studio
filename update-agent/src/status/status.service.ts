import { fetchVerifiedManifest, MANIFEST_SERVICE_KEYS, type Manifest } from "../manifest/manifest.service.js";
import { getLastAppliedManifest, recordAppliedManifest } from "../manifest/manifest-state.js";
import { getComposeServiceContainer, inspectImage } from "../docker/docker.service.js";
import type { DockerContainerSummary } from "../docker/docker.types.js";

export type ServiceStatus = {
  service: string;
  currentImage: string | null;
  targetImage: string;
  upToDate: boolean;
};

export type InstalledBuild = { version: string; revision: string } | null;
export type InstalledBuilds = Record<"frontend" | "backend" | "update-agent", InstalledBuild>;

const MANIFEST_TO_COMPOSE_SERVICE: Record<(typeof MANIFEST_SERVICE_KEYS)[number], string> = {
  frontend: "frontend",
  backend: "backend"
};

const VERSION_LABEL = "org.opencontainers.image.version";
const REVISION_LABEL = "org.opencontainers.image.revision";

async function getInstalledBuild(container: DockerContainerSummary | null): Promise<InstalledBuild> {
  if (!container) return null;
  try {
    const labels = (await inspectImage(container.ImageID)).Config?.Labels ?? {};
    const version = labels[VERSION_LABEL];
    if (!version || version === "unknown") return null;
    return { version, revision: labels[REVISION_LABEL] ?? "unknown" };
  } catch {
    return null;
  }
}

export async function getUpdateStatus(): Promise<{
  manifest: Manifest;
  services: ServiceStatus[];
  currentVersion: string | null;
  installedBuilds: InstalledBuilds;
}> {
  const manifest = await fetchVerifiedManifest();
  const state = await getLastAppliedManifest();

  const [frontendContainer, backendContainer, updateAgentContainer] = await Promise.all([
    getComposeServiceContainer("frontend"),
    getComposeServiceContainer("backend"),
    getComposeServiceContainer("update-agent")
  ]);
  const containers = { frontend: frontendContainer, backend: backendContainer, "update-agent": updateAgentContainer };

  const services: ServiceStatus[] = MANIFEST_SERVICE_KEYS.map((manifestKey) => {
    const composeService = MANIFEST_TO_COMPOSE_SERVICE[manifestKey];
    const container = containers[manifestKey];
    const targetImage = manifest[manifestKey];

    return {
      service: composeService,
      currentImage: container?.Image ?? null,
      targetImage,
      upToDate: container?.Image === targetImage
    };
  });

  // update-agent isn't in MANIFEST_SERVICE_KEYS — that array drives the
  // generic pull/health-check/swap loop, which assumes an external actor.
  // update-agent updates itself via a separate self-update orchestrator, but
  // is still shown here using the same upToDate comparison, so a self-update
  // that never ran (or failed) is visible instead of silently stuck.
  services.push({
    service: "update-agent",
    currentImage: containers["update-agent"]?.Image ?? null,
    targetImage: manifest.updateAgent,
    upToDate: containers["update-agent"]?.Image === manifest.updateAgent
  });

  // The recorded version counts only while the running frontend/backend are the images recorded with it.
  const runningFrontend = containers.frontend?.Image ?? null;
  const runningBackend = containers.backend?.Image ?? null;
  let recordedVersion = state?.version ?? null;
  let currentVersion =
    state?.images && state.images.frontend === runningFrontend && state.images.backend === runningBackend
      ? recordedVersion
      : null;

  // A missing file, or a legacy one without images, is (re)written when frontend/backend
  // already match the manifest it names. See docs/adr/0029-verified-version-identity.md.
  const runningMatchesManifest = runningFrontend === manifest.frontend && runningBackend === manifest.backend;
  if (!state?.images && runningMatchesManifest && (recordedVersion === null || recordedVersion === manifest.version)) {
    await recordAppliedManifest(manifest.createdAt, manifest.version, { frontend: manifest.frontend, backend: manifest.backend });
    recordedVersion = manifest.version;
    currentVersion = manifest.version;
  }

  // host-runtime has no digest to verify, so it compares the recorded version as-is.
  services.push({
    service: "host-runtime",
    currentImage: recordedVersion ? `version:${recordedVersion}` : null,
    targetImage: `version:${manifest.version}`,
    upToDate: recordedVersion === manifest.version
  });

  const [frontendBuild, backendBuild, updateAgentBuild] = await Promise.all([
    getInstalledBuild(containers.frontend),
    getInstalledBuild(containers.backend),
    getInstalledBuild(containers["update-agent"])
  ]);

  return {
    manifest,
    services,
    currentVersion,
    installedBuilds: { frontend: frontendBuild, backend: backendBuild, "update-agent": updateAgentBuild }
  };
}
