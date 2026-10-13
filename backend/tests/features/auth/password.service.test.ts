import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { describe, it } from "vitest";
import {
  adminCredentialValidationError,
  DUMMY_PASSWORD_HASH,
  hashPassword,
  isValidAdminCredential,
  isValidAdminPassword,
  isValidAdminPin,
  needsRehash,
  verifyPassword
} from "../../../src/features/auth/password.service.js";

describe("isValidAdminPin", () => {
  it("accepts exactly 6 digits", () => {
    assert.equal(isValidAdminPin("123456"), true);
  });

  it("rejects wrong length", () => {
    assert.equal(isValidAdminPin("12345"), false);
    assert.equal(isValidAdminPin("1234567"), false);
  });

  it("rejects non-digit characters", () => {
    assert.equal(isValidAdminPin("12345a"), false);
  });
});

describe("isValidAdminPassword", () => {
  it("accepts a password with upper, lower, number, and symbol at min length", () => {
    assert.equal(isValidAdminPassword("Abcdef1!"), true);
  });

  it("rejects passwords shorter than the minimum length", () => {
    assert.equal(isValidAdminPassword("Ab1!abc"), false);
  });

  it("rejects passwords missing an uppercase letter", () => {
    assert.equal(isValidAdminPassword("abcdefg1!"), false);
  });

  it("rejects passwords missing a lowercase letter", () => {
    assert.equal(isValidAdminPassword("ABCDEFG1!"), false);
  });

  it("rejects passwords missing a number", () => {
    assert.equal(isValidAdminPassword("Abcdefgh!"), false);
  });

  it("rejects passwords missing a symbol", () => {
    assert.equal(isValidAdminPassword("Abcdefg1"), false);
  });
});

describe("isValidAdminCredential", () => {
  it("accepts a valid pin", () => {
    assert.equal(isValidAdminCredential("123456"), true);
  });

  it("accepts a valid password", () => {
    assert.equal(isValidAdminCredential("Abcdef1!"), true);
  });

  it("rejects a value that is neither a valid pin nor a valid password", () => {
    assert.equal(isValidAdminCredential("short"), false);
  });
});

