import { db } from "../../db/database.js";
import { getIntegritasAuth } from "../integritas-auth/integritas-auth.repository.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";
import { LOCAL_ADMIN_DISPLAY_NAME, LOCAL_ADMIN_USERNAME } from "./auth.constants.js";
import { recordAuditEvent } from "./audit.service.js";
import { countUsers, createUser } from "./auth.repository.js";
import {
  adminCredentialValidationError,
  getAdminCredentialType,
  hashPassword,
  isValidAdminCredential
} from "./password.service.js";
import { createSession } from "./session.service.js";

const SETUP_COMPLETED_SETTING_KEY = "setup.completed_at";

export function isLocalAdminCreated() {
  return countUsers() > 0;
}

export function isSetupComplete() {
  return isLocalAdminCreated() && Boolean(getSetting(SETUP_COMPLETED_SETTING_KEY));
}

export function markSetupComplete() {
  if (!isLocalAdminCreated() || !getIntegritasAuth()) return;
  if (!getSetting(SETUP_COMPLETED_SETTING_KEY)) {
    saveSetting(SETUP_COMPLETED_SETTING_KEY, new Date().toISOString());
  }
}

export function assertLocalAdminNotCreated() {
  if (isLocalAdminCreated()) {
    throw new SetupError("Setup is already complete", 403);
  }
}

export class SetupError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function completeSetup(input: { password: string }) {
  assertLocalAdminNotCreated();

  const password = input.password;

  if (!isValidAdminCredential(password)) throw new SetupError(adminCredentialValidationError(), 400);

  const passwordHash = await hashPassword(password);
  const credentialType = getAdminCredentialType(password);

  const complete = db.transaction(() => {
    if (countUsers() > 0) throw new SetupError("Setup is already complete", 403);

    const userId = createUser({
      username: LOCAL_ADMIN_USERNAME,
      passwordHash,
      credentialType
    });

    recordAuditEvent("setup.complete", { userId, detail: LOCAL_ADMIN_DISPLAY_NAME });

    return userId;
  });

  const userId = complete();
  const sessionToken = createSession(userId);

  return {
    sessionToken,
    user: { displayName: LOCAL_ADMIN_DISPLAY_NAME, role: "admin" as const, credentialType }
  };
}
