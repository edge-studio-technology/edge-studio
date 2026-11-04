import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let db: import("better-sqlite3").Database;
let teardown: () => void;
let service: typeof import("../../../src/features/retention/camera-retention.service.js");
let env: typeof import("../../../src/config/env.js")["env"];
const active = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock("../../../src/features/automation/automationRuns.repository.js", () => ({ getActiveAutomationRunIds: () => active.ids }));
const root = fs.mkdtempSync(path.join(os.tmpdir(), "edge-camera-retention-"));
const now = Date.now();
const policy = { retentionDays: 7, paused: false };

beforeAll(async () => {
  ({ db, teardown } = await setupTestDatabase());
  ({ env } = await import("../../../src/config/env.js"));
  service = await import("../../../src/features/retention/camera-retention.service.js");
});
beforeEach(() => {
  db.exec("DELETE FROM settings; DELETE FROM audit_events; DELETE FROM data_source_reads; DELETE FROM integritas_proofs;");
  for (const name of fs.readdirSync(root)) fs.rmSync(path.join(root, name), { recursive: true, force: true });
  env.cameraEnabled = true;
  env.cameraCaptureDir = root;
  env.cameraRetentionDays = 7;
  active.ids = [];
});
afterAll(() => { teardown(); fs.rmSync(root, { recursive: true, force: true }); });

function capture(name: string, days = 10) {
  const file = path.join(root, name);
  fs.writeFileSync(file, "photo");
  const date = new Date(now - days * 86400000);
  fs.utimesSync(file, date, date);
  return file;
}
function save(settings: { retentionDays: number | null; paused: boolean } = policy) {
  const proposal = service.previewCameraRetention(settings);
  return service.saveCameraRetention(settings, proposal.previewToken, true);
}

it("migrates legacy retention once, paused until reviewed, and ignores later env edits", () => {
  assert.deepEqual(service.getCameraRetentionSettings(), { retentionDays: 7, paused: true });
  env.cameraRetentionDays = 30;
  assert.equal(service.getCameraRetentionSettings().retentionDays, 7);
  capture("old.jpg");
  assert.equal(service.pruneCameraCaptures(), 0);
});

it("maps disabled and invalid legacy values to keep until deleted", () => {
  for (const value of [0, -1, NaN, 7.5, 3651]) {
    db.exec("DELETE FROM settings");
    env.cameraRetentionDays = value;
    assert.deepEqual(service.getCameraRetentionSettings(), { retentionDays: null, paused: true });
  }
});

it("validates policy and requires explicit confirmation without deleting on save", () => {
  const file = capture("old.jpg");
  for (const retentionDays of [undefined, "7", 0, -1, 1.5, 3651]) {
    assert.throws(() => service.previewCameraRetention({ ...policy, retentionDays }));
  }
  assert.throws(() => service.previewCameraRetention({ retentionDays: 7 }));
  const preview = service.previewCameraRetention(policy);
  assert.deepEqual(preview.scheduled, { fileCount: 1, bytes: 5 });
  assert.throws(() => service.saveCameraRetention(policy, preview.previewToken, false));
  save();
  assert.ok(fs.existsSync(file));
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='camera.retention_changed'").get() as { n: number }).n, 1);
});

it("rejects a changed candidate set even when counts and sizes stay the same", () => {
  capture("one.jpg");
  const preview = service.previewCameraRetention(policy);
  fs.renameSync(path.join(root, "one.jpg"), path.join(root, "two.jpg"));
  assert.throws(() => service.saveCameraRetention(policy, preview.previewToken, true));
});

it("pauses disabled cameras without removing files or their saved policy; re-enable needs confirmation", () => {
  const file = capture("old.jpg");
  save();
  env.cameraEnabled = false;
  assert.equal(service.previewCameraRetention(policy).scheduled.fileCount, 0);
  assert.throws(() => save());
  assert.equal(service.pruneCameraCaptures(), 0);
  assert.deepEqual(service.getCameraRetentionSettings(), { ...policy, paused: true });
  env.cameraEnabled = true;
  assert.equal(service.pruneCameraCaptures(), 0);
  assert.ok(fs.existsSync(file));
  save();
  assert.equal(service.pruneCameraCaptures(), 1);
});

