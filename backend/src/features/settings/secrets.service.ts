import { decryptIntegritasToken } from "../integritas-auth/integritas-auth-crypto.service.js";
import { getIntegritasAuth } from "../integritas-auth/integritas-auth.repository.js";

export function getConnectedIntegritasApiKey() {
  const encryptedValue = getIntegritasAuth()?.api_key_enc;
  if (!encryptedValue) return "";

  try {
    return decryptIntegritasToken(encryptedValue);
  } catch {
    console.error("Failed to decrypt Integritas Connect API key");
    return "";
  }
}

export function getIntegritasApiKey() {
  return getConnectedIntegritasApiKey();
}

export function integritasApiKeySource() {
  return getConnectedIntegritasApiKey() ? ("connect" as const) : ("none" as const);
}
