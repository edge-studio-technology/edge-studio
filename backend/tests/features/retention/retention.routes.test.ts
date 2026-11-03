import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let db: import("better-sqlite3").Database;
let teardown: () => void;
let app: express.Express;
const settings = {
  automaticCleanupEnabled: true,
  runsPerWorkflow: 50,
  deletedWorkflowRunDays: 7,
  dataSourceReadDays: 7,
  diskWarningPercent: 80,
};
beforeAll(async () => {
  ({ db, teardown } = await setupTestDatabase());
  const { retentionRouter } = await import("../../../src/features/retention/retention.routes.js");
  app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const role = req.get("x-test-role");
    if (!role) {
      res.sendStatus(401);
      return;
    }
    req.user = {
      id: "admin",
      displayName: "Admin",
      role: role as "admin",
      lastLogin: null,
      credentialType: "password",
    };
    next();
  });
  app.use("/api/retention", retentionRouter);
});
beforeEach(() =>
  db.exec("DELETE FROM settings; DELETE FROM audit_events; DELETE FROM data_source_reads;"),
);
afterAll(() => teardown());

it("requires authentication and admin access for reads, preview and saves", async () => {
  for (const [method, path] of [
    ["get", "/settings"],
    ["post", "/settings/preview"],
    ["post", "/settings"],
  ] as const) {
    assert.equal((await request(app)[method]("/api/retention" + path)).status, 401);
    assert.equal(
      (
        await request(app)
          [method]("/api/retention" + path)
          .set("x-test-role", "viewer")
      ).status,
      403,
    );
  }
});

it("returns defaults and previews without writes, then saves only a confirmed proposal", async () => {
  const initial = await request(app).get("/api/retention/settings").set("x-test-role", "admin");
  assert.equal(initial.status, 200);
  assert.equal(initial.body.settings.automaticCleanupEnabled, false);
  assert.equal(initial.body.limits.dataSourceReadDays.min, 7);
  const preview = await request(app)
    .post("/api/retention/settings/preview")
    .set("x-test-role", "admin")
    .send(settings);
  assert.equal(preview.status, 200);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM settings").get() as { n: number }).n, 0);
  const missing = await request(app)
    .post("/api/retention/settings")
    .set("x-test-role", "admin")
    .send({ settings, previewToken: preview.body.previewToken });
  assert.equal(missing.status, 400);
  const saved = await request(app)
    .post("/api/retention/settings")
    .set("x-test-role", "admin")
    .send({ settings, previewToken: preview.body.previewToken, confirmed: true });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.settings, settings);
  const reloaded = await request(app).get("/api/retention/settings").set("x-test-role", "admin");
  assert.deepEqual(reloaded.body.settings, settings);
});

it("returns field errors and a conflict for an altered or stale preview", async () => {
  const invalid = await request(app)
    .post("/api/retention/settings/preview")
    .set("x-test-role", "admin")
    .send({ ...settings, dataSourceReadDays: 1 });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.errorDetails.context.fieldErrors.dataSourceReadDays);
  const stale = await request(app)
    .post("/api/retention/settings")
    .set("x-test-role", "admin")
    .send({ settings, previewToken: "not-a-reviewed-preview", confirmed: true });
  assert.equal(stale.status, 409);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM settings").get() as { n: number }).n, 0);
});
