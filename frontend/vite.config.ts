import fs from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const repoRoot = path.resolve(__dirname, "..");
const certDir = path.join(repoRoot, "data/certs");

function devHttpsOptions(mode: string) {
  if (mode !== "https") {
    return undefined;
  }

  const keyPath = path.join(certDir, "server.key");
  const certPath = path.join(certDir, "server.crt");
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    throw new Error(
      "HTTPS dev requires TLS certs in data/certs. Run from the repo root: bash scripts/generate-tls-cert.sh"
    );
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "");
  const backendTarget = `http://localhost:${env.PORT || "3000"}`;
  const https = devHttpsOptions(mode);
  const proxy = {
    "/api": backendTarget,
    // update-agent's fixed container port, published to the host via
    // docker-compose.override.yml for native dev. Trailing slash required —
    // bare "/update" is the SPA's own route. See docs/adr/0002-update-page-split.md.
    "^/update/": {
      target: "http://localhost:8081",
      rewrite: (path: string) => path.replace(/^\/update/, "") || "/",
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 3030,
      https,
      proxy,
    },
    preview: {
      host: "0.0.0.0",
      port: 3030,
      https,
      proxy,
    },
    test: {
      environment: "happy-dom",
      include: ["tests/**/*.test.{ts,tsx}"],
      setupFiles: ["tests/setup.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json-summary", "html"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/**/*.d.ts",
          "src/**/*Types.ts",
          "src/**/types.ts",
          "src/pages/**",
          "src/App.tsx",
          "src/main.tsx",
          "src/app/nav.ts",
          "src/app/brand.ts",
          "src/app/names.ts",
          "src/features/auth/index.ts",
          "src/features/automation/workflow/canvas/index.ts",
        ],
        thresholds: {
          statements: 90,
          branches: 89,
          functions: 87,
          lines: 92,
        },
      },
    },
  };
});
