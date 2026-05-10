import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComfyBootstrapResult } from "./comfyBootstrap";
import type { ProviderJobRequest } from "@/modules/provider-runtime/types";

const workflowErrors: string[] = [];
let workflowValid = true;
let fetchAvailable = false;
const envSnapshot = { ...process.env };

vi.mock("@/modules/comfy/workflows", () => ({
  listSupportedComfyWorkflowTypes: () => ["flux-fast-concept"],
  prepareComfyWorkflowPrompt: vi.fn(async () => ({
    entry: {
      filenamePrefix: "[projectId]-concept",
      label: "Fast Concept",
      modelRole: "concept",
      negativePromptNodeId: "36",
      positivePromptNodeId: "4",
      requiredNodeTypes: ["SaveImage"],
      samplerNodeId: "7",
      saveImageNodeId: "9",
      smokeHeight: 512,
      smokeSteps: 6,
      smokeWidth: 512,
      widthHeightNodeId: "6",
      workflowPath: "src/modules/comfy/workflows/flux-fast-concept.json",
    },
    outputPrefix: "dry-run-output",
    promptPayload: {
      "4": {
        class_type: "CLIPTextEncodeFlux",
        inputs: { clip_l: "simple cinematic test frame, soft light, abstract geometric object, no text" },
      },
      "6": { class_type: "EmptySD3LatentImage", inputs: { height: 512, width: 512 } },
      "7": { class_type: "KSampler", inputs: { seed: 12345, steps: 6 } },
      "9": { class_type: "SaveImage", inputs: { filename_prefix: "dry-run-output" } },
    },
  })),
  validateComfyWorkflow: vi.fn(async () => ({
    errors: workflowErrors,
    modelFiles: ["flux1-schnell.safetensors", "clip_l.safetensors", "t5xxl_fp16.safetensors", "ae.safetensors"],
    modelValidationStatus: workflowValid ? "valid" : "invalid",
    models: {
      missing: workflowValid ? [] : workflowErrors,
      required: ["flux1-schnell.safetensors", "clip_l.safetensors", "t5xxl_fp16.safetensors", "ae.safetensors"],
      resolved: [],
      warnings: [],
    },
    nodeMapping: {
      negativePromptNodeId: "36",
      positivePromptNodeId: "4",
      saveImageNodeId: "9",
      widthHeightNodeId: "6",
    },
    valid: workflowValid,
    warnings: [],
    workflowType: "flux-fast-concept",
  })),
}));

vi.mock("@/modules/comfy/client", () => {
  class ComfyError extends Error {
    code: string;
    statusCode: number;

    constructor(message: string, options?: { code?: string; statusCode?: number }) {
      super(message);
      this.name = "ComfyError";
      this.code = options?.code ?? "COMFY_ERROR";
      this.statusCode = options?.statusCode ?? 500;
    }
  }

  class ComfyClient {
    async checkAvailability() {
      if (!fetchAvailable) {
        throw new ComfyError("offline", { code: "COMFY_OFFLINE", statusCode: 503 });
      }
    }

    async retrieveOutputs() {
      return [{ filename: "out.png", subfolder: "", type: "output", url: "http://127.0.0.1:8188/view?filename=out.png" }];
    }

    async submitPrompt() {
      return { promptId: "prompt-1" };
    }

    async waitForCompletion() {}
  }

  return { ComfyClient, ComfyError };
});

