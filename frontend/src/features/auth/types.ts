import type { AdminCredentialType } from "./adminCredentials";

export type AuthUser = {
  displayName: string;
  role: "admin";
  lastLogin?: string | null;
  credentialType: AdminCredentialType;
};

export type SetupStatus = {
  localAdminCreated: boolean;
  setupComplete: boolean;
  credentialType: AdminCredentialType | null;
};
