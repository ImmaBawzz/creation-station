import { describe, expect, it, vi } from "vitest";

import { bootstrapComfy, detectComfyStatus } from "./comfyBootstrap";

function jsonResponse(ok: boolean): Response {
  return {
    ok,
    json: vi.fn(async () => ({})),
  } as unknown as Response;
}

describe("Comfy bootstrap", () => {
  it("returns already_running when Comfy is online", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(true)) as unknown as typeof fetch;

    const result = await bootstrapComfy({
      env: { COMFY_API_URL: "http://127.0.0.1:8188" },
      fetchImpl,
    });

    expect(result.status).toBe("already_running");
    expect(result.healthEndpoint).toBe("system_stats");
  });

  it("returns skipped_autostart_disabled when offline and autostart is false", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    const result = await bootstrapComfy({
      env: {
        COMFY_API_URL: "http://127.0.0.1:8188",
        COMFY_AUTO_START: "false",
      },
      fetchImpl,
    });

    expect(result.status).toBe("skipped_autostart_disabled");
    expect(result.autoStart).toBe(false);
  });

  it("returns missing_start_command when autostart is true without a command", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const spawnImpl = vi.fn();

    const result = await bootstrapComfy({
      env: {
        COMFY_API_URL: "http://127.0.0.1:8188",
        COMFY_AUTO_START: "true",
      },
      fetchImpl,
      spawnImpl: spawnImpl as never,
    });

    expect(result.status).toBe("missing_start_command");
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("returns startup_timeout when spawned Comfy never becomes healthy", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const spawnImpl = vi.fn(() => ({ unref: vi.fn() }));

    const result = await bootstrapComfy({
      env: {
        COMFY_API_URL: "http://127.0.0.1:8188",
        COMFY_AUTO_START: "true",
        COMFY_HEALTHCHECK_INTERVAL_MS: "1",
        COMFY_START_COMMAND: "start-comfy",
        COMFY_STARTUP_TIMEOUT_MS: "1",
      },
      fetchImpl,
      sleep: vi.fn(async () => undefined),
      spawnImpl: spawnImpl as never,
    });

    expect(result.status).toBe("startup_timeout");
    expect(spawnImpl).toHaveBeenCalledTimes(1);
  });

  it("returns started after a mocked startup becomes healthy", async () => {
    let attempts = 0;
    const fetchImpl = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("offline");
      }

      return jsonResponse(true);
    }) as unknown as typeof fetch;
    const spawnImpl = vi.fn(() => ({ unref: vi.fn() }));

    const result = await bootstrapComfy({
      env: {
        COMFY_API_URL: "http://127.0.0.1:8188",
        COMFY_AUTO_START: "true",
        COMFY_HEALTHCHECK_INTERVAL_MS: "1",
        COMFY_START_COMMAND: "start-comfy",
        COMFY_STARTUP_TIMEOUT_MS: "100",
      },
      fetchImpl,
      sleep: vi.fn(async () => undefined),
      spawnImpl: spawnImpl as never,
    });

    expect(result.status).toBe("started");
    expect(spawnImpl).toHaveBeenCalledTimes(1);
  });

  it("never touches WAN, Kling, or Runway env values", async () => {
    const env = {
      COMFY_API_URL: "http://127.0.0.1:8188",
      COMFY_AUTO_START: "false",
      KLING_API_KEY: "kling",
      PROVIDER_RUNTIME_ENABLE_KLING: "false",
      PROVIDER_RUNTIME_ENABLE_RUNWAY: "false",
      PROVIDER_RUNTIME_ENABLE_WAN: "false",
      RUNWAY_API_KEY: "runway",
      WAN_API_KEY: "wan",
    };
    const snapshot = { ...env };
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    await bootstrapComfy({ env, fetchImpl });

    expect(env).toEqual(snapshot);
  });

  it("does not spawn unless COMFY_AUTO_START is true", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const spawnImpl = vi.fn();

    await bootstrapComfy({
      env: {
        COMFY_API_URL: "http://127.0.0.1:8188",
        COMFY_AUTO_START: "false",
        COMFY_START_COMMAND: "start-comfy",
      },
      fetchImpl,
      spawnImpl: spawnImpl as never,
    });

    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("can detect status through the provider-runtime health check fallback", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/system_stats")) {
        return jsonResponse(false);
      }

      if (url.endsWith("/object_info")) {
        return jsonResponse(true);
      }

      throw new Error(`unexpected url: ${url}`);
    }) as unknown as typeof fetch;

    const result = await detectComfyStatus({
      env: { COMFY_API_URL: "http://127.0.0.1:8188" },
      fetchImpl,
    });

    expect(result).toEqual({ endpoint: "object_info", online: true });
  });
});
