import { describe, expect, it } from "vitest";
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
