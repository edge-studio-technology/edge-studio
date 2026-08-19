import { Router } from "express";
import { dependencyUnavailable } from "../../shared/api-error.js";
import { requireRole } from "../auth/auth.middleware.js";
import { disableHostCameraCapability, enableHostCameraCapability, getHostCameraCapability, listHostCapabilities } from "./hostCapabilities.service.js";

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
