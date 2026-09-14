import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, verify as cryptoVerify } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/release/sign-manifest.mjs");

function runScript(argv: string[], env: Record<string, string | undefined>) {
  return spawnSync(process.execPath, [scriptPath, ...argv], {
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
}

describe("sign-manifest.mjs", () => {
  let dir: string;
  let manifestPath: string;
  let signaturePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sign-manifest-"));
    manifestPath = join(dir, "manifest.json");
    signaturePath = join(dir, "manifest.json.sig");
    writeFileSync(manifestPath, JSON.stringify({ version: "1.0.0" }));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("exits non-zero when MANIFEST_SIGNING_KEY is not set", () => {
    const result = runScript([manifestPath, signaturePath], { MANIFEST_SIGNING_KEY: undefined });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /MANIFEST_SIGNING_KEY env var is required/);
  });

  it("writes a signature file verifiable with the matching public key", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

    const result = runScript([manifestPath, signaturePath], { MANIFEST_SIGNING_KEY: privateKeyPem });

    assert.equal(result.status, 0);
    const signature = Buffer.from(readFileSync(signaturePath, "utf8"), "base64");
    const manifestBytes = readFileSync(manifestPath);
    assert.equal(cryptoVerify(null, manifestBytes, publicKey, signature), true);
  });

  it("produces a signature that fails verification against a tampered manifest", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

    runScript([manifestPath, signaturePath], { MANIFEST_SIGNING_KEY: privateKeyPem });

    const signature = Buffer.from(readFileSync(signaturePath, "utf8"), "base64");
    const tamperedBytes = Buffer.from(JSON.stringify({ version: "9.9.9" }));
    assert.equal(cryptoVerify(null, tamperedBytes, publicKey, signature), false);
  });

  it("produces a signature that fails verification against a mismatched public key", () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const { publicKey: otherPublicKey } = generateKeyPairSync("ed25519");

    runScript([manifestPath, signaturePath], { MANIFEST_SIGNING_KEY: privateKeyPem });

    const signature = Buffer.from(readFileSync(signaturePath, "utf8"), "base64");
    const manifestBytes = readFileSync(manifestPath);
    assert.equal(cryptoVerify(null, manifestBytes, otherPublicKey, signature), false);
  });

  it("defaults to manifest.json / manifest.json.sig in the cwd when no args are given", () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      cwd: dir,
      env: { ...process.env, MANIFEST_SIGNING_KEY: privateKeyPem }
    });

    assert.equal(result.status, 0);
    assert.doesNotThrow(() => readFileSync(join(dir, "manifest.json.sig")));
  });
});
