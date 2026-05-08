import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

function resolveSqliteFilePath(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    return null;
  }

  const localPath = databaseUrl.slice("file:".length);

  if (!localPath) {
    return null;
  }

  if (localPath.startsWith("./") || localPath.startsWith("../")) {
    return resolve(process.cwd(), localPath);
  }

  return resolve(localPath);
}

const databaseUrl =
  process.env.DATABASE_URL ?? `file:./playwright.e2e.${Date.now()}.db`;
process.env.DATABASE_URL = databaseUrl;
const databaseFilePath = resolveSqliteFilePath(databaseUrl);
const npxExecutable =
  process.platform === "win32"
    ? '"C:\\Program Files\\nodejs\\npx.cmd"'
    : "npx";
const npmExecutable =
  process.platform === "win32"
    ? '"C:\\Program Files\\nodejs\\npm.cmd"'
    : "npm";
const logDirectoryPath = resolve(process.cwd(), "test-results");
const logFilePath = resolve(logDirectoryPath, "playwright-webserver.log");

mkdirSync(logDirectoryPath, { recursive: true });
rmSync(logFilePath, { force: true });

function log(message) {
  appendFileSync(logFilePath, `[${new Date().toISOString()}] ${message}\n`);
}

log(`bootstrap start; DATABASE_URL=${databaseUrl}; PORT=${process.env.PORT ?? "3100"}`);

if (databaseFilePath) {
  rmSync(databaseFilePath, { force: true });
  rmSync(`${databaseFilePath}-shm`, { force: true });
  rmSync(`${databaseFilePath}-wal`, { force: true });
  log(`removed sqlite files for ${databaseFilePath}`);
}

const port = process.env.PORT ?? "3100";

const prismaCommand = `${npxExecutable} prisma db push`;
log(`running prisma command: ${prismaCommand}`);

const prismaResult = spawnSync(prismaCommand, {
  cwd: process.cwd(),
  env: process.env,
  shell: true,
  stdio: "inherit",
});

log(`prisma exit code: ${prismaResult.status ?? "null"}`);

if (prismaResult.status !== 0) {
  process.exit(prismaResult.status ?? 1);
}

const buildCommand = `${npmExecutable} run build`;
log(`running build command: ${buildCommand}`);

const buildResult = spawnSync(buildCommand, {
  cwd: process.cwd(),
  env: process.env,
  shell: true,
  encoding: "utf-8",
});

if (buildResult.stdout) {
  appendFileSync(logFilePath, buildResult.stdout);
  process.stdout.write(buildResult.stdout);
}

if (buildResult.stderr) {
  appendFileSync(logFilePath, buildResult.stderr);
  process.stderr.write(buildResult.stderr);
}

log(`build exit code: ${buildResult.status ?? "null"}`);

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const startCommand = `${npmExecutable} run start -- --port ${port}`;
log(`starting app server: ${startCommand}`);

const devServer = spawn(startCommand, {
  cwd: process.cwd(),
  env: process.env,
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
});

log(`app server pid: ${devServer.pid ?? "unknown"}`);

devServer.stdout?.on("data", (chunk) => {
  const text = chunk.toString();
  appendFileSync(logFilePath, text);
  process.stdout.write(text);
});

devServer.stderr?.on("data", (chunk) => {
  const text = chunk.toString();
  appendFileSync(logFilePath, text);
  process.stderr.write(text);
});

const forwardSignal = (signal) => {
  if (!devServer.killed) {
    devServer.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

devServer.on("exit", (code) => {
  log(`app server exit code: ${code ?? 0}`);
  process.exit(code ?? 0);
});
