import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

/** OWASP minimum scrypt parameters; see docs/adr/0035-hash-admin-credentials-with-scrypt.md. */
const SCRYPT_N = 2 ** 14;
const SCRYPT_R = 8;
const SCRYPT_P = 5;
const SCRYPT_SALT_LENGTH = 16;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const SCRYPT_PREFIX = "scrypt";
const SCRYPT_HASH_PATTERN = /^scrypt\$([1-9]\d{0,9})\$([1-9]\d{0,2})\$([1-9]\d{0,2})\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$/;

const ADMIN_PIN_LENGTH = 6;
const ADMIN_PASSWORD_MIN_LENGTH = 8;

const ADMIN_PIN_PATTERN = new RegExp(`^\\d{${ADMIN_PIN_LENGTH}}$`);
const ADMIN_PASSWORD_UPPERCASE_PATTERN = /[A-Z]/;
const ADMIN_PASSWORD_LOWERCASE_PATTERN = /[a-z]/;
const ADMIN_PASSWORD_NUMBER_PATTERN = /\d/;
const ADMIN_PASSWORD_SYMBOL_PATTERN = /[^A-Za-z0-9\s]/;

export function isValidAdminPin(pin: string) {
  return ADMIN_PIN_PATTERN.test(pin);
}

export function isValidAdminPassword(password: string) {
  return (
    password.length >= ADMIN_PASSWORD_MIN_LENGTH &&
    ADMIN_PASSWORD_UPPERCASE_PATTERN.test(password) &&
    ADMIN_PASSWORD_LOWERCASE_PATTERN.test(password) &&
    ADMIN_PASSWORD_NUMBER_PATTERN.test(password) &&
    ADMIN_PASSWORD_SYMBOL_PATTERN.test(password)
  );
}

export function isValidAdminCredential(credential: string) {
  return isValidAdminPin(credential) || isValidAdminPassword(credential);
}

export type AdminCredentialType = "pin" | "password";

export function getAdminCredentialType(credential: string): AdminCredentialType {
  return isValidAdminPin(credential) ? "pin" : "password";
}

export function adminCredentialValidationError() {
  return `PIN must be exactly ${ADMIN_PIN_LENGTH} digits or password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, number, and symbol`;
}

type ScryptParams = { N: number; r: number; p: number };

const CURRENT_SCRYPT_PARAMS: ScryptParams = { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P };

function scryptOptions(params: ScryptParams) {
  return { ...params, maxmem: 2 * SCRYPT_MAX_MEMORY };
}

function deriveScryptKey(plain: string, salt: Buffer, params: ScryptParams) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(plain, salt, SCRYPT_KEY_LENGTH, scryptOptions(params), (error, key) => (error ? reject(error) : resolve(key)));
  });
}

function formatScryptHash(params: ScryptParams, salt: Buffer, key: Buffer) {
  return [SCRYPT_PREFIX, params.N, params.r, params.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

function isSupportedScryptParams({ N, r, p }: ScryptParams) {
  return p <= 16 && 128 * N * r <= SCRYPT_MAX_MEMORY && N >= 2 && (N & (N - 1)) === 0;
}

function decodeBase64Url(value: string, length: number) {
  const bytes = Buffer.from(value, "base64url");
  return bytes.length === length && bytes.toString("base64url") === value ? bytes : null;
}

function parseScryptHash(hash: string) {
  const match = SCRYPT_HASH_PATTERN.exec(hash);
  if (!match) return null;
  const params: ScryptParams = { N: Number(match[1]), r: Number(match[2]), p: Number(match[3]) };
  const salt = decodeBase64Url(match[4], SCRYPT_SALT_LENGTH);
  const key = decodeBase64Url(match[5], SCRYPT_KEY_LENGTH);
  if (!isSupportedScryptParams(params) || !salt || !key) return null;
  return { params, salt, key };
}

export async function hashPassword(plain: string) {
  const salt = randomBytes(SCRYPT_SALT_LENGTH);
  return formatScryptHash(CURRENT_SCRYPT_PARAMS, salt, await deriveScryptKey(plain, salt, CURRENT_SCRYPT_PARAMS));
}

/** Verifies scrypt hashes and legacy bcrypt hashes; any other or malformed format fails. */
export async function verifyPassword(plain: string, hash: string) {
  const parsed = parseScryptHash(hash);
  if (parsed) {
    return timingSafeEqual(await deriveScryptKey(plain, parsed.salt, parsed.params), parsed.key);
  }
  if (BCRYPT_HASH_PATTERN.test(hash)) {
    return bcrypt.compare(plain, hash).catch(() => false);
  }
  return false;
}

/** True for anything that is not a scrypt hash with the current parameters, including legacy bcrypt. */
export function needsRehash(hash: string) {
  const parsed = parseScryptHash(hash);
  return !parsed || parsed.params.N !== SCRYPT_N || parsed.params.r !== SCRYPT_R || parsed.params.p !== SCRYPT_P;
}

/** Current-parameter hash for the unknown-user login path, so it costs the same as a real verify. */
const dummySalt = randomBytes(SCRYPT_SALT_LENGTH);
export const DUMMY_PASSWORD_HASH = formatScryptHash(
  CURRENT_SCRYPT_PARAMS,
  dummySalt,
  scryptSync(randomBytes(SCRYPT_KEY_LENGTH), dummySalt, SCRYPT_KEY_LENGTH, scryptOptions(CURRENT_SCRYPT_PARAMS))
);
