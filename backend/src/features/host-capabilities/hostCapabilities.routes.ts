import { Router } from "express";
import { dependencyUnavailable } from "../../shared/api-error.js";
import { requireRole } from "../auth/auth.middleware.js";
import { disableHostCameraCapability, disableHostGpioCapability, disableHostMqttCapability, disableHostSensorCapability, enableHostCameraCapability, enableHostGpioCapability, enableHostMqttCapability, enableHostSensorCapability, getHostCameraCapability, getHostGpioCapability, getHostMqttCapability, getHostSensorCapability, listHostCapabilities } from "./hostCapabilities.service.js";

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
    return res.json(await enableHostCameraCapability());
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to enable camera support");
  }
});

hostCapabilitiesRouter.post("/camera/disable", requireRole("admin"), async (_req, res) => {
  try {
    return res.json(await disableHostCameraCapability());
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to disable camera support");
  }
});

hostCapabilitiesRouter.post("/gpio/enable", requireRole("admin"), async (_req, res) => {
  try {
    return res.json(await enableHostGpioCapability());
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to enable GPIO support");
  }
});

hostCapabilitiesRouter.post("/gpio/disable", requireRole("admin"), async (_req, res) => {
  try {
    return res.json(await disableHostGpioCapability());
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to disable GPIO support");
  }
});

hostCapabilitiesRouter.post("/mqtt/enable", requireRole("admin"), async (_req, res) => {
  try {
    return res.json(await enableHostMqttCapability());
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to enable local MQTT broker");
  }
});

hostCapabilitiesRouter.post("/mqtt/disable", requireRole("admin"), async (_req, res) => {
  try {
    return res.json(await disableHostMqttCapability());
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to disable local MQTT broker");
  }
});

hostCapabilitiesRouter.post("/sensors/enable", requireRole("admin"), async (_req, res) => {
  try {
    return res.json(await enableHostSensorCapability());
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to enable I2C sensor support");
  }
});

hostCapabilitiesRouter.post("/sensors/disable", requireRole("admin"), async (_req, res) => {
  try {
    return res.json(await disableHostSensorCapability());
  } catch (error) {
    return dependencyUnavailable(res, error instanceof Error ? error.message : "Failed to disable I2C sensor support");
  }
});
