import type { ComfyModelFamily } from "@/modules/comfy/modelInventory";

export type ComfyModelAliasResolution = {
  exactMatch: boolean;
  ggufBlocked: boolean;
  missing: boolean;
  requiredName: string;
  resolvedName?: string;
  warnings: string[];
};

type AliasRule = {
  aliases: string[];
  incompatibleCandidates?: string[];
};

const MODEL_ALIAS_RULES: Partial<Record<ComfyModelFamily, Record<string, AliasRule>>> = {
  clip: {
    "clip_l.safetensors": {
      aliases: ["clip_l.safetensors", "clip-l.safetensors"],
    },
    "t5xxl_fp16.safetensors": {
      aliases: ["t5xxl_fp16.safetensors", "t5xxl_fp8_e4m3fn.safetensors", "t5xxl_fp8.safetensors"],
    },
  },
  unet: {
    "flux1-dev.safetensors": {
      aliases: [
        "flux1-dev-fp8.safetensors",
        "flux1-dev.safetensors",
        "flux-dev-fp8.safetensors",
        "flux1-dev-Q8.gguf",
        "flux1-dev-Q6.gguf",
      ],
      incompatibleCandidates: ["flux1-schnell.safetensors"],
    },
  },
  vae: {
    "ae.safetensors": {
      aliases: ["ae.safetensors", "flux_ae.safetensors"],
    },
  },
};

export function resolveComfyModelAlias({
  availableFiles,
  family,
  loaderType,
  requiredName,
}: {
  availableFiles: string[];
  family: ComfyModelFamily;
  loaderType: string;
  requiredName: string;
}): ComfyModelAliasResolution {
  const available = new Set(availableFiles);
  const warnings: string[] = [];

  if (available.has(requiredName)) {
    return {
      exactMatch: true,
      ggufBlocked: false,
      missing: false,
      requiredName,
      resolvedName: requiredName,
      warnings,
    };
  }

  const aliasRule = MODEL_ALIAS_RULES[family]?.[requiredName];
  const incompatible = aliasRule?.incompatibleCandidates?.filter((candidate) => available.has(candidate)) ?? [];
  if (incompatible.length > 0 && requiredName === "flux1-dev.safetensors") {
    warnings.push("Found FLUX Schnell locally, but keep it under Fast Concept only.");
  }

  for (const candidate of aliasRule?.aliases ?? [requiredName]) {
    if (!available.has(candidate)) {
      continue;
    }

    if (candidate.toLowerCase().endsWith(".gguf") && loaderType === "UNETLoader") {
      return {
        exactMatch: false,
        ggufBlocked: true,
        missing: true,
        requiredName,
        warnings: [...warnings, "GGUF model found but current workflow uses UNETLoader; GGUF loader support required."],
      };
    }

    return {
      exactMatch: candidate === requiredName,
      ggufBlocked: false,
      missing: false,
      requiredName,
      resolvedName: candidate,
      warnings: candidate === requiredName ? warnings : [...warnings, `Using local model alias: ${requiredName} -> ${candidate}`],
    };
  }

  return {
    exactMatch: false,
    ggufBlocked: false,
    missing: true,
    requiredName,
    warnings,
  };
}