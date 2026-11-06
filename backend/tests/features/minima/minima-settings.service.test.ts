import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let db: import("better-sqlite3").Database;
let teardown: () => void;
let service: typeof import("../../../src/features/minima/minima-settings.service.js");
let env: typeof import("../../../src/config/env.js").env;
const defaults = {
  healthPollIntervalSeconds: 60,
  stallBlockAgeSeconds: 300,
  autoResyncEnabled: false,
  autoResyncCooldownMinutes: 30,
};

beforeAll(async () => {
  ({ db, teardown } = await setupTestDatabase());
  service = await import("../../../src/features/minima/minima-settings.service.js");
  ({ env } = await import("../../../src/config/env.js"));
});
beforeEach(() => {
  db.prepare("DELETE FROM settings WHERE key = 'minima_runtime_settings'").run();
  db.prepare("DELETE FROM audit_events").run();
  Object.assign(env, {
    minimaHealthPollIntervalSeconds: 60,
    minimaStallBlockAgeSeconds: 300,
    minimaAutoResync: false,
    minimaAutoResyncCooldownMinutes: 30,
  });
});
afterAll(() => teardown());

describe("Minima runtime settings", () => {
  it("persists defaults on first use and returns independent settings objects", () => {
    const value = service.getMinimaRuntimeSettings();
    assert.deepEqual(value, defaults);
    value.stallBlockAgeSeconds = 999;
    assert.deepEqual(service.getMinimaRuntimeSettings(), defaults);
    assert.ok(db.prepare("SELECT value FROM settings WHERE key = 'minima_runtime_settings'").get());
  });

  it("seeds legacy values once, then ignores environment changes", () => {
    Object.assign(env, {
      minimaHealthPollIntervalSeconds: 120,
      minimaStallBlockAgeSeconds: 600,
      minimaAutoResync: true,
      minimaAutoResyncCooldownMinutes: 45,
    });
    const migrated = service.getMinimaRuntimeSettings();
    assert.deepEqual(migrated, {
      healthPollIntervalSeconds: 120,
      stallBlockAgeSeconds: 600,
      autoResyncEnabled: true,
      autoResyncCooldownMinutes: 45,
    });
    env.minimaAutoResync = false;
    env.minimaHealthPollIntervalSeconds = 60;
    assert.deepEqual(service.getMinimaRuntimeSettings(), migrated);
  });

  it("uses safe defaults for invalid legacy values without discarding valid fields", () => {
    env.minimaHealthPollIntervalSeconds = Number.NaN;
    env.minimaStallBlockAgeSeconds = -1;
    env.minimaAutoResyncCooldownMinutes = 45;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      assert.deepEqual(service.getMinimaRuntimeSettings(), {
        ...defaults,
        autoResyncCooldownMinutes: 45,
      });
      assert.equal(warn.mock.calls.length, 2);
    } finally {
      warn.mockRestore();
    }
  });

  it("stores accepted settings with an audit event", () => {
    const settings = { ...defaults, autoResyncEnabled: true, healthPollIntervalSeconds: 10 };
    assert.deepEqual(service.saveMinimaRuntimeSettings(settings), settings);
    assert.deepEqual(service.getMinimaRuntimeSettings(), settings);
    const audit = db
      .prepare(
        "SELECT detail FROM audit_events WHERE action = 'minima.monitoring.settings_changed'",
      )
      .get() as { detail: string };
    assert.deepEqual(JSON.parse(audit.detail), { previous: defaults, settings });
  });

  it("rejects invalid types, fractions, missing fields and values outside each range without writes", () => {
    service.getMinimaRuntimeSettings();
    for (const input of [
      null,
      {},
      { ...defaults, autoResyncEnabled: "false" },
      ...Object.entries(service.MINIMA_RUNTIME_LIMITS).flatMap(([key, range]) =>
        [range.min - 1, range.max + 1, 1.5, Number.NaN, String(range.min)].map((value) => ({
          ...defaults,
          [key]: value,
        })),
      ),
    ]) {
      assert.throws(
        () => service.saveMinimaRuntimeSettings(input),
        service.MinimaSettingsValidationError,
      );
      assert.deepEqual(service.getMinimaRuntimeSettings(), defaults);
    }
    assert.equal(
      (db.prepare("SELECT COUNT(*) AS count FROM audit_events").get() as { count: number }).count,
      0,
    );
  });

  it("accepts range boundaries and ignores extra properties", () => {
    for (const bound of ["min", "max"] as const) {
      const value = { ...defaults };
      for (const [key, range] of Object.entries(service.MINIMA_RUNTIME_LIMITS))
        value[key as keyof typeof service.MINIMA_RUNTIME_LIMITS] = range[bound];
      assert.deepEqual(
        service.saveMinimaRuntimeSettings({ ...value, APP_SECRET: "never-store" }),
        value,
      );
      assert.equal(
        JSON.stringify(service.getMinimaRuntimeSettings()).includes("never-store"),
        false,
      );
    }
  });

  it("rolls back settings when the audit write fails", () => {
    service.getMinimaRuntimeSettings();
    db.exec(
      "CREATE TEMP TRIGGER reject_monitoring_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
    );
    try {
      assert.throws(
        () => service.saveMinimaRuntimeSettings({ ...defaults, autoResyncEnabled: true }),
        /audit unavailable/,
      );
      assert.deepEqual(service.getMinimaRuntimeSettings(), defaults);
    } finally {
      db.exec("DROP TRIGGER reject_monitoring_audit");
    }
  });
});
