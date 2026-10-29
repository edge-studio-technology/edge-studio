import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { describe, it } from "vitest";
import { backupUpload } from "../../../src/features/minima/minima-upload.middleware.js";

describe("backup upload storage paths", () => {
  it("uses random server filenames in the fixed upload directory despite client names and fields", async () => {
    const app = express();
    app.post("/", backupUpload.single("file"), async (req, res) => {
      const file = req.file!;
      try {
        assert.equal(path.dirname(file.path), path.join(os.tmpdir(), "edge-studio-minima-uploads"));
        assert.match(file.filename, /^[a-f0-9]{32}$/);
        assert.equal(path.basename(file.path), file.filename);
        assert.equal(await fs.readFile(file.path, "utf8"), "backup bytes");
      } finally {
        await fs.rm(file.path, { force: true });
      }
      res.sendStatus(204);
    });
    const response = await request(app).post("/")
      .field("path", "../../outside.bak")
      .field("destination", "/outside")
      .attach("file", Buffer.from("backup bytes"), "../../outside.bak");
    assert.equal(response.status, 204);
  });
});
