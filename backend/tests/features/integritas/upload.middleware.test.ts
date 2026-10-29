import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { describe, it } from "vitest";
import { upload } from "../../../src/features/integritas/upload.middleware.js";

describe("upload storage paths", () => {
  it("uses random server filenames in the fixed upload directory despite client names and fields", async () => {
    const app = express();
    app.post("/", upload.single("file"), async (req, res) => {
      const file = req.file!;
      try {
        assert.equal(path.dirname(file.path), path.join(os.tmpdir(), "edge-studio-uploads"));
        assert.match(file.filename, /^[a-f0-9]{32}$/);
        assert.equal(path.basename(file.path), file.filename);
        assert.equal(await fs.readFile(file.path, "utf8"), "uploaded bytes");
      } finally {
        await fs.rm(file.path, { force: true });
      }
      res.sendStatus(204);
    });
    const response = await request(app).post("/")
      .field("path", "../../outside.json")
      .field("destination", "/outside")
      .attach("file", Buffer.from("uploaded bytes"), "../../outside.json");
    assert.equal(response.status, 204);
  });
});
