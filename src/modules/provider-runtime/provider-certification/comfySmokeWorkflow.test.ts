import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { buildComfyProviderSmokeWorkflow } from "./comfySmokeWorkflow";

const tempRoots: string[] = [];

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "creation-station-comfy-smoke-"));
  tempRoots.push(root);
  return root;
}

afterAll(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { force: true, recursive: true })));
});

describe("Comfy provider smoke workflow", () => {
  it("selects checkpoint path when a checkpoint exists", async () => {
    const root = await createTempRoot();
    await mkdir(path.join(root, "checkpoints"), { recursive: true });
    await writeFile(path.join(root, "checkpoints", "tiny.ckpt"), "x");

    const result = await buildComfyProviderSmokeWorkflow({
      inventory: {
        clip: [],
        roots: { clip: [], unet: [], vae: [] },
        unet: [],
        vae: [],
      },
      modelRoot: root,
    });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.strategy).toBe("checkpoint");
      expect(result.promptPayload["1"]).toMatchObject({
        class_type: "CheckpointLoaderSimple",
        inputs: { ckpt_name: "tiny.ckpt" },
      });
    }
  });

  it("selects FLUX fallback when checkpoint is missing but FLUX dependencies exist", async () => {
    const root = await createTempRoot();
    const result = await buildComfyProviderSmokeWorkflow({
      inventory: {
        clip: ["clip_l.safetensors", "t5xxl_fp16.safetensors"],
        roots: { clip: [], unet: [], vae: [] },
        unet: ["flux1-schnell.safetensors"],
        vae: ["ae.safetensors"],
      },
      modelRoot: root,
    });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.strategy).toBe("flux");
      expect(result.promptPayload["1"]).toMatchObject({
        class_type: "UNETLoader",
        inputs: { unet_name: "flux1-schnell.safetensors" },
      });
    }
  });

  it("returns model_missing when no dependencies exist", async () => {
    const root = await createTempRoot();
    const result = await buildComfyProviderSmokeWorkflow({
      inventory: {
        clip: [],
        roots: { clip: [], unet: [], vae: [] },
        unet: [],
        vae: [],
      },
      modelRoot: root,
    });

    expect(result).toEqual({
      reason: "comfy_smoke_model_missing",
      status: "model_missing",
      workflowType: "comfy-provider-smoke",
    });
  });
});
