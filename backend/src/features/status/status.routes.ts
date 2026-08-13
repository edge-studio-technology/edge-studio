import { Router } from "express";
import { env } from "../../config/env.js";
import { getIntegritasApiKey } from "../settings/secrets.service.js";
import { fetchJsonWithTimeout } from "../../shared/http.js";
import { getMinimaNodeStatus } from "../minima/minima.service.js";
import { dockerServiceResources, diskUsage } from "./docker.service.js";
import { getDeviceInfo } from "./device.service.js";
import { isSetupComplete } from "../auth/setup.service.js";

type ServiceStatus = {
  name: string;
  ok: boolean;
  status: string;
  details?: unknown;
  error?: string;
};

export const statusRouter = Router();

type IntegritasConnectionCheck = {
  connected: boolean;
  status: string;
  details?: unknown;
  error?: string;
  checkedAt: number;
};

let integritasConnectionCache: IntegritasConnectionCheck | null = null;
/** Shared by `/api/status` and `/api/status/overview` so UI polls do not hammer Integritas health. */
const INTEGRITAS_CACHE_TTL_MS = 3_600_000;
const INTEGRITAS_CHECK_TIMEOUT_MS = 3_000;

async function getIntegritasConnectionCheck(apiKey: string): Promise<IntegritasConnectionCheck> {
  if (integritasConnectionCache && Date.now() - integritasConnectionCache.checkedAt < INTEGRITAS_CACHE_TTL_MS) {
    return integritasConnectionCache;
  }
  try {
    const { response, body } = await fetchJsonWithTimeout(
      `${env.integritasBaseUrl}/v1/web/check/health`,
      { headers: { "x-request-id": env.integritasRequestId, "x-api-key": apiKey } },
      INTEGRITAS_CHECK_TIMEOUT_MS
    );
    integritasConnectionCache = {
      connected: response.ok,
      status: response.ok ? "ok" : `HTTP ${response.status}`,
      details: body,
      checkedAt: Date.now()
    };
    return integritasConnectionCache;
  } catch (error) {
    integritasConnectionCache = {
      connected: false,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      checkedAt: Date.now()
    };
    return integritasConnectionCache;
  }
}

statusRouter.get("/", async (_req, res) => {
  const device = getDeviceInfo();
  const minimaStatus = await getMinimaNodeStatus().catch(() => null);
  const node = {
    state: minimaStatus?.state ?? ("unknown" as const),
    lastCheckedAt: minimaStatus?.checkedAt ?? null
  };
  const integritasApiKey = getIntegritasApiKey();

  let integritasConnected: boolean | null = null;
  if (integritasApiKey) {
    integritasConnected = (await getIntegritasConnectionCheck(integritasApiKey)).connected;
  }

  res.json({
    checkedAt: new Date().toISOString(),
    device,
    app: {
      running: true as const,
      setupComplete: isSetupComplete(),
      integritasConfigured: Boolean(integritasApiKey),
      integritasConnected
    },
    node
  });
});

statusRouter.get("/overview", async (_req, res) => {
  const services: ServiceStatus[] = [
    {
      name: "backend",
      ok: true,
      status: "ok",
      details: {
        service: "edge-studio-backend",
        databasePath: env.databasePath,
        integritasApiKeyConfigured: Boolean(getIntegritasApiKey())
      }
    }
  ];

  try {
    const nodeStatus = await getMinimaNodeStatus();
    services.push({
      name: "minima",
      ok: nodeStatus.state === "running",
      status: nodeStatus.state === "running" ? "ok" : nodeStatus.state,
      details: { sync: nodeStatus.sync, health: nodeStatus.health, container: nodeStatus.container }
    });
  } catch (error) {
    services.push({ name: "minima", ok: false, status: "error", error: error instanceof Error ? error.message : "Unknown error" });
  }

  const integritasApiKey = getIntegritasApiKey();
  if (!integritasApiKey) {
    services.push({ name: "integritas", ok: false, status: "missing_api_key", error: "Integritas API key is not configured" });
  } else {
    const check = await getIntegritasConnectionCheck(integritasApiKey);
    services.push({
      name: "integritas",
      ok: check.connected,
      status: check.status,
      details: check.details,
      error: check.error
    });
  }

  let resources: unknown = null;
  try {
    resources = { containers: await dockerServiceResources(), disks: [await diskUsage("/data"), await diskUsage(env.hostFilesRoot)] };
  } catch (error) {
    resources = { error: error instanceof Error ? error.message : "Could not read Docker resource usage" };
  }

  res.json({ generatedAt: new Date().toISOString(), services, resources });
});
