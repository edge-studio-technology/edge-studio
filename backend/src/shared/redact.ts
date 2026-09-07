// Single redaction boundary for anything that can reach a client response, a persisted
// error row, or a log line.
const REDACTED = "[redacted]";

// Order matters: regex alternation is leftmost-first, so `passphrase` must precede `phrase`.
const secretArgKeys = "seedphrase|seed_phrase|passphrase|password|phrase|privatekey|private_key|mnemonic|apisecret|apikey|api_key|secret|token";

// Substring-matched against the normalized key (see isSecretKey). Excludes bare `token` —
// that's a Minima token id/name here (`tokenid`, `tokens`), not a credential.
const secretKeyWords = [
  "password", "passphrase", "phrase", "mnemonic", "secret", "credential", "authorization",
  "apikey", "apisecret", "clientsecret", "privatekey", "privkey", "publickeyhash", "seedphrase",
  "accesstoken", "refreshtoken", "sessiontoken", "authtoken", "apitoken", "bearertoken", "webhooktoken"
];

const stringRules: Array<[RegExp, string]> = [
  // `password:"value"` / `password:value` — raw RPC command form.
  [new RegExp(`\\b(${secretArgKeys}):(?:"[^"]*"|[^\\s"]+)`, "gi"), `$1:${REDACTED}`],
  // Same argument percent-encoded. Quoted form runs first since a quoted value may contain
  // spaces (encoded as %20), which the unquoted branch would otherwise stop at.
  [new RegExp(`(${secretArgKeys})%3A(?:%22[^\\s]*?%22|(?:(?!%20)[^\\s])*)`, "gi"), `$1%3A${REDACTED}`],
  // Authorization: Bearer <token>
  [/\b(bearer)\s+[^\s"']+/gi, `$1 ${REDACTED}`],
  // mqtt://user:pass@broker:1883
  [/([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):[^/\s@]+@/gi, `$1$2:${REDACTED}@`]
];

export function redactSecrets(value: string): string {
  return stringRules.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export function isSecretKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return secretKeyWords.some((word) => normalized.includes(word));
}

// Cost guard, not a security boundary — see the fail-closed check in walk().
const maxDepth = 20;
const TRUNCATED = "[redacted: too deeply nested to inspect]";

type Walk = { blankSecretKeys: boolean };

function walk(value: unknown, depth: number, options: Walk): unknown {
  if (typeof value === "string") return redactSecrets(value);
  if (value === null || typeof value !== "object") return value;
  // Fail closed: don't return an unread subtree past the depth limit.
  if (depth >= maxDepth) return TRUNCATED;
  if (Array.isArray(value)) return value.map((item) => walk(item, depth + 1, options));

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const blank = options.blankSecretKeys && isSecretKey(key) && item !== null && item !== undefined;
    out[key] = blank ? REDACTED : walk(item, depth + 1, options);
  }
  return out;
}

// Blanks secret-looking keys and scrubs strings — for objects we own.
export function redactDeep<T>(value: T): T {
  return walk(value, 0, { blankSecretKeys: true }) as T;
}

// Scrubs strings only, keys untouched — for third-party payloads (e.g. Minima's `tokenid`).
export function redactStrings<T>(value: T): T {
  return walk(value, 0, { blankSecretKeys: false }) as T;
}

// Drops `cause` when the message needed redacting — a safety net, since current fetch errors
// don't carry a secret in their message or cause.
export function redactError(error: unknown): unknown {
  if (typeof error === "string") return redactSecrets(error);
  if (!(error instanceof Error)) return error;

  const message = redactSecrets(error.message);
  if (message === error.message) return error;

  const redacted = new Error(message);
  redacted.name = error.name;
  const code = (error as NodeJS.ErrnoException).code;
  if (code) (redacted as NodeJS.ErrnoException).code = code;
  return redacted;
}
