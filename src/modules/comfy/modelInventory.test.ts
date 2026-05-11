import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { buildComfyModelInventory } from "@/modules/comfy/modelInventory";

const tempRoots: string[] = [];

async function createInventoryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "creation-station-comfy-models-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "unet"), { recursive: true });
  await mkdir(path.join(root, "diffusion_models"), { recursive: true });
  await mkdir(path.join(root, "clip"), { recursive: true });
  await mkdir(path.join(root, "vae"), { recursive: true });
  return root;
}

afterAll(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { force: true, recursive: true })));
});

describe("comfy model inventory", () => {
  it("scans configured roots and supported extensions", async () => {
    const root = await createInventoryRoot();
    await writeFile(path.join(root, "unet", "flux1-dev-fp8.safetensors"), "x");
    await writeFile(path.join(root, "diffusion_models", "flux1-dev-Q8.gguf"), "x");
    await writeFile(path.join(root, "clip", "clip-l.safetensors"), "x");
    await writeFile(path.join(root, "vae", "ae.safetensors"), "x");
    await writeFile(path.join(root, "vae", "ignore.txt"), "x");

    const inventory = await buildComfyModelInventory({ modelRoot: root });

    expect(inventory.unet).toContain("flux1-dev-fp8.safetensors");
    expect(inventory.unet).toContain("flux1-dev-Q8.gguf");
    expect(inventory.clip).toContain("clip-l.safetensors");
    expect(inventory.vae).toContain("ae.safetensors");
    expect(inventory.vae).not.toContain("ignore.txt");
  });
});