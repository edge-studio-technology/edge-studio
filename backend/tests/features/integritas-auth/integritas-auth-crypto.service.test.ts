import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { decryptIntegritasToken, encryptIntegritasToken } from "../../../src/features/integritas-auth/integritas-auth-crypto.service.js";

describe("encryptIntegritasToken / decryptIntegritasToken", () => {
  it("round-trips a plaintext token", () => {
    const ciphertext = encryptIntegritasToken("super-secret-token");
    assert.notEqual(ciphertext, "super-secret-token");
    assert.equal(decryptIntegritasToken(ciphertext), "super-secret-token");
  });

  it("produces JSON ciphertext with iv/tag/value fields", () => {
    const ciphertext = encryptIntegritasToken("abc");
    const parsed = JSON.parse(ciphertext) as { iv: string; tag: string; value: string };
    assert.ok(parsed.iv);
    assert.ok(parsed.tag);
    assert.ok(parsed.value);
  });

  it("produces different ciphertext for the same plaintext each call", () => {
    const first = encryptIntegritasToken("same-value");
    const second = encryptIntegritasToken("same-value");
    assert.notEqual(first, second);
    assert.equal(decryptIntegritasToken(first), "same-value");
    assert.equal(decryptIntegritasToken(second), "same-value");
  });

  it("throws when decrypting malformed ciphertext", () => {
    assert.throws(() => decryptIntegritasToken("not-json"));
  });
});
