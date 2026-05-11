import { readdir } from "node:fs/promises";
import path from "node:path";

export type ComfyModelFamily = "clip" | "unet" | "vae";

export type ComfyModelInventoryOptions = {
  clipDir?: string;
  modelRoot?: string;
  unetDir?: string;
  vaeDir?: string;
};

export type ComfyModelInventory = {
  clip: string[];
  roots: Record<ComfyModelFamily, string[]>;
  unet: string[];
  vae: string[];
};

const SUPPORTED_MODEL_EXTENSIONS = new Set([".safetensors", ".gguf", ".ckpt", ".pt", ".bin"]);

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isSupportedModelFile(fileName: string): boolean {
  return SUPPORTED_MODEL_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function resolveModelDirectories(options: ComfyModelInventoryOptions = {}): Record<ComfyModelFamily, string[]> {
  const modelRoot = options.modelRoot ?? process.env.COMFY_MODEL_ROOT ?? path.join(process.cwd(), "models");

  return {
    clip: unique([
      options.clipDir,
      process.env.COMFY_CLIP_DIR,
      path.join(modelRoot, "clip"),
    ].filter((value): value is string => Boolean(value))),
    unet: unique([
      options.unetDir,
      process.env.COMFY_UNET_DIR,
      path.join(modelRoot, "unet"),
      path.join(modelRoot, "diffusion_models"),
    ].filter((value): value is string => Boolean(value))),
    vae: unique([
      options.vaeDir,
      process.env.COMFY_VAE_DIR,
      path.join(modelRoot, "vae"),
    ].filter((value): value is string => Boolean(value))),
  };
}

async function readInventoryDirectory(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && isSupportedModelFile(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

export async function buildComfyModelInventory(
  options: ComfyModelInventoryOptions = {},
): Promise<ComfyModelInventory> {
  const roots = resolveModelDirectories(options);
  const [clip, unet, vae] = await Promise.all([
    Promise.all(roots.clip.map(readInventoryDirectory)),
    Promise.all(roots.unet.map(readInventoryDirectory)),
    Promise.all(roots.vae.map(readInventoryDirectory)),
  ]);

  return {
    clip: unique(clip.flat()),
    roots,
    unet: unique(unet.flat()),
    vae: unique(vae.flat()),
  };
}