describe("adminCredentialValidationError", () => {
  it("mentions both the pin and password requirements", () => {
    const message = adminCredentialValidationError();
    assert.match(message, /6 digits/);
    assert.match(message, /8 characters/);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("verifies the original plaintext against its hash", async () => {
    const hash = await hashPassword("Abcdef1!");
    assert.notEqual(hash, "Abcdef1!");
    assert.equal(await verifyPassword("Abcdef1!", hash), true);
  });

  it("rejects an incorrect plaintext", async () => {
    const hash = await hashPassword("Abcdef1!");
    assert.equal(await verifyPassword("wrong-password", hash), false);
  });
});

const CURRENT_SCRYPT_HASH = /^scrypt\$16384\$8\$5\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/;
/** Made with bcryptjs at cost 12, the format stored by releases before scrypt. */
const LEGACY_BCRYPT_HASH = "$2b$12$XnPY/obG.x4skYX6wfHPTOgU8E.2qfaZn7iFJiatNCvgFx60ikuAW";
const LEGACY_BCRYPT_PLAIN = "Legacy-Pin1!";

function scryptHashWith(plain: string, N: number, r: number, p: number) {
  const salt = Buffer.alloc(16, 7);
  const key = scryptSync(plain, salt, 32, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

describe("hashPassword format", () => {
  it("produces a scrypt hash with the current parameters and a fresh salt", async () => {
    const first = await hashPassword("Abcdef1!");
    const second = await hashPassword("Abcdef1!");
    assert.match(first, CURRENT_SCRYPT_HASH);
    assert.notEqual(first, second);
  });
});

describe("verifyPassword legacy and malformed hashes", () => {
  it("verifies a legacy bcrypt hash", async () => {
    assert.equal(await verifyPassword(LEGACY_BCRYPT_PLAIN, LEGACY_BCRYPT_HASH), true);
  });

  it("rejects a wrong password against a legacy bcrypt hash", async () => {
    assert.equal(await verifyPassword("wrong-password", LEGACY_BCRYPT_HASH), false);
  });

  it("returns false for a malformed bcrypt hash instead of throwing", async () => {
    assert.equal(await verifyPassword("x", `$2b$99$${"a".repeat(53)}`), false);
    assert.equal(await verifyPassword("x", "$2b$12$short"), false);
  });

  it("verifies a scrypt hash made with older parameters", async () => {
    assert.equal(await verifyPassword("Abcdef1!", scryptHashWith("Abcdef1!", 2 ** 12, 8, 1)), true);
  });

  it("returns false for empty and unknown formats", async () => {
    assert.equal(await verifyPassword("Abcdef1!", ""), false);
    assert.equal(await verifyPassword("Abcdef1!", "Abcdef1!"), false);
    assert.equal(await verifyPassword("Abcdef1!", "$argon2id$v=19$m=19456,t=2,p=1$abc$def"), false);
  });

  it("returns false for malformed scrypt hashes", async () => {
    const valid = scryptHashWith("Abcdef1!", 2 ** 14, 8, 5);
    const [, , , , salt, key] = valid.split("$");
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const nonCanonicalKey = key.slice(0, -1) + alphabet[alphabet.indexOf(key.at(-1)!) | 1];
    assert.deepEqual(Buffer.from(nonCanonicalKey, "base64url"), Buffer.from(key, "base64url"));
    const malformed = [
      `scrypt$16000$8$5$${salt}$${key}`, // N not a power of two
      `scrypt$1$8$5$${salt}$${key}`, // N too small
      `scrypt$1048576$8$5$${salt}$${key}`, // memory above the bound
      `scrypt$16384$8$17$${salt}$${key}`, // p above the bound
      `scrypt$016384$8$5$${salt}$${key}`, // non-canonical number
      `scrypt$16384$8$5$${salt.slice(0, -2)}$${key}`, // short salt
      `scrypt$16384$8$5$${salt}$${key}AA`, // long key
      `scrypt$16384$8$5$${salt}$${nonCanonicalKey}`, // non-canonical encoding of the same bytes
      `scrypt$16384$8$5$${salt}$${key.replace(/.$/, "+")}`, // not base64url
      `scrypt$16384$8$5$${salt}`, // missing key
      `${valid}$extra`
    ];
    for (const hash of malformed) {
      assert.equal(await verifyPassword("Abcdef1!", hash), false, hash);
    }
    assert.equal(await verifyPassword("Abcdef1!", valid), true);
  });
});

describe("needsRehash", () => {
  it("is false for a current scrypt hash", async () => {
    assert.equal(needsRehash(await hashPassword("Abcdef1!")), false);
  });

  it("is true for a legacy bcrypt hash", () => {
    assert.equal(needsRehash(LEGACY_BCRYPT_HASH), true);
  });

  it("is true for scrypt hashes with outdated parameters", () => {
    assert.equal(needsRehash(scryptHashWith("Abcdef1!", 2 ** 12, 8, 5)), true);
    assert.equal(needsRehash(scryptHashWith("Abcdef1!", 2 ** 14, 4, 5)), true);
    assert.equal(needsRehash(scryptHashWith("Abcdef1!", 2 ** 14, 8, 1)), true);
  });

  it("is true for unknown and malformed formats", () => {
    assert.equal(needsRehash(""), true);
    assert.equal(needsRehash("scrypt$16384$8$5$abc$def"), true);
  });
});

describe("DUMMY_PASSWORD_HASH", () => {
  it("is a current scrypt hash that no password matches", async () => {
    assert.match(DUMMY_PASSWORD_HASH, CURRENT_SCRYPT_HASH);
    assert.equal(needsRehash(DUMMY_PASSWORD_HASH), false);
    assert.equal(await verifyPassword("", DUMMY_PASSWORD_HASH), false);
  });
});
