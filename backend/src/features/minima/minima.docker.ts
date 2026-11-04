import { getComposeServiceContainer, getDockerResourceSnapshot } from "../status/docker.service.js";

const minimaDataPath = "/home/minima/data";

export async function getMinimaContainerStats() {
  const container = await getComposeServiceContainer("minima");
  if (!container) return null;
  const snapshot = getDockerResourceSnapshot();
  const minima = snapshot.items.find((item) => item.containerId === container.Id.slice(0, 12));
  const running = container.State === "running";

  return {
    state: container.State,
    status: container.Status,
    cpuPercent: running ? minima?.cpuPercent ?? null : null,
    memory: running && minima?.memory
      ? { usage: minima.memory.usage ?? null, limit: minima.memory.limit ?? null }
      : null,
    containerDisk: minima?.disk.rootFs ?? null,
    metricsPending: snapshot.pending,
    metricsObservedAt: snapshot.observedAt,
  };
}

export function getMinimaStorageInfo(
  containerDisk: string | null | undefined,
  input?: { dataPath?: string | null; chainDataDisk?: string | null }
) {
  return {
    dataPath: input?.dataPath?.trim() || minimaDataPath,
    containerDisk: containerDisk ?? null,
    chainDataDisk: input?.chainDataDisk ?? null
  };
}
