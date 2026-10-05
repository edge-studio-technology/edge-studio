import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";
import {
  assertAppSecretConfigured,
  MISSING_APP_SECRET_ERROR,
  startWithAppSecret,
} from "../../src/config/app-secret.js";

describe("APP_SECRET startup validation", () => {
  it("rejects an absent value", () => {
    assert.throws(() => assertAppSecretConfigured(undefined), {
      message: MISSING_APP_SECRET_ERROR,
    });
  });

  it("rejects an empty value", () => {
    assert.throws(() => assertAppSecretConfigured(""), {
      message: MISSING_APP_SECRET_ERROR,
    });
  });

  it("accepts an explicitly configured dev-change-me value", () => {
    const startBackend = vi.fn(() => "started");

    assert.equal(startWithAppSecret("dev-change-me", startBackend), "started");
    assert.equal(startBackend.mock.calls.length, 1);
  });

  it("accepts a strong value", () => {
    const startBackend = vi.fn(() => "started");

    assert.equal(startWithAppSecret("d6b516780a87d0795a76d59e606e4f6a", startBackend), "started");
    assert.equal(startBackend.mock.calls.length, 1);
  });

  it.each([
    ["absent", undefined],
    ["empty", ""],
  ])("does not start database or background work when APP_SECRET is %s", (_label, appSecret) => {
    const startBackend = vi.fn();

    assert.throws(() => startWithAppSecret(appSecret, startBackend), {
      message: MISSING_APP_SECRET_ERROR,
    });
    assert.equal(startBackend.mock.calls.length, 0);
  });
});
