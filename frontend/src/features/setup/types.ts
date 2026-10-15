import type { AdminCredentialType } from "../auth/adminCredentials";

export type OnboardingStepId = "welcome" | "credentials" | "connectAccount";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
};

export type OnboardingFormState = {
  credentialType: AdminCredentialType;
  password: string;
  confirmPassword: string;
};
