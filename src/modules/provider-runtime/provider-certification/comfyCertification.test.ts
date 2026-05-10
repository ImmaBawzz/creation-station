import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderJobRequest } from "@/modules/provider-runtime/types";

const workflowErrors: string[] = [];
let workflowValid = true;
let fetchAvailable = false;

vi.mock("@/modules/comfy/workflows", () => ({
  listSupportedComfyWorkflowTypes: () => ["flux-fast-concept"],
  prepareComfyWorkflowPrompt: vi.fn(async () => ({
    outputPrefix: "dry-run-output",
    promptPayload: { "1": { class_type: "TestNode", inputs: {} } },
  })),
  validateComfyWorkflow: vi.fn(async () => ({
    errors: workflowErrors,
    modelValidationStatus: workflowValid ? "valid" : "invalid",
    valid: workflowValid,
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
});
