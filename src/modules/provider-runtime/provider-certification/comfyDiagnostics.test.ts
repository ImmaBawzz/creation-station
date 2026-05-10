import { readFile, rm } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  classifyTimeoutPhase,
  COMFY_CERTIFICATION_DIAGNOSTICS_PATH,
  collectOutputDiagnostics,
  createInitialComfyDiagnostics,
  writeComfyCertificationDiagnostics,
} from "./comfyDiagnostics";

describe("Comfy certification diagnostics", () => {
  afterEach(async () => {
    await rm(COMFY_CERTIFICATION_DIAGNOSTICS_PATH, { force: true });
  });

  it("classifies timeout before prompt_id", () => {
    expect(classifyTimeoutPhase({
      historyAppeared: false,
      historyCompleted: false,
      outputFilesDetected: false,
      queueState: "unknown",
    })).toBe("before_queue");
  });

  it("classifies timeout while queued", () => {
    expect(classifyTimeoutPhase({
      historyAppeared: false,
      historyCompleted: false,
      outputFilesDetected: false,
      promptId: "prompt-1",
      queueState: "pending",
    })).toBe("queued");
  });

  it("classifies timeout while running", () => {
    expect(classifyTimeoutPhase({
      historyAppeared: true,
      historyCompleted: false,
      outputFilesDetected: false,
      promptId: "prompt-1",
      queueState: "running",
    })).toBe("running");
  });

  it("classifies completed history with no outputs", () => {
    expect(classifyTimeoutPhase({
      historyAppeared: true,
      historyCompleted: true,
      outputFilesDetected: false,
      promptId: "prompt-1",
      queueState: "absent",
    })).toBe("history_no_outputs");
  });

  it("classifies completed outputs missing from disk", () => {
    expect(classifyTimeoutPhase({
      historyAppeared: true,
      historyCompleted: true,
      outputFilesDetected: true,
      outputFilesExist: false,
      promptId: "prompt-1",
      queueState: "absent",
    })).toBe("outputs_not_found");
  });

  it("reports execution errors separately from concrete timeout phases", () => {
    expect(classifyTimeoutPhase({
      executionError: "Comfy history status_str is error.",
      historyAppeared: true,
      historyCompleted: false,
      outputFilesDetected: false,
      promptId: "prompt-1",
      queueState: "absent",
    })).toBe("unknown_timeout");
  });

  it("detects history outputs but marks files missing when an output directory is configured", async () => {
    const diagnostics = await collectOutputDiagnostics({
      expectedOutputDirectory: "C:/definitely/missing/comfy/output",
      historyRecord: {
        outputs: {
          "9": {
            images: [{ filename: "missing.png", subfolder: "", type: "output" }],
          },
        },
      },
    });

    expect(diagnostics.outputFilesDetected).toBe(true);
    expect(diagnostics.filesExist).toBe(false);
    expect(diagnostics.outputFilenames).toEqual(["missing.png"]);
  });

  it("writes diagnostics only to the ignored .debug path", async () => {
    const diagnostics = createInitialComfyDiagnostics({
      comfyUrl: "http://127.0.0.1:8188",
      workflowId: "flux-fast-concept",
      workflowType: "flux-fast-concept",
    });

    const writtenPath = await writeComfyCertificationDiagnostics(diagnostics);
    const source = await readFile(writtenPath, "utf8");

    expect(writtenPath.replaceAll("\\", "/")).toContain("/.debug/comfy-certification-diagnostics.json");
    expect(JSON.parse(source)).toMatchObject({
      comfyUrl: "http://127.0.0.1:8188",
      submittedWorkflowId: "flux-fast-concept",
    });
  });

  it("does not mutate WAN, Kling, or Runway environment values", async () => {
    const snapshot = {
      PROVIDER_RUNTIME_ENABLE_KLING: process.env.PROVIDER_RUNTIME_ENABLE_KLING,
      PROVIDER_RUNTIME_ENABLE_RUNWAY: process.env.PROVIDER_RUNTIME_ENABLE_RUNWAY,
      PROVIDER_RUNTIME_ENABLE_WAN: process.env.PROVIDER_RUNTIME_ENABLE_WAN,
    };

    await writeComfyCertificationDiagnostics(createInitialComfyDiagnostics({
      comfyUrl: "http://127.0.0.1:8188",
      workflowId: "flux-fast-concept",
      workflowType: "flux-fast-concept",
    }));

    expect(process.env.PROVIDER_RUNTIME_ENABLE_WAN).toBe(snapshot.PROVIDER_RUNTIME_ENABLE_WAN);
    expect(process.env.PROVIDER_RUNTIME_ENABLE_KLING).toBe(snapshot.PROVIDER_RUNTIME_ENABLE_KLING);
    expect(process.env.PROVIDER_RUNTIME_ENABLE_RUNWAY).toBe(snapshot.PROVIDER_RUNTIME_ENABLE_RUNWAY);
  });
});
