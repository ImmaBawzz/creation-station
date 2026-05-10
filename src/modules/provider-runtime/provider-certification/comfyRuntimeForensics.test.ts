import { describe, expect, it } from "vitest";

import {
  classifyComfyRuntimeTimeout,
  COMFY_RUNTIME_FORENSICS_PATH,
} from "./comfyRuntimeForensics";

describe("Comfy runtime forensics", () => {
  it("classifies running_no_history", () => {
    expect(classifyComfyRuntimeTimeout({
      historyAppeared: false,
      outputFilesDetected: false,
      promptId: "prompt-1",
      queuePendingContainsPrompt: false,
      queueRunningContainsPrompt: true,
    })).toBe("running_no_history");
  });

  it("classifies history_no_outputs", () => {
    expect(classifyComfyRuntimeTimeout({
      historyAppeared: true,
      outputFilesDetected: false,
      promptId: "prompt-1",
      queuePendingContainsPrompt: false,
      queueRunningContainsPrompt: false,
    })).toBe("history_no_outputs");
  });

  it("classifies outputs_not_found", () => {
    expect(classifyComfyRuntimeTimeout({
      historyAppeared: true,
      outputFilesDetected: true,
      outputFilesExist: false,
      promptId: "prompt-1",
      queuePendingContainsPrompt: false,
      queueRunningContainsPrompt: false,
    })).toBe("outputs_not_found");
  });

  it("writes forensics to ignored debug location", () => {
    expect(COMFY_RUNTIME_FORENSICS_PATH.replaceAll("\\", "/")).toContain("/.debug/comfy-runtime-forensics.json");
  });
});
