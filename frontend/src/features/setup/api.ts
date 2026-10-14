import { postJson } from "../../lib/api";
import type { AuthUser } from "../auth/types";

export async function initTotp() {
  return postJson<{ qrCodePngBase64: string; expiresAt: string; secret: string }>("/api/setup/totp/init");
}

export async function verifyTotp(totpToken: string) {
  return postJson<{ valid: boolean }>("/api/setup/totp/verify", { totpToken });
}

export async function completeSetup(input: { password: string }) {
  return postJson<{ success: boolean; user: AuthUser }>("/api/setup/complete", input);
}