describe("Comfy provider certification", () => {
  beforeEach(() => {
    fetchAvailable = false;
    workflowErrors.length = 0;
    workflowValid = true;
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
    vi.restoreAllMocks();
  });

  it("produces skipped_offline when Comfy is offline", async () => {
    const { runComfyCertification } = await import("./comfyCertification");
    const report = await runComfyCertification();

    expect(report.finalStatus).toBe("skipped_offline");
    expect(report.certified).toBe(false);
    expect(report.phases.some((phase) => phase.details?.reason === "comfy_offline")).toBe(true);
  });

  it("inspects Comfy payload without submitting real jobs", async () => {
    fetchAvailable = true;
    const { runComfyCertification } = await import("./comfyCertification");
    const report = await runComfyCertification({ executeIfOnline: false });

    expect(report.finalStatus).toBe("certified");
    expect(report.phases.find((phase) => phase.name === "Payload inspection")?.details?.mappedPayload).toMatchObject({
      negativePrompt: "text, watermark, logo, blurry, corrupted",
      positivePrompt: "simple cinematic test frame, soft light, abstract geometric object, no text",
      samplerSeed: 12345,
      workflowId: "flux-fast-concept",
    });
    expect(report.phases.find((phase) => phase.name === "Certification execution")?.status).toBe("skipped");
  });

  it("missing workflow fails safely", async () => {
    fetchAvailable = true;
    const { COMFY_CERTIFICATION_PAYLOAD, runComfyCertification } = await import("./comfyCertification");
    const payload: ProviderJobRequest = {
      ...COMFY_CERTIFICATION_PAYLOAD,
      workflowId: "missing-workflow",
    };

    const report = await runComfyCertification({ executeIfOnline: false, payload });

    expect(report.finalStatus).toBe("failed");
    expect(report.phases.find((phase) => phase.name === "Workflow validation")?.error).toBe("comfy_workflow_missing");
  });

  it("missing model fails safely", async () => {
    fetchAvailable = true;
    workflowValid = false;
    workflowErrors.push("Missing model file: flux1-schnell.safetensors");
    const { runComfyCertification } = await import("./comfyCertification");

    const report = await runComfyCertification({ executeIfOnline: false });

    expect(report.finalStatus).toBe("failed");
    expect(report.phases.find((phase) => phase.name === "Workflow validation")?.error).toBe("comfy_model_missing");
  });

  it("successful mock-equivalent Comfy certification marks certified only in report", async () => {
    fetchAvailable = true;
    const { runComfyCertification } = await import("./comfyCertification");

    const report = await runComfyCertification({ executeIfOnline: false });

    expect(report.certified).toBe(true);
    expect(process.env.PROVIDER_RUNTIME_ENABLE_WAN).not.toBe("true");
    expect(process.env.PROVIDER_RUNTIME_ENABLE_KLING).not.toBe("true");
    expect(process.env.PROVIDER_RUNTIME_ENABLE_RUNWAY).not.toBe("true");
  });

  it("maps missing bootstrap command to bootstrap_config_missing", async () => {
    const bootstrapResult: ComfyBootstrapResult = {
      autoStart: true,
      comfyUrl: "http://127.0.0.1:8188",
      error: "COMFY_START_COMMAND is required when COMFY_AUTO_START=true.",
      healthcheckIntervalMs: 3000,
      startCommandConfigured: false,
      startupTimeoutMs: 120000,
      status: "missing_start_command",
      workdirConfigured: false,
    };
    const { runComfyCertification } = await import("./comfyCertification");

    const report = await runComfyCertification({ bootstrap: async () => bootstrapResult });

    expect(report.finalStatus).toBe("bootstrap_config_missing");
    expect(report.bootstrapResult?.status).toBe("missing_start_command");
  });

  it("maps bootstrap timeout to comfy_startup_timeout", async () => {
    const bootstrapResult: ComfyBootstrapResult = {
      autoStart: true,
      comfyUrl: "http://127.0.0.1:8188",
      error: "ComfyUI did not become healthy before the startup timeout.",
      healthcheckIntervalMs: 1,
      startCommandConfigured: true,
      startupTimeoutMs: 1,
      status: "startup_timeout",
      workdirConfigured: false,
    };
    const { runComfyCertification } = await import("./comfyCertification");

    const report = await runComfyCertification({ bootstrap: async () => bootstrapResult });

    expect(report.finalStatus).toBe("comfy_startup_timeout");
    expect(report.phases.find((phase) => phase.name === "Comfy bootstrap")?.error).toBe("comfy_startup_timeout");
  });
});
