import type { OnboardingStep } from "./types";

export const onboardingSteps: OnboardingStep[] = [
  { id: "welcome", label: "Welcome" },
  { id: "credentials", label: "Secure this device" },
  { id: "connectAccount", label: "Integritas Connect" },
];

export const onboardingWorkSteps = onboardingSteps.filter((step) => step.id !== "welcome");
