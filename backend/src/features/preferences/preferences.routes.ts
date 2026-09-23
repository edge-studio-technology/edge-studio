import { Router } from "express";
import {
  getTableColumnPreferences,
  saveTableColumnPreferences,
} from "./table-column-preferences.service.js";

export const preferencesRouter = Router();

preferencesRouter.get("/table-columns", (_req, res) => {
  return res.json({ preferences: getTableColumnPreferences() });
});

preferencesRouter.put("/table-columns", (req, res) => {
  return res.json({ preferences: saveTableColumnPreferences(req.body?.preferences) });
});
