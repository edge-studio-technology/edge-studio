import http from "node:http";
import { env } from "../../config/env.js";
import { getComposeServiceContainer, inspectContainer } from "./docker.service.js";

// additionalOkStatuses covers e.g. 304 Not Modified from POST .../start on a container
// that's already running (a legitimate outcome, not a failure).
function dockerPost(pathName: string, timeoutMs = 15000, additionalOkStatuses: number[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = http.request({ socketPath: env.dockerSocketPath, path: pathName, method: "POST" }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        const status = response.statusCode ?? 0;
        const ok = (status >= 200 && status < 300) || additionalOkStatuses.includes(status);
        if (!ok) {
          reject(new Error(`Docker API returned HTTP ${status}: ${body}`));
          return;
        }
        resolve();
      });
    });

    request.on("error", reject);
    request.setTimeout(timeoutMs, () => request.destroy(new Error("Docker API request timed out")));
    request.end();
  });
}

async function runComposeServiceAction<State extends string>(
  serviceName: string,
  path: (containerId: string) => string,
  state: State,
  additionalOkStatuses: number[] = []
) {
  const container = await getComposeServiceContainer(serviceName);
  if (!container) {
    throw new Error(`Docker container not found for service "${serviceName}"`);
  }

  await dockerPost(path(container.Id), 15000, additionalOkStatuses);
  return {
    ok: true as const,
    state,
    service: serviceName,
    containerId: container.Id.slice(0, 12)
  };
}

export async function restartComposeService(serviceName: string) {
  return runComposeServiceAction(serviceName, (id) => `/containers/${id}/restart?t=10`, "restarting" as const);
}

export async function startComposeService(serviceName: string) {
  return runComposeServiceAction(serviceName, (id) => `/containers/${id}/start`, "running" as const, [304]);
}

export type ContainerRestartBaseline = { restartCount: number; startedAt: string };

export async function getContainerRestartBaseline(containerId: string): Promise<ContainerRestartBaseline> {
  const info = await inspectContainer(containerId);
  return { restartCount: info.RestartCount, startedAt: info.State.StartedAt };
}

// Polls until RestartCount/StartedAt differ from a pre-action baseline, or timeoutMs elapses.
// Deliberately not a transient "not running" check — see docs/adr/0001-minima-graceful-node-restart.md.
export async function waitForContainerRestart(
  containerId: string,
  baseline: ContainerRestartBaseline,
  timeoutMs: number,
  pollMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const info = await inspectContainer(containerId).catch(() => null);
    if (info && (info.RestartCount !== baseline.restartCount || info.State.StartedAt !== baseline.startedAt)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return false;
}
