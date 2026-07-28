import { readFileSync } from "node:fs";
import { verify } from "node:crypto";

const [manifestPath, signaturePath, publicKeyPath] = process.argv.slice(2);

if (!manifestPath || !signaturePath || !publicKeyPath) {
  console.error("Usage: verify-manifest.mjs <manifest-path> <signature-b64-path> <public-key-pem-path>");
  process.exit(1);
}

try {
  const manifestBytes = readFileSync(manifestPath);
  const signatureBase64 = readFileSync(signaturePath, "utf8").trim();
  const signature = Buffer.from(signatureBase64, "base64");
  const publicKeyPem = readFileSync(publicKeyPath, "utf8");

  const valid = verify(null, manifestBytes, { key: publicKeyPem, format: "pem" }, signature);
  if (!valid) {
    console.error("Manifest signature verification failed");
    process.exit(1);
  }
} catch (error) {
  console.error(`Manifest verification error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
