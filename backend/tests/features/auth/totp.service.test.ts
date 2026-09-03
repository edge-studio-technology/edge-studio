import assert from "node:assert/strict";
import * as OTPAuth from "otpauth";
import { describe, it } from "vitest";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateSecret,
  getOtpAuthUrl,
  renderQrPngBase64,
  verifyToken
} from "../../../src/features/auth/totp.service.js";

function authenticator(secret: string) {
  return new OTPAuth.TOTP({
    issuer: "Edge Studio",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret)
  });
}

describe("generateSecret", () => {
  it("returns a base32 secret", () => {
    const secret = generateSecret();
    assert.match(secret, /^[A-Z2-7]+$/);
    assert.equal(secret.length, 32);
  });

  it("returns a different secret on every call", () => {
    assert.notEqual(generateSecret(), generateSecret());
  });
});

describe("getOtpAuthUrl", () => {
  it("builds an otpauth URL carrying the issuer, label, and secret", () => {
    const secret = generateSecret();
    const url = getOtpAuthUrl(secret, "Edge Studio");

    assert.ok(url.startsWith("otpauth://totp/"));
    assert.ok(url.includes("issuer=Edge%20Studio"));
    assert.ok(url.includes(`secret=${secret}`));
    assert.ok(url.includes("digits=6"));
    assert.ok(url.includes("period=30"));
  });
});

describe("renderQrPngBase64", () => {
  it("renders the otpauth URL as a PNG data URL", async () => {
    const dataUrl = await renderQrPngBase64(getOtpAuthUrl(generateSecret(), "Edge Studio"));
    assert.ok(dataUrl.startsWith("data:image/png;base64,"));
    assert.ok(dataUrl.length > "data:image/png;base64,".length);
  });
});

describe("verifyToken", () => {
  it("accepts the current token for the secret", () => {
    const secret = generateSecret();
    assert.equal(verifyToken(secret, authenticator(secret).generate()), true);
  });

  it("accepts a token from the previous period", () => {
    const secret = generateSecret();
    const previous = authenticator(secret).generate({ timestamp: Date.now() - 30_000 });
    assert.equal(verifyToken(secret, previous), true);
  });

  it("rejects a token from outside the accepted window", () => {
    const secret = generateSecret();
    const stale = authenticator(secret).generate({ timestamp: Date.now() - 5 * 60_000 });
    assert.equal(verifyToken(secret, stale), false);
  });

  it("rejects a token generated from a different secret", () => {
    assert.equal(verifyToken(generateSecret(), authenticator(generateSecret()).generate()), false);
  });
});

describe("encryptTotpSecret / decryptTotpSecret", () => {
  it("round-trips a secret without storing it in cleartext", () => {
    const secret = generateSecret();
    const encrypted = encryptTotpSecret(secret);

    assert.ok(!encrypted.includes(secret));
    assert.deepEqual(Object.keys(JSON.parse(encrypted)).sort(), ["iv", "tag", "value"]);
    assert.equal(decryptTotpSecret(encrypted), secret);
  });

  it("produces different ciphertext for the same secret", () => {
    const secret = generateSecret();
    assert.notEqual(encryptTotpSecret(secret), encryptTotpSecret(secret));
  });

  it("throws when the stored value is not encrypted secret JSON", () => {
    assert.throws(() => decryptTotpSecret("not-json"));
  });

  it("throws when the ciphertext has been tampered with", () => {
    const encrypted = JSON.parse(encryptTotpSecret(generateSecret())) as { value: string };
    encrypted.value = Buffer.from("tampered").toString("base64");
    assert.throws(() => decryptTotpSecret(JSON.stringify(encrypted)));
  });
});
