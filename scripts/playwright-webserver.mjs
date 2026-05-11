import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, rmSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

function resolvePlaywrightSqliteDatabase(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    return null;
  }

  const localPath = databaseUrl.slice("file:".length);

  if (!localPath) {
    return null;
  }

  const normalizedPath = localPath.startsWith("./")
    ? localPath.slice(2)
    : localPath;

  if (
    isAbsolute(normalizedPath) ||
    normalizedPath.includes("/") ||
    normalizedPath.includes("\\") ||
    normalizedPath.includes("..") ||
    !/^playwright\.e2e\.[A-Za-z0-9_-]+\.db$/.test(normalizedPath)
  ) {
    throw new Error(
      "Playwright smoke DATABASE_URL must be a workspace-local file:./playwright.e2e.<id>.db SQLite URL.",
    );
  }

  return {
    fileName: normalizedPath,
    filePath: resolve(process.cwd(), normalizedPath),
  };
}

const databaseUrl =
  process.env.DATABASE_URL ?? `file:./playwright.e2e.${Date.now()}.db`;
process.env.DATABASE_URL = databaseUrl;
const databaseFile = resolvePlaywrightSqliteDatabase(databaseUrl);
const nodeExecutable =
  process.platform === "win32"
    ? '"C:\\Program Files\\nodejs\\node.exe"'
    : "node";
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

log(
  `bootstrap start; DATABASE_FILE=${databaseFile?.fileName ?? "unavailable"}; PORT=${
    process.env.PORT ?? "3100"
  }`,
);

if (databaseFile) {
  rmSync(databaseFile.filePath, { force: true });
  rmSync(`${databaseFile.filePath}-shm`, { force: true });
  rmSync(`${databaseFile.filePath}-wal`, { force: true });
  log(`removed sqlite files for ${databaseFile.fileName}`);
}

const port = process.env.PORT ?? "3100";

const prismaCommand = `${nodeExecutable} scripts/prepare-playwright-db.mjs`;
log(`running database setup command: ${prismaCommand}`);

const prismaResult = spawnSync(prismaCommand, {
  cwd: process.cwd(),
  env: process.env,
  shell: true,
  stdio: "inherit",
});

log(`database setup exit code: ${prismaResult.status ?? "null"}`);

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