it("preserves proof files, recent files, cutoff boundary, unknown files and directories", () => {
  const protectedFile = capture("proof.jpg");
  const recent = capture("recent.jpg", 1);
  const boundary = capture("boundary.jpg", 7);
  const unknown = capture("unknown.txt");
  const old = capture("expired.h264");
  fs.mkdirSync(path.join(root, "directory.jpg"));
  db.prepare("INSERT INTO integritas_proofs(id,hash,proof_status,created_at,updated_at) VALUES ('proof','hash','complete','now','now')").run();
  db.prepare("INSERT INTO data_source_reads(id,created_at,integritas_proof_id,source_name,source_url,trigger_type,status,preview_json) VALUES ('read','now','proof','Camera','pi-camera','manual','success',?)")
    .run(JSON.stringify({ source: "pi-camera-helper", path: protectedFile }));
  save();
  assert.equal(service.pruneCameraCaptures(500, now), 1);
  assert.equal(fs.existsSync(old), false);
  for (const file of [protectedFile, recent, boundary, unknown]) assert.ok(fs.existsSync(file));
});

it("waits for active workflows, protects unreadable proof metadata, and bounds batches", () => {
  capture("one.jpg"); capture("two.jpg");
  save();
  active.ids = ["run"];
  assert.equal(service.previewCameraRetention(policy).scheduled.fileCount, 0);
  assert.equal(service.pruneCameraCaptures(), 0);
  active.ids = [];
  assert.equal(service.pruneCameraCaptures(1), 1);
  assert.equal(service.pruneCameraCaptures(1), 1);
  capture("three.jpg");
  db.prepare("INSERT INTO integritas_proofs(id,hash,proof_status,created_at,updated_at) VALUES ('proof','hash','complete','now','now')").run();
  db.prepare("INSERT INTO data_source_reads(id,created_at,integritas_proof_id,source_name,source_url,trigger_type,status,preview_json) VALUES ('read','now','proof','Camera','pi-camera','manual','success','invalid-json')").run();
  assert.equal(service.previewCameraRetention(policy).camera.available, false);
  assert.equal(service.pruneCameraCaptures(), 0);
});

it("retains all captures when keep-until-deleted is selected and rolls back policy on audit failure", () => {
  capture("old.jpg");
  save({ retentionDays: null, paused: false });
  assert.equal(service.pruneCameraCaptures(), 0);
  const before = service.getCameraRetentionSettings();
  db.exec("CREATE TEMP TRIGGER fail_camera_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT, 'audit failure'); END;");
  try { assert.throws(() => save()); }
  finally { db.exec("DROP TRIGGER fail_camera_audit"); }
  assert.deepEqual(service.getCameraRetentionSettings(), before);
});

it("rejects symlinked capture roots and leaves their files untouched", () => {
  const file = capture("old.jpg");
  const link = path.join(root, "linked-root");
  fs.symlinkSync(root, link, "junction");
  env.cameraCaptureDir = link;
  try {
    assert.equal(service.previewCameraRetention(policy).camera.available, false);
    save();
    assert.equal(service.pruneCameraCaptures(), 0);
    assert.ok(fs.existsSync(file));
  } finally {
    fs.unlinkSync(link);
    env.cameraCaptureDir = root;
  }
});

it("runs confirmed camera cleanup through the existing startup scheduler", async () => {
  const file = capture("old.jpg");
  save();
  const scheduler = await import("../../../src/features/retention/retention.service.js");
  try {
    scheduler.startRetentionScheduler();
    assert.equal(fs.existsSync(file), false);
  } finally { scheduler.stopRetentionScheduler(); }
});
