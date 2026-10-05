export const MISSING_APP_SECRET_ERROR =
  "ERROR: APP_SECRET is required. Run install.sh or set APP_SECRET to a non-empty value before starting the backend.";

export function assertAppSecretConfigured(appSecret: string | undefined) {
  if (!appSecret) {
    throw new Error(MISSING_APP_SECRET_ERROR);
  }
}

export function startWithAppSecret<T>(appSecret: string | undefined, startBackend: () => T) {
  assertAppSecretConfigured(appSecret);
  return startBackend();
}
