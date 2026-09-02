import nodeCrypto from "node:crypto";
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { env } from "../../src/config/env.js";
import { decryptSecret, encryptSecret, sha256Hex, sha3HashHex } from "../../src/shared/crypto.js";

describe("sha3HashHex", () => {
  it("matches node:crypto's sha3-256 digest for the same input", () => {
    assert.equal(sha3HashHex("hello"), nodeCrypto.createHash("sha3-256").update("hello").digest("hex"));
  });

  it("produces the same digest for equivalent string and buffer input", () => {
    assert.equal(sha3HashHex("hello"), sha3HashHex(Buffer.from("hello", "utf8")));
  });

  it("produces different digests for different input", () => {
    assert.notEqual(sha3HashHex("a"), sha3HashHex("b"));
  });
});

describe("sha256Hex", () => {
  it("matches node:crypto's sha256 digest for the same input", () => {
    assert.equal(sha256Hex("hello"), nodeCrypto.createHash("sha256").update("hello").digest("hex"));
  });

  it("produces the same digest for equivalent string and buffer input", () => {
    assert.equal(sha256Hex("hello"), sha256Hex(Buffer.from("hello", "utf8")));
  });
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a value", () => {
    const encrypted = encryptSecret("super-secret-value");
    assert.equal(decryptSecret(encrypted), "super-secret-value");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const first = encryptSecret("same-value");
    const second = encryptSecret("same-value");
    assert.notEqual(first.value, second.value);
    assert.notEqual(first.iv, second.iv);
  });

  it("throws when the auth tag has been tampered with", () => {
    const encrypted = encryptSecret("tamper-test");
    const tampered = { ...encrypted, tag: encryptSecret("other").tag };
    assert.throws(() => decryptSecret(tampered));
  });

  it("throws when the ciphertext has been tampered with", () => {
    const encrypted = encryptSecret("tamper-test");
    const tampered = { ...encrypted, value: encryptSecret("other").value };
    assert.throws(() => decryptSecret(tampered));
  });

  it("decrypts a persisted ciphertext fixture", () => {
    const originalAppSecret = env.appSecret;
    env.appSecret = "compatibility-test-app-secret";
    try {
      assert.equal(
        decryptSecret({
          iv: "AAECAwQFBgcICQoL",
          tag: "bK15t5esxtCRJ2t8jcuAvQ==",
          value: "hRIL21H5RgES+gHsYLTVg6mZuaxpZQ=="
        }),
        "persisted-secret-value"
      );
    } finally {
      env.appSecret = originalAppSecret;
    }
  });

  it("cannot decrypt ciphertext after the app secret changes", () => {
    const originalAppSecret = env.appSecret;
    env.appSecret = "encryption-secret";
    try {
      const encrypted = encryptSecret("key-dependence-test");
      env.appSecret = "different-secret";
      assert.throws(() => decryptSecret(encrypted));
    } finally {
      env.appSecret = originalAppSecret;
    }
  });
});
