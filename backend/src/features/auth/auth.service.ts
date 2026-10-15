import { db } from "../../db/database.js";
import { LOCAL_ADMIN_DISPLAY_NAME } from "./auth.constants.js";
import { recordAuditEvent } from "./audit.service.js";
import {
  findTheUser,
  findUserById,
  replaceUserPasswordHash,
  updateUserCredentialType,
  updateUserLastLogin,
  updateUserPassword
} from "./auth.repository.js";
import {
  adminCredentialValidationError,
  DUMMY_PASSWORD_HASH,
  getAdminCredentialType,
  hashPassword,
  isValidAdminCredential,
  needsRehash,
  verifyPassword
} from "./password.service.js";
import { createSession, deleteAllUserSessions } from "./session.service.js";

export class AuthSettingsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function login(input: { password: string }) {
  const password = input.password;

  const user = findTheUser();

  const passwordHash = user?.password ?? DUMMY_PASSWORD_HASH;
  const passwordValid = await verifyPassword(password, passwordHash);

  if (!user || !passwordValid) {
    recordAuditEvent("login.failure", { detail: "failed" });
    return { ok: false as const };
  }

  const replacementHash = needsRehash(passwordHash) ? await hashPassword(password) : null;

  // No await from here: a credential change that landed during verification or rehashing
  // fails the login instead of receiving a session after its revocation.
  const completed = db.transaction(() => {
    const current = findUserById(user.id);
    if (!current || current.password !== passwordHash) return null;

    let credentialType = current.credential_type;
    const verifiedCredentialType = getAdminCredentialType(password);
    if (credentialType !== verifiedCredentialType && updateUserCredentialType(user.id, passwordHash, verifiedCredentialType)) {
      credentialType = verifiedCredentialType;
    }
    if (replacementHash) replaceUserPasswordHash(user.id, passwordHash, replacementHash);

    updateUserLastLogin(user.id);
    return { credentialType, sessionToken: createSession(user.id) };
  })();

  if (!completed) {
    recordAuditEvent("login.failure", { detail: "failed" });
    return { ok: false as const };
  }

  const { credentialType, sessionToken } = completed;
  recordAuditEvent("login.success", { userId: user.id, detail: LOCAL_ADMIN_DISPLAY_NAME });

  return {
    ok: true as const,
    sessionToken,
    user: { displayName: LOCAL_ADMIN_DISPLAY_NAME, role: user.role, credentialType }
  };
}

export async function changePassword(
  userId: string,
  input: {
    currentPassword: string;
    newPassword: string;
  }
) {
  const user = findUserById(userId);
  if (!user) throw new AuthSettingsError("User not found", 404);

  const passwordValid = await verifyPassword(input.currentPassword, user.password);
  if (!passwordValid) throw new AuthSettingsError("Invalid current credential", 401);

  if (!isValidAdminCredential(input.newPassword)) throw new AuthSettingsError(adminCredentialValidationError(), 400);

  const newHash = await hashPassword(input.newPassword);
  updateUserPassword(userId, newHash, getAdminCredentialType(input.newPassword));
  deleteAllUserSessions(userId);
  recordAuditEvent("settings.password_changed", { userId, detail: LOCAL_ADMIN_DISPLAY_NAME });
}
