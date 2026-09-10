import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import multer from "multer";
import { env } from "../../config/env.js";

const uploadDir = path.join(os.tmpdir(), "edge-studio-minima-uploads");
fs.mkdirSync(uploadDir, { recursive: true });

export const backupUpload = multer({
  dest: uploadDir,
  limits: { fileSize: env.uploadMaxFileBytes, files: env.uploadMaxFiles, fields: env.uploadMaxFields }
});
