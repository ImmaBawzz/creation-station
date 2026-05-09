import { describe, expect, it } from "vitest";

import {
  readComfyWorkflowState,
  validateComfyWorkflow,
  writeComfyWorkflowState,
} from "@/modules/comfy/workflows";

describe("comfy workflows", () => {
  it("validates the fast concept workflow graph", async () => {
    const result = await validateComfyWorkflow("flux-fast-concept");

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.nodeMapping.positivePromptNodeId).toBe("4");
    expect(result.modelFiles).toContain("flux1-schnell.safetensors");
  });

  it("validates the cinematic workflow graph", async () => {
    const result = await validateComfyWorkflow("flux-dev-cinematic");

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.nodeMapping.saveImageNodeId).toBe("10");
    expect(result.modelFiles).toContain("flux1-dev.safetensors");
  });

  it("persists workflow state for later UI reads", async () => {
    const written = await writeComfyWorkflowState({
      available: true,
      errors: [],
      modelFiles: ["flux1-dev.safetensors"],
      nodeMapping: { saveImageNodeId: "10" },
      selectable: true,
      status: "Validated",
      valid: true,
      warnings: [],
      workflowType: "flux-dev-cinematic",
    });
    const readBack = await readComfyWorkflowState("flux-dev-cinematic");

    expect(readBack.status).toBe("Validated");
    expect(readBack.selectable).toBe(true);
    expect(readBack.modelFiles).toEqual(written.modelFiles);
  });
});