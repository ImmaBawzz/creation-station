import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  readComfyWorkflowState,
  validateComfyWorkflow,
  writeComfyWorkflowState,
} from "@/modules/comfy/workflows";

const tempRoots: string[] = [];

async function createModelRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "creation-station-comfy-validation-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "unet"), { recursive: true });
  await mkdir(path.join(root, "clip"), { recursive: true });
  await mkdir(path.join(root, "vae"), { recursive: true });
  return root;
}

afterAll(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { force: true, recursive: true })));
});

describe("comfy workflows", () => {
  it("validates the fast concept workflow graph", async () => {
    const result = await validateComfyWorkflow("flux-fast-concept", { verifyModelFiles: false });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.nodeMapping.positivePromptNodeId).toBe("4");
    expect(result.modelFiles).toContain("flux1-schnell.safetensors");
  });

  it("validates the cinematic workflow graph", async () => {
    const result = await validateComfyWorkflow("flux-dev-cinematic", { verifyModelFiles: false });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.nodeMapping.saveImageNodeId).toBe("10");
    expect(result.modelFiles).toContain("flux1-dev.safetensors");
  });

  it("reports the exact missing model filenames when the local model files are unavailable", async () => {
    const result = await validateComfyWorkflow("flux-dev-cinematic", {
      inventoryOptions: {
        modelRoot: path.join(process.cwd(), ".missing-comfy-models"),
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing model file: flux1-dev.safetensors");
    expect(result.errors).toContain("Missing model file: clip_l.safetensors");
    expect(result.errors).toContain("Missing model file: t5xxl_fp16.safetensors");
    expect(result.errors).toContain("Missing model file: ae.safetensors");
  });

  it("enables the cinematic workflow when production aliases exist", async () => {
    const root = await createModelRoot();
    await writeFile(path.join(root, "unet", "flux1-dev-fp8.safetensors"), "x");
    await writeFile(path.join(root, "clip", "clip-l.safetensors"), "x");
    await writeFile(path.join(root, "clip", "t5xxl_fp16.safetensors"), "x");
    await writeFile(path.join(root, "vae", "ae.safetensors"), "x");

    const result = await validateComfyWorkflow("flux-dev-cinematic", {
      inventoryOptions: { modelRoot: root },
    });

    expect(result.valid).toBe(true);
    expect(result.modelValidationStatus).toBe("validWithAlias");
    expect(result.models.resolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requiredName: "flux1-dev.safetensors", resolvedName: "flux1-dev-fp8.safetensors" }),
        expect.objectContaining({ requiredName: "clip_l.safetensors", resolvedName: "clip-l.safetensors" }),
      ]),
    );
  });

  it("keeps the cinematic workflow disabled when only gguf production aliases exist", async () => {
    const root = await createModelRoot();
    await writeFile(path.join(root, "unet", "flux1-dev-Q8.gguf"), "x");
    await writeFile(path.join(root, "clip", "clip_l.safetensors"), "x");
    await writeFile(path.join(root, "clip", "t5xxl_fp16.safetensors"), "x");
    await writeFile(path.join(root, "vae", "ae.safetensors"), "x");

    const result = await validateComfyWorkflow("flux-dev-cinematic", {
      inventoryOptions: { modelRoot: root },
    });

    expect(result.valid).toBe(false);
    expect(result.models.warnings).toContain("GGUF model found but current workflow uses UNETLoader; GGUF loader support required.");
  });

  it("keeps fast concept selectable", async () => {
    const result = await validateComfyWorkflow("flux-fast-concept");

    expect(result.valid).toBe(true);
    expect(result.modelValidationStatus).toBe("valid");
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