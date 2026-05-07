import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    coverage: {
      include: [
        "src/lib/intelligence/planner.ts",
        "src/lib/intelligence/prioritizer.ts",
        "src/lib/intelligence/recommender.ts",
        "src/lib/intelligence/router.ts",
        "src/lib/intelligence/validator.ts",
      ],
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        "src/lib/intelligence/*.ts": {
          branches: 70,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
