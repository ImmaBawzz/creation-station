import { beforeEach, describe, expect, it, vi } from "vitest";

const validationState = {
  errors: [] as string[],
  valid: true,
};
const forensicsQueue: Array<{
  historyAppeared: boolean;
  outputsAppearButNotImported: boolean;
  promptIdRemainsRunning: boolean;
  queuePendingContainsPrompt: boolean;
  timeoutClassification: string;
}> = [];
let retrieveOutputsFails = false;

vi.mock("@/modules/comfy/workflows", () => ({
  prepareComfyWorkflowPrompt: vi.fn(async ({ smokeTest }: { smokeTest: boolean }) => ({
    promptPayload: {
      "1": { class_type: "UNETLoader", inputs: { unet_name: "flux1-schnell.safetensors" } },
      "2": { class_type: "DualCLIPLoader", inputs: { clip_name1: "clip_l.safetensors", clip_name2: "t5xxl_fp16.safetensors" } },
      "3": { class_type: "VAELoader", inputs: { vae_name: "ae.safetensors" } },
      "6": { class_type: "EmptySD3LatentImage", inputs: { batch_size: 1, height: smokeTest ? 512 : 1024, width: smokeTest ? 512 : 1024 } },
      "7": { class_type: "KSampler", inputs: { sampler_name: "euler", scheduler: "simple", seed: 12345, steps: smokeTest ? 6 : 20 } },
      "9": { class_type: "SaveImage", inputs: { filename_prefix: "test" } },
    },
  })),
  validateComfyWorkflow: vi.fn(async () => ({
    errors: validationState.errors,
    modelFiles: ["flux1-schnell.safetensors", "clip_l.safetensors", "t5xxl_fp16.safetensors", "ae.safetensors"],
    nodeMapping: {
      negativePromptNodeId: "36",
      positivePromptNodeId: "4",
      saveImageNodeId: "9",
      widthHeightNodeId: "6",
    },
    valid: validationState.valid,
    warnings: [],
    workflowType: "flux-fast-concept",
  })),
}));

vi.mock("./comfyRuntimeForensics", () => ({
  collectComfyRuntimeForensics: vi.fn(async () => {
    const next = forensicsQueue.shift();
    return {
      historyAppeared: next?.historyAppeared ?? false,
      outputsAppearButNotImported: next?.outputsAppearButNotImported ?? false,
      promptIdRemainsRunning: next?.promptIdRemainsRunning ?? false,
      queuePendingContainsPrompt: next?.queuePendingContainsPrompt ?? false,
      submittedModelFilenames: ["flux1-schnell.safetensors"],
      submittedWorkflowNodeIds: ["1", "2", "3", "6", "7", "9"],
      submittedWorkflowType: "flux-fast-concept",
      timeoutClassification: next?.timeoutClassification ?? "unknown",
    };
  }),
}));

describe("flux-fast-concept certification ladder", () => {
  beforeEach(() => {
    validationState.errors = [];
    validationState.valid = true;
    forensicsQueue.length = 0;
    retrieveOutputsFails = false;
  });

  function client() {
    return {
      downloadOutput: vi.fn(async () => Buffer.from("image")),
      retrieveOutputs: vi.fn(async () => {
        if (retrieveOutputsFails) {
          throw new Error("output import failed");
        }
        return [{ filename: "out.png", subfolder: "", type: "output", url: "http://127.0.0.1:8188/view?filename=out.png" }];
      }),
      submitPrompt: vi.fn(async () => ({ promptId: `prompt-${Math.random().toString(36).slice(2)}` })),
    };
  }

  it("marks minimal pass plus standard timeout as production_config_too_heavy", async () => {
    forensicsQueue.push(
      {
        historyAppeared: true,
        outputsAppearButNotImported: true,
        promptIdRemainsRunning: false,
        queuePendingContainsPrompt: false,
        timeoutClassification: "unknown",
      },
      {
        historyAppeared: false,
        outputsAppearButNotImported: false,
        promptIdRemainsRunning: true,
        queuePendingContainsPrompt: false,
        timeoutClassification: "running_no_history",
      },
    );
    const { runFluxFastConceptCertificationLadder } = await import("./fluxFastConceptCertification");

    const report = await runFluxFastConceptCertificationLadder({ client: client() });

    expect(report.minimalRun.passed).toBe(true);
    expect(report.standardRun.passed).toBe(false);
    expect(report.classification).toBe("production_config_too_heavy");
  });

  it("blocks execution when static validation fails", async () => {
    validationState.valid = false;
    validationState.errors = ["Missing SaveImage node: 9"];
    const { runFluxFastConceptCertificationLadder } = await import("./fluxFastConceptCertification");

    const report = await runFluxFastConceptCertificationLadder({ client: client() });

    expect(report.classification).toBe("static_validation_failed");
    expect(report.minimalRun.telemetry.queueState).toBe("not_run");
  });

  it("classifies output import failure separately from provider timeout", async () => {
    retrieveOutputsFails = true;
    forensicsQueue.push({
      historyAppeared: true,
      outputsAppearButNotImported: true,
      promptIdRemainsRunning: false,
      queuePendingContainsPrompt: false,
      timeoutClassification: "unknown",
    });
    const { runFluxFastConceptCertificationLadder } = await import("./fluxFastConceptCertification");

    const report = await runFluxFastConceptCertificationLadder({ client: client() });

    expect(report.classification).toBe("output_import_failure");
    expect(report.minimalRun.telemetry.artifactValidationState).toBe("failed");
  });

  it("keeps workflow runtime hang isolated to workflow certification", async () => {
    forensicsQueue.push({
      historyAppeared: false,
      outputsAppearButNotImported: false,
      promptIdRemainsRunning: true,
      queuePendingContainsPrompt: false,
      timeoutClassification: "running_no_history",
    });
    const { runFluxFastConceptCertificationLadder } = await import("./fluxFastConceptCertification");

    const report = await runFluxFastConceptCertificationLadder({ client: client() });

    expect(report.classification).toBe("workflow_runtime_hang");
    expect(report.standardRun.telemetry.queueState).toBe("not_run");
  });

  it("does not affect provider lifecycle certification state", async () => {
    forensicsQueue.push({
      historyAppeared: false,
      outputsAppearButNotImported: false,
      promptIdRemainsRunning: true,
      queuePendingContainsPrompt: false,
      timeoutClassification: "running_no_history",
    });
    const { getProviderWorkflowCertificationState } = await import("../workflowCertification");
    const { runFluxFastConceptCertificationLadder } = await import("./fluxFastConceptCertification");

    await runFluxFastConceptCertificationLadder({ client: client() });

    expect(getProviderWorkflowCertificationState("comfy").providerLifecycleStatus).toBe("lifecycle_certified");
  });
});
