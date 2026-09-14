import { Router } from "express";
import { getHealthStatus } from "./health.service.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json(getHealthStatus());
});
