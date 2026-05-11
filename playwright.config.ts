import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;
const databaseFile = `playwright.e2e.${Date.now()}.db`;
const distDir = ".next-playwright";
const localChromiumExecutable = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((path): path is string => Boolean(path && existsSync(path)));

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL,
    launchOptions: localChromiumExecutable
      ? { executablePath: localChromiumExecutable }
      : undefined,
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
    reuseExistingServer: false,
    timeout: 300_000,
    url: baseURL,
  },
});
