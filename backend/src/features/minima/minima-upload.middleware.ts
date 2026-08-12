import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import multer from "multer";

const uploadDir = path.join(os.tmpdir(), "edge-studio-minima-uploads");
fs.mkdirSync(uploadDir, { recursive: true });

export const backupUpload = multer({ dest: uploadDir });
