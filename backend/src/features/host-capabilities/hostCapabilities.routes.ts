import { Router } from "express";
import { dependencyUnavailable } from "../../shared/api-error.js";
import { recordAuditEvent } from "../auth/audit.service.js";
import { requireRole } from "../auth/auth.middleware.js";
import { disableHostCameraCapability, disableHostGpioCapability, disableHostMqttCapability, disableHostSensorCapability, enableHostCameraCapability, enableHostGpioCapability, enableHostMqttCapability, enableHostSensorCapability, getHostCameraCapability, getHostGpioCapability, getHostMqttCapability, getHostSensorCapability, listHostCapabilities, type HostCapability } from "./hostCapabilities.service.js";

export const hostCapabilitiesRouter = Router();

hostCapabilitiesRouter.get("/", async (_req, res) => {
  try {
    return res.json(await listHostCapabilities());
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to read host capabilities");
  }
});

hostCapabilitiesRouter.get("/camera", async (_req, res) => {
  try {
    return res.json(await getHostCameraCapability());
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to read camera capability");
  }
});

hostCapabilitiesRouter.get("/gpio", async (_req, res) => {
  try {
    return res.json(await getHostGpioCapability());
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to read GPIO capability");
  }
});

hostCapabilitiesRouter.get("/sensors", async (_req, res) => {
  try {
    return res.json(await getHostSensorCapability());
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to read sensor capability");
  }
});

hostCapabilitiesRouter.get("/mqtt", async (_req, res) => {
  try {
    return res.json(await getHostMqttCapability());
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to read MQTT capability");
  }
});

hostCapabilitiesRouter.post("/camera/enable", requireRole("admin"), async (_req, res) => {
  try {
    const result = await enableHostCameraCapability();
    recordHostCapabilityAudit(_req.user?.id, "enable", result.capability);
    return res.json(result);
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to enable camera support");
  }
});

hostCapabilitiesRouter.post("/camera/disable", requireRole("admin"), async (_req, res) => {
  try {
    const result = await disableHostCameraCapability();
    recordHostCapabilityAudit(_req.user?.id, "disable", result.capability);
    return res.json(result);
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to disable camera support");
  }
});

hostCapabilitiesRouter.post("/gpio/enable", requireRole("admin"), async (_req, res) => {
  try {
    const result = await enableHostGpioCapability();
    recordHostCapabilityAudit(_req.user?.id, "enable", result.capability);
    return res.json(result);
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to enable GPIO support");
  }
});

hostCapabilitiesRouter.post("/gpio/disable", requireRole("admin"), async (_req, res) => {
  try {
    const result = await disableHostGpioCapability();
    recordHostCapabilityAudit(_req.user?.id, "disable", result.capability);
    return res.json(result);
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to disable GPIO support");
  }
});

hostCapabilitiesRouter.post("/mqtt/enable", requireRole("admin"), async (_req, res) => {
  try {
    const result = await enableHostMqttCapability();
    recordHostCapabilityAudit(_req.user?.id, "enable", result.capability);
    return res.json(result);
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to enable local MQTT broker");
  }
});

hostCapabilitiesRouter.post("/mqtt/disable", requireRole("admin"), async (_req, res) => {
  try {
    const result = await disableHostMqttCapability();
    recordHostCapabilityAudit(_req.user?.id, "disable", result.capability);
    return res.json(result);
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to disable local MQTT broker");
  }
});

hostCapabilitiesRouter.post("/sensors/enable", requireRole("admin"), async (_req, res) => {
  try {
    const result = await enableHostSensorCapability();
    recordHostCapabilityAudit(_req.user?.id, "enable", result.capability);
    return res.json(result);
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to enable I2C sensor support");
  }
});

hostCapabilitiesRouter.post("/sensors/disable", requireRole("admin"), async (_req, res) => {
  try {
    const result = await disableHostSensorCapability();
    recordHostCapabilityAudit(_req.user?.id, "disable", result.capability);
    return res.json(result);
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to disable I2C sensor support");
  }
});

function recordHostCapabilityAudit(userId: string | undefined, action: "enable" | "disable", capability: HostCapability) {
  recordAuditEvent(`host-capability.${action}`, {
    userId,
    detail: `capability=${capability.name} state=${capability.state} enabled=${String(capability.enabled)} available=${String(capability.available)}`,
  });
}
