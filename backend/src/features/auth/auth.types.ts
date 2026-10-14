import type { Request } from "express";
import type { AdminCredentialType } from "./password.service.js";

export type UserRole = "admin";

export type UserRecord = {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  created_at: string;
  last_login: string | null;
  credential_type: AdminCredentialType;
};

export type SessionUser = {
  id: string;
  displayName: string;
  role: UserRole;
  lastLogin: string | null;
  credentialType: AdminCredentialType;
};

export type AuthenticatedRequest = Request & {
  user: SessionUser;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express Request augmentation
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}
