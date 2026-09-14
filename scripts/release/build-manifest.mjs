import { writeFileSync } from "node:fs";

const outPath = process.argv[2] ?? "manifest.json";
const frontendDigest = process.env.FRONTEND_DIGEST ?? "";
const backendDigest = process.env.BACKEND_DIGEST ?? "";
const updateAgentDigest = process.env.UPDATE_AGENT_DIGEST ?? "";
const hostRuntimeUrl = process.env.HOST_RUNTIME_URL ?? "";
const hostRuntimeSha256 = process.env.HOST_RUNTIME_SHA256 ?? "";
const version = process.env.VERSION ?? "";

if (!version) {
  throw new Error("VERSION env var is required");
}

const manifest = {
  frontend: frontendDigest,
  backend: backendDigest,
  updateAgent: updateAgentDigest,
  hostRuntime: {
    url: hostRuntimeUrl,
    sha256: hostRuntimeSha256
  },
  version,
  createdAt: new Date().toISOString()
};

const NON_DIGEST_KEYS = new Set(["version", "createdAt", "hostRuntime"]);

for (const [service, digest] of Object.entries(manifest)) {
  if (NON_DIGEST_KEYS.has(service)) continue;
  if (!digest) {
    throw new Error(`manifest missing digest for "${service}"`);
  }
}

if (!manifest.hostRuntime.url) {
  throw new Error('manifest missing host runtime URL: set HOST_RUNTIME_URL');
}
if (!/^[a-fA-F0-9]{64}$/.test(manifest.hostRuntime.sha256)) {
  throw new Error('manifest missing host runtime SHA-256: set HOST_RUNTIME_SHA256');
}

writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
