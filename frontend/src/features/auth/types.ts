export type AuthUser = {
  displayName: string;
  role: "admin";
  lastLogin?: string | null;
  credentialType: "pin" | "password";
};

export type SetupStatus = {
  localAdminCreated: boolean;
  setupComplete: boolean;
};
