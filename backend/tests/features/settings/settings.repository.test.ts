import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { setupTestDatabase } from "../../helpers/testDatabase.js";

let teardown: () => void;
let repo: typeof import("../../../src/features/settings/settings.repository.js");

beforeAll(async () => {
  const testDb = await setupTestDatabase();
  teardown = testDb.teardown;
  repo = await import("../../../src/features/settings/settings.repository.js");
});

afterAll(() => {
  teardown();
});

describe("getSetting", () => {
  it("returns an empty string when the key does not exist", () => {
    assert.equal(repo.getSetting("missing_key"), "");
  });
});

describe("saveSetting", () => {
  it("inserts a new key/value pair", () => {
    repo.saveSetting("device_id", "abc123");
    assert.equal(repo.getSetting("device_id"), "abc123");
  });

  it("overwrites the value on conflict", () => {
    repo.saveSetting("theme", "dark");
    repo.saveSetting("theme", "light");
    assert.equal(repo.getSetting("theme"), "light");
  });

  it("does not affect other keys", () => {
    repo.saveSetting("key_a", "a");
    repo.saveSetting("key_b", "b");
    assert.equal(repo.getSetting("key_a"), "a");
    assert.equal(repo.getSetting("key_b"), "b");
  });
});

describe("deleteSetting", () => {
  it("removes an existing key", () => {
    repo.saveSetting("to_delete", "value");
    repo.deleteSetting("to_delete");
    assert.equal(repo.getSetting("to_delete"), "");
  });

  it("is a no-op for a key that does not exist", () => {
    assert.doesNotThrow(() => repo.deleteSetting("never_existed"));
  });
});
