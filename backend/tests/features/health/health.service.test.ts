import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { getHealthStatus } from "../../../src/features/health/health.service.js";

describe("getHealthStatus", () => {
  it("returns the public health check contract", () => {
    assert.deepEqual(getHealthStatus(), { status: "ok", service: "edge-studio-backend" });
  });
});
