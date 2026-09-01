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
        "src/config/**",
        "src/middleware/requestLogger.ts",
        "src/db/database.ts",
        "src/db/ensureDatabaseDirectory.ts",
        "src/features/auth/rate-limit.middleware.ts",
        "src/features/auth/integritas-validation.service.ts",
        "src/features/integritas/upload.middleware.ts",
        "src/features/minima/minima-upload.middleware.ts"
      ],
      thresholds: {
        statements: 73,
        branches: 68,
        functions: 74,
        lines: 75
      }
    }
  }
});
