import { writeFileSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";

const publicKeyPath = new URL("../../update-agent/manifest-public-key.pem", import.meta.url);

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

writeFileSync(publicKeyPath, publicKeyPem);

console.log(`Wrote public key to ${publicKeyPath} (commit this — update-agent's Dockerfile bakes it into the image).`);
console.log("");
console.log("Also update the MANIFEST_PUBLIC_KEY_PEM heredoc in install.sh to match, or installs will");
console.log("reject the new signatures. scripts/tests/install-bootstrap-trust-set.test.ts checks this.");
console.log("");
console.log("Private key (PEM) — paste this into the GitHub secret MANIFEST_SIGNING_KEY, then discard it locally:");
console.log("");
console.log(privateKeyPem);
