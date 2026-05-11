import { afterEach, describe, expect, it, vi } from "vitest";

import { buildComfyCertificationSummary, runComfySmokeCertification } from "./comfySmokeCertification";
import type { ComfyBootstrapResult } from "./comfyBootstrap";

const envSnapshot = { ...process.env };

vi.mock("@/modules/comfy/client", () => {
  class ComfyClient {
    async checkAvailability() {}
    async downloadOutput() {
      return Buffer.from("image");
    }
    async retrieveOutputs() {
      return [{ filename: "smoke.png", subfolder: "", type: "output", url: "http://127.0.0.1:8188/view?filename=smoke.png" }];
    }
    async submitPrompt() {
      return { promptId: "prompt-1" };
    }
  }

  return { ComfyClient };
});

vi.mock("./comfyDiagnostics", () => ({
  fetchComfyJson: vi.fn(async () => ({})),
}));

vi.mock("./comfyRuntimeForensics", () => ({
  collectComfyRuntimeForensics: vi.fn(async () => ({
    outputsAppearButNotImported: true,
    timeoutClassification: "unknown",
  })),
  writeComfyRuntimeForensics: vi.fn(async () => ".debug/comfy-runtime-forensics.json"),
}));

describe("Comfy smoke certification", () => {
  afterEach(() => {
    process.env = { ...envSnapshot };
    vi.restoreAllMocks();
  });

  it("does not enable WAN, Kling, or Runway", async () => {
    const bootstrapResult: ComfyBootstrapResult = {
      autoStart: false,
      comfyUrl: "http://127.0.0.1:8188",
      healthcheckIntervalMs: 3000,
      startCommandConfigured: false,
      startupTimeoutMs: 120000,
      status: "already_running",
      workdirConfigured: false,
    };

    const report = await runComfySmokeCertification({
      bootstrap: async () => bootstrapResult,
      smokeWorkflowBuilder: async () => ({
        modelFilename: "tiny.ckpt",
        promptPayload: { "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "tiny.ckpt" } } },
        status: "ready",
        strategy: "checkpoint",
        workflowType: "comfy-provider-smoke",
      }),
    });

    expect(report.smokeCertification.status).toBe("passed");
    expect(process.env.PROVIDER_RUNTIME_ENABLE_WAN).not.toBe("true");
    expect(process.env.PROVIDER_RUNTIME_ENABLE_KLING).not.toBe("true");
    expect(process.env.PROVIDER_RUNTIME_ENABLE_RUNWAY).not.toBe("true");
  });

  it("does not let production workflow timeout override smoke lifecycle pass", () => {
    const summary = buildComfyCertificationSummary({
      productionReason: "running_no_history",
      productionStatus: "timeout",
      smokeReason: "provider_lifecycle_certified",
      smokeStatus: "passed",
    });

    expect(summary.smokeCertification.status).toBe("passed");
    expect(summary.productionCertification).toEqual({
      reason: "running_no_history",
      status: "timeout",
      workflowType: "flux-fast-concept",
    });
  });

  it("separates smokeCertification from productionCertification in reports", async () => {
    const bootstrapResult: ComfyBootstrapResult = {
      autoStart: false,
      comfyUrl: "http://127.0.0.1:8188",
      healthcheckIntervalMs: 3000,
      startCommandConfigured: false,
      startupTimeoutMs: 120000,
      status: "already_running",
      workdirConfigured: false,
    };

    const report = await runComfySmokeCertification({
      bootstrap: async () => bootstrapResult,
      smokeWorkflowBuilder: async () => ({
        reason: "comfy_smoke_model_missing",
        status: "model_missing",
        workflowType: "comfy-provider-smoke",
      }),
    });

    expect(report.smokeCertification).toEqual({
      reason: "comfy_smoke_model_missing",
      status: "failed",
    });
    expect(report.productionCertification).toEqual({
      reason: "production_not_run_in_smoke_mode",
      status: "skipped",
      workflowType: "flux-fast-concept",
    });
  });
});
