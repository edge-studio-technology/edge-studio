import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { env } from "../config/env.js";
import { sendApiError } from "../shared/api-error.js";
import { appError } from "../shared/structured-error.js";

/**
 * Multer rejects an over-limit upload by passing a `MulterError` to `next()`. Without this,
 * Express's default handler answers with an HTML 500, so a client cannot tell an oversized file
 * from a server fault. Registered after the routers in `app.ts`.
 */
export function uploadErrorHandler(error: unknown, _req: Request, res: Response, next: NextFunction) {
  if (!(error instanceof MulterError)) return next(error);

  const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  const message = error.code === "LIMIT_FILE_SIZE" ? `Upload exceeded the ${env.uploadMaxFileBytes} byte limit` : `Upload rejected: ${error.message}`;

  return sendApiError(res, status, appError({ type: "upload_rejected", message, context: { code: error.code, field: error.field } }));
}
