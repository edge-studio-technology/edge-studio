import { Router } from "express";
import { getStorageHistoryInventory } from "./storage-history.service.js";

export const storageHistoryRouter = Router();

storageHistoryRouter.get("/inventory", (_req, res) => {
  return res.json(getStorageHistoryInventory());
});
