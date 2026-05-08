import { defineConfig } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;
const databaseFile = `playwright.e2e.${Date.now()}.db`;
const distDir = ".next-playwright";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: '"C:\\Program Files\\nodejs\\node.exe" scripts/playwright-webserver.mjs',
    env: {
      ...process.env,
      AI_PROVIDER: "test",
      DATABASE_URL: `file:./${databaseFile}`,
      NEXT_DIST_DIR: distDir,
      PORT: String(port),
    },
    reuseExistingServer: true,
    timeout: 300_000,
    url: baseURL,
  },
});