import { fetchVerifiedManifest, MANIFEST_SERVICE_KEYS, type Manifest } from "../manifest/manifest.service.js";
import { getLastAppliedVersion, recordAppliedManifest } from "../manifest/manifest-state.js";
import { getComposeServiceContainer } from "../docker/docker.service.js";

export type ServiceStatus = {
  service: string;
  currentImage: string | null;
  targetImage: string;
  upToDate: boolean;
};

const MANIFEST_TO_COMPOSE_SERVICE: Record<(typeof MANIFEST_SERVICE_KEYS)[number], string> = {
  frontend: "frontend",
  backend: "backend"
};

export async function getUpdateStatus(): Promise<{
  manifest: Manifest;
  services: ServiceStatus[];
  currentVersion: string | null;
}> {
  const manifest = await fetchVerifiedManifest();

  const services = await Promise.all(
    MANIFEST_SERVICE_KEYS.map(async (manifestKey) => {
      const composeService = MANIFEST_TO_COMPOSE_SERVICE[manifestKey];
      const container = await getComposeServiceContainer(composeService);
      const targetImage = manifest[manifestKey];

      return {
        service: composeService,
        currentImage: container?.Image ?? null,
        targetImage,
        upToDate: container?.Image === targetImage
      };
    })
  );

  // update-agent isn't in MANIFEST_SERVICE_KEYS — that array drives the
  // generic pull/health-check/swap loop, which assumes an external actor.
  // update-agent updates itself via a separate self-update orchestrator, but
  // is still shown here using the same upToDate comparison, so a self-update
  // that never ran (or failed) is visible instead of silently stuck.
  const updateAgentContainer = await getComposeServiceContainer("update-agent");
  services.push({
    service: "update-agent",
    currentImage: updateAgentContainer?.Image ?? null,
    targetImage: manifest.updateAgent,
    upToDate: updateAgentContainer?.Image === manifest.updateAgent
  });

  let currentVersion = await getLastAppliedVersion();

  // Devices installed before install.sh started recording last-applied-manifest.json
  // (or that had their update-agent state dir reset) never get it written, even
  // though frontend/backend already match the manifest — nothing ever calls
  // applyUpdates() for them since there's nothing to update. Self-heal here so
  // Settings doesn't show "Unknown" forever on an otherwise up-to-date device.
  if (currentVersion === null && services.filter((service) => service.service !== "update-agent").every((service) => service.upToDate)) {
    await recordAppliedManifest(manifest.createdAt, manifest.version);
    currentVersion = manifest.version;
  }

  return { manifest, services, currentVersion };
}
