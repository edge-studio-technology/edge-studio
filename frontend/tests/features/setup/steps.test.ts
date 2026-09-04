import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { onboardingSteps, onboardingWorkSteps } from "../../../src/features/setup/steps";

describe("onboardingSteps", () => {
  it("includes welcome, credentials, and connectAccount (TOTP_ENABLED is currently false)", () => {
    expect(onboardingSteps.map((step) => step.id)).toEqual(["welcome", "credentials", "connectAccount"]);
  });

  it("labels each step", () => {
    expect(onboardingSteps).toEqual([
      { id: "welcome", label: "Welcome" },
      { id: "credentials", label: "Secure this device" },
      { id: "connectAccount", label: "Integritas Connect" },
    ]);
  });
});

describe("onboardingWorkSteps", () => {
  it("excludes the welcome step", () => {
    expect(onboardingWorkSteps.map((step) => step.id)).toEqual(["credentials", "connectAccount"]);
  });
});

/** `TOTP_ENABLED` ships as `false`, so the two-factor step is only built with the module mocked. */
describe("onboardingSteps with TOTP enabled", () => {
  let steps: typeof import("../../../src/features/setup/steps");

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("../../../src/features/auth/totpEnabled", () => ({ TOTP_ENABLED: true }));
    steps = await import("../../../src/features/setup/steps");
  });

  afterAll(() => {
    vi.doUnmock("../../../src/features/auth/totpEnabled");
    vi.resetModules();
  });

  it("inserts the two-factor step between credentials and Integritas Connect", () => {
    expect(steps.onboardingSteps).toEqual([
      { id: "welcome", label: "Welcome" },
      { id: "credentials", label: "Secure this device" },
      { id: "twofa", label: "Two-factor auth" },
      { id: "connectAccount", label: "Integritas Connect" },
    ]);
  });

  it("includes the two-factor step in the work steps", () => {
    expect(steps.onboardingWorkSteps.map((step) => step.id)).toEqual([
      "credentials",
      "twofa",
      "connectAccount",
    ]);
  });
});
