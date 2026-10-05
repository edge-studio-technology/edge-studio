import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({ buildVersion: "unknown", buildCommit: "unknown" }));
vi.mock("../../src/config/env.js", () => ({ env: mockEnv }));

import { getBuildIdentity } from "../../src/shared/build-identity.js";

describe("getBuildIdentity", () => {
  beforeEach(() => {
    mockEnv.buildVersion = "unknown";
    mockEnv.buildCommit = "unknown";
  });

  it("returns the baked version and commit", () => {
    mockEnv.buildVersion = "v1.2.3-dev+abc1234";
    mockEnv.buildCommit = "abc1234";

    assert.deepEqual(getBuildIdentity(), { version: "v1.2.3-dev+abc1234", commit: "abc1234" });
  });

  it("returns null for an unlabelled build", () => {
    assert.equal(getBuildIdentity(), null);
  });

  it("returns null when the version is empty", () => {
    mockEnv.buildVersion = "";

    assert.equal(getBuildIdentity(), null);
  });

  it("reports an unknown commit when only the version is set", () => {
    mockEnv.buildVersion = "v1.2.3";
    mockEnv.buildCommit = "";

    assert.deepEqual(getBuildIdentity(), { version: "v1.2.3", commit: "unknown" });
  });
});
