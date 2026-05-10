import { readdir } from "node:fs/promises";
import path from "node:path";

import { buildComfyModelInventory, type ComfyModelInventory } from "@/modules/comfy/modelInventory";

const MODEL_EXTENSIONS = new Set([".safetensors", ".ckpt", ".pt", ".bin"]);

export type ComfySmokeWorkflowResult =
  | {
      modelFilename: string;
      promptPayload: Record<string, unknown>;
      status: "ready";
      strategy: "checkpoint";
      workflowType: "comfy-provider-smoke";
    }
  | {
      modelFilenames: string[];
      promptPayload: Record<string, unknown>;
      status: "ready";
      strategy: "flux";
      workflowType: "comfy-provider-smoke";
    }
  | {
      reason: "comfy_smoke_model_missing";
      status: "model_missing";
      workflowType: "comfy-provider-smoke";
    };

export type ComfySmokeWorkflowOptions = {
  inventory?: ComfyModelInventory;
  modelRoot?: string;
  systemStats?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function getComfyBaseDirectory(systemStats: unknown): string | undefined {
  const argv = asRecord(asRecord(systemStats)?.system)?.argv;
  if (!Array.isArray(argv)) {
    return undefined;
  }

  const index = argv.findIndex((value) => value === "--base-directory");
  const candidate = index >= 0 ? argv[index + 1] : undefined;
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

async function listModelFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && MODEL_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function listCheckpointModels({
  modelRoot,
  systemStats,
}: ComfySmokeWorkflowOptions): Promise<string[]> {
  const roots = unique([
    process.env.COMFY_CHECKPOINT_DIR,
    modelRoot ? path.join(modelRoot, "checkpoints") : undefined,
    process.env.COMFY_MODEL_ROOT ? path.join(process.env.COMFY_MODEL_ROOT, "checkpoints") : undefined,
    getComfyBaseDirectory(systemStats) ? path.join(getComfyBaseDirectory(systemStats) as string, "models", "checkpoints") : undefined,
    path.join(process.cwd(), "models", "checkpoints"),
  ].filter((value): value is string => Boolean(value)));

  const files = await Promise.all(roots.map(listModelFiles));
  return unique(files.flat());
}

function checkpointPromptPayload({
  checkpoint,
  filenamePrefix,
  negativePrompt,
  prompt,
}: {
  checkpoint: string;
  filenamePrefix: string;
  negativePrompt: string;
  prompt: string;
}): Record<string, unknown> {
  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: checkpoint },
    },
    "2": {
      class_type: "CLIPTextEncode",
      inputs: { clip: ["1", 1], text: prompt },
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: { clip: ["1", 1], text: negativePrompt },
    },
    "4": {
      class_type: "EmptyLatentImage",
      inputs: { batch_size: 1, height: 256, width: 256 },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        cfg: 1,
        denoise: 1,
        latent_image: ["4", 0],
        model: ["1", 0],
        negative: ["3", 0],
        positive: ["2", 0],
        sampler_name: "euler",
        scheduler: "normal",
        seed: 12345,
        steps: 1,
      },
    },
    "6": {
      class_type: "VAEDecode",
      inputs: { samples: ["5", 0], vae: ["1", 2] },
    },
    "7": {
      class_type: "SaveImage",
      inputs: { filename_prefix: filenamePrefix, images: ["6", 0] },
    },
  };
}

function fluxPromptPayload({
  filenamePrefix,
  inventory,
  negativePrompt,
  prompt,
}: {
  filenamePrefix: string;
  inventory: ComfyModelInventory;
  negativePrompt: string;
  prompt: string;
}): Record<string, unknown> {
  return {
    "1": {
      class_type: "UNETLoader",
      inputs: { unet_name: inventory.unet[0], weight_dtype: "default" },
    },
    "2": {
      class_type: "DualCLIPLoader",
      inputs: { clip_name1: inventory.clip[0], clip_name2: inventory.clip[1], device: "default", type: "flux" },
    },
    "3": {
      class_type: "VAELoader",
      inputs: { vae_name: inventory.vae[0] },
    },
    "4": {
      class_type: "CLIPTextEncodeFlux",
      inputs: { clip: ["2", 0], clip_l: prompt, guidance: 2.5, t5xxl: "" },
    },
    "5": {
      class_type: "FluxGuidance",
      inputs: { conditioning: ["4", 0], guidance: 2.5 },
    },
    "6": {
      class_type: "EmptySD3LatentImage",
      inputs: { batch_size: 1, height: 512, width: 512 },
    },
    "7": {
      class_type: "CLIPTextEncodeFlux",
      inputs: { clip: ["2", 0], clip_l: negativePrompt, guidance: 2.5, t5xxl: "" },
    },
    "8": {
      class_type: "KSampler",
      inputs: {
        cfg: 1,
        denoise: 1,
        latent_image: ["6", 0],
        model: ["1", 0],
        negative: ["7", 0],
        positive: ["5", 0],
        sampler_name: "euler",
        scheduler: "simple",
        seed: 12345,
        steps: 4,
      },
    },
    "9": {
      class_type: "VAEDecode",
      inputs: { samples: ["8", 0], vae: ["3", 0] },
    },
    "10": {
      class_type: "SaveImage",
      inputs: { filename_prefix: filenamePrefix, images: ["9", 0] },
    },
  };
}

export async function buildComfyProviderSmokeWorkflow({
  inventory,
  modelRoot,
  systemStats,
}: ComfySmokeWorkflowOptions = {}): Promise<ComfySmokeWorkflowResult> {
  const prompt = "simple provider smoke test image";
  const negativePrompt = "text, watermark, corrupted";
  const filenamePrefix = `comfy-provider-smoke-${Date.now()}`;
  const checkpoints = await listCheckpointModels({ modelRoot, systemStats });

  if (checkpoints.length > 0) {
    const checkpoint = checkpoints[0];
    return {
      modelFilename: checkpoint,
      promptPayload: checkpointPromptPayload({ checkpoint, filenamePrefix, negativePrompt, prompt }),
      status: "ready",
      strategy: "checkpoint",
      workflowType: "comfy-provider-smoke",
    };
  }

  const resolvedInventory = inventory ?? await buildComfyModelInventory({ modelRoot });
  if (resolvedInventory.unet.length > 0 && resolvedInventory.clip.length >= 2 && resolvedInventory.vae.length > 0) {
    return {
      modelFilenames: [resolvedInventory.unet[0], resolvedInventory.clip[0], resolvedInventory.clip[1], resolvedInventory.vae[0]],
      promptPayload: fluxPromptPayload({
        filenamePrefix,
        inventory: resolvedInventory,
        negativePrompt,
        prompt,
      }),
      status: "ready",
      strategy: "flux",
      workflowType: "comfy-provider-smoke",
    };
  }

  return {
    reason: "comfy_smoke_model_missing",
    status: "model_missing",
    workflowType: "comfy-provider-smoke",
  };
}
