import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

import { ComfyClient } from "@/modules/comfy/client";

type FetchLike = typeof fetch;
type SpawnLike = typeof spawn;
type ComfyBootstrapEnv = Record<string, string | undefined>;

export type ComfyBootstrapStatus =
  | "already_running"
  | "skipped_autostart_disabled"
  | "missing_start_command"
  | "started"
  | "startup_timeout"
  | "startup_failed";

export type ComfyBootstrapResult = {
  autoStart: boolean;
  comfyUrl: string;
  error?: string;
  healthEndpoint?: "system_stats" | "object_info";
  healthcheckIntervalMs: number;
  startCommandConfigured: boolean;
  startupTimeoutMs: number;
  status: ComfyBootstrapStatus;
  workdirConfigured: boolean;
};

export type ComfyBootstrapOptions = {
  env?: ComfyBootstrapEnv;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  spawnImpl?: SpawnLike;
};

const DEFAULT_COMFY_URL = "http://127.0.0.1:8188";
const DEFAULT_STARTUP_TIMEOUT_MS = 120_000;
const DEFAULT_HEALTHCHECK_INTERVAL_MS = 3_000;

function parseBoolean(value: string | undefined): boolean {
  return value?.toLowerCase() === "true";
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveConfig(env: ComfyBootstrapEnv) {
  const comfyUrl = (env.COMFY_API_URL || DEFAULT_COMFY_URL).replace(/\/+$/, "");

  return {
    autoStart: parseBoolean(env.COMFY_AUTO_START),
    comfyUrl,
    healthcheckIntervalMs: parsePositiveInteger(
      env.COMFY_HEALTHCHECK_INTERVAL_MS,
      DEFAULT_HEALTHCHECK_INTERVAL_MS,
    ),
    startCommand: env.COMFY_START_COMMAND?.trim() ?? "",
    startupTimeoutMs: parsePositiveInteger(env.COMFY_STARTUP_TIMEOUT_MS, DEFAULT_STARTUP_TIMEOUT_MS),
    workdir: env.COMFY_WORKDIR?.trim() ?? "",
  };
}

function baseResult(config: ReturnType<typeof resolveConfig>): Omit<ComfyBootstrapResult, "status"> {
  return {
    autoStart: config.autoStart,
    comfyUrl: config.comfyUrl,
    healthcheckIntervalMs: config.healthcheckIntervalMs,
    startCommandConfigured: config.startCommand.length > 0,
    startupTimeoutMs: config.startupTimeoutMs,
    workdirConfigured: config.workdir.length > 0,
  };
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function detectComfyStatus({
  env = process.env,
  fetchImpl = fetch,
}: Pick<ComfyBootstrapOptions, "env" | "fetchImpl"> = {}): Promise<
  | { endpoint: "system_stats" | "object_info"; online: true }
  | { error: string; online: false }
> {
  const { comfyUrl } = resolveConfig(env);

  try {
    const response = await fetchImpl(`${comfyUrl}/system_stats`);
    if (response.ok) {
      return { endpoint: "system_stats", online: true };
    }
  } catch {
    // Fall back to the provider-runtime Comfy health check below.
  }

  try {
    await new ComfyClient({ baseUrl: comfyUrl, fetchImpl }).checkAvailability();
    return { endpoint: "object_info", online: true };
  } catch (error) {
    return { error: sanitizeError(error), online: false };
  }
}

async function waitForComfyOnline({
  config,
  env,
  fetchImpl,
  sleep,
}: {
  config: ReturnType<typeof resolveConfig>;
  env: ComfyBootstrapEnv;
  fetchImpl: FetchLike;
  sleep: (ms: number) => Promise<void>;
}): Promise<ComfyBootstrapResult> {
  const startedAt = Date.now();
  let lastError = "ComfyUI did not become healthy before the startup timeout.";

  while (Date.now() - startedAt <= config.startupTimeoutMs) {
    const health = await detectComfyStatus({ env: { ...env, COMFY_API_URL: config.comfyUrl }, fetchImpl });

    if (health.online) {
      return {
        ...baseResult(config),
        healthEndpoint: health.endpoint,
        status: "started",
      };
    }

    lastError = health.error;
    await sleep(config.healthcheckIntervalMs);
  }

  return {
    ...baseResult(config),
    error: lastError,
    status: "startup_timeout",
  };
}

export async function bootstrapComfy({
  env = process.env,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  spawnImpl = spawn,
}: ComfyBootstrapOptions = {}): Promise<ComfyBootstrapResult> {
  const config = resolveConfig(env);
  const health = await detectComfyStatus({ env, fetchImpl });

  if (health.online) {
    return {
      ...baseResult(config),
      healthEndpoint: health.endpoint,
      status: "already_running",
    };
  }

  if (!config.autoStart) {
    return {
      ...baseResult(config),
      error: health.error,
      status: "skipped_autostart_disabled",
    };
  }

  if (!config.startCommand) {
    return {
      ...baseResult(config),
      error: "COMFY_START_COMMAND is required when COMFY_AUTO_START=true.",
      status: "missing_start_command",
    };
  }

  let child: ChildProcess;

  try {
    child = spawnImpl(config.startCommand, {
      cwd: config.workdir || undefined,
      detached: true,
      env: { ...process.env, ...env },
      shell: true,
      stdio: "ignore",
    });
    child.unref();
  } catch (error) {
    return {
      ...baseResult(config),
      error: sanitizeError(error),
      status: "startup_failed",
    };
  }

  return waitForComfyOnline({ config, env, fetchImpl, sleep });
}
