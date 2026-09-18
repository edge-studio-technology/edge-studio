import type { RequestHandler } from "express";
import { redactSecrets } from "../shared/redact.js";

export const requestLogger: RequestHandler = (req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${redactSecrets(req.originalUrl)}`);
  next();
};
