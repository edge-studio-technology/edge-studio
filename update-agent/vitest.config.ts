import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.types.ts",
        "src/**/*.routes.ts",
        "src/index.ts",
        "src/app.ts",
        "src/config/env.ts",
        "src/auth/auth.middleware.ts"
      ],
      thresholds: {
        statements: 95,
        branches: 92,
        functions: 92,
        lines: 96
      }
    }
  }
});
