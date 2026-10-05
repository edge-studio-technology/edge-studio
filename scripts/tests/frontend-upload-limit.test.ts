import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";

const repoRoot = process.cwd();
const entrypointScript = "frontend/docker-entrypoint.d/15-edge-studio-upload-limit.envsh";

function derivedLimit(environment: Record<string, string> = {}) {
  return execFileSync(
    "sh",
    ["-c", `. ${entrypointScript}; printf '%s' "$EDGE_STUDIO_UPLOAD_MAX_REQUEST_BYTES"`],
    { cwd: repoRoot, encoding: "utf8", env: { PATH: process.env.PATH ?? "", ...environment } }
  );
}

describe("frontend upload request limit", () => {
  it("derives multipart headroom from the default backend limits", () => {
    assert.equal(derivedLimit(), "113459200");
  });

  it("tracks a custom file limit and field count", () => {
    assert.equal(
      derivedLimit({ UPLOAD_MAX_FILE_BYTES: "1048576", UPLOAD_MAX_FIELDS: "1" }),
      "2195456"
    );
  });

  it("matches backend parsing for scientific, signed, and whitespace-padded values", () => {
    assert.equal(
      derivedLimit({ UPLOAD_MAX_FILE_BYTES: " 1e9 ", UPLOAD_MAX_FIELDS: "+8" }),
      "1008601600"
    );
    assert.equal(
      derivedLimit({ UPLOAD_MAX_FILE_BYTES: "-1", UPLOAD_MAX_FIELDS: "-1" }),
      "2195456"
    );
  });

  it("falls back invalid file sizes and clamps excessive field counts", () => {
    assert.equal(
      derivedLimit({ UPLOAD_MAX_FILE_BYTES: "invalid", UPLOAD_MAX_FIELDS: "999" }),
      "173096960"
    );
  });

  it("applies the derived limit only to upload routes and hides version tokens", () => {
    const config = readFileSync(join(repoRoot, "frontend/nginx.conf"), "utf8");

    assert.equal((config.match(/client_max_body_size \$\{EDGE_STUDIO_UPLOAD_MAX_REQUEST_BYTES\};/g) ?? []).length, 3);
    assert.match(config, /location = \/api\/integritas\/stamp-file/);
    assert.match(config, /location = \/api\/integritas\/verify-proof-file/);
    assert.match(config, /location = \/api\/minima\/backups\/restore/);
    assert.match(config, /server_tokens off;/);
  });
});
