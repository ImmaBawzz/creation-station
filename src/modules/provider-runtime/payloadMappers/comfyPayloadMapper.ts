import type { ProviderJobRequest } from "../types";
import type { ProviderPayloadMappingResult } from "./mockPayloadMapper";

export type ComfyProviderPayload = {
  imageInputs: string[];
  negativePrompt: string;
  positivePrompt: string;
  samplerSeed?: number;
  workflowId: string;
  workflowOverrides: Record<string, unknown>;
  width?: number;
  height?: number;
};

function findPrimaryImage(job: ProviderJobRequest): string | undefined {
  return job.referenceAssets?.find((asset) => asset.role === "sourceImage")?.path
    ?? job.referenceAssets?.[0]?.path;
}

function buildWarnings(job: ProviderJobRequest): string[] {
  const warnings: string[] = [];

  if (job.aspectRatio) warnings.push("aspectRatio is advisory for Comfy; resolution controls dimensions when provided.");
  if (job.fps) warnings.push("fps is not mapped into current Comfy workflow stubs.");
  if (job.model) warnings.push("model is not mapped until Comfy workflow registry model selection is implemented.");
  if (job.motionIntensity) warnings.push("motionIntensity is not mapped into current Comfy workflow stubs.");
  if (job.transitionType) warnings.push("transitionType is not mapped into current Comfy workflow stubs.");
  if (job.audioSyncData) warnings.push("audioSyncData is ignored by current Comfy workflow stubs.");
  if (job.subtitleData) warnings.push("subtitleData is ignored by current Comfy workflow stubs.");

  return warnings;
}

export function mapCanonicalPayloadToComfy(job: ProviderJobRequest): ProviderPayloadMappingResult<ComfyProviderPayload> {
  const warnings = buildWarnings(job);

  if (!job.prompt.trim()) {
    return {
      ok: false,
      errorCode: "provider_payload_invalid",
      message: "provider_payload_invalid: prompt is required.",
      warnings,
    };
  }

  if (!Number.isFinite(job.duration) || job.duration <= 0) {
    return {
      ok: false,
      errorCode: "provider_payload_invalid",
      message: "provider_payload_invalid: duration must be a positive number.",
      warnings,
    };
  }

  const primaryImage = findPrimaryImage(job);

  if (!primaryImage) {
    return {
      ok: false,
      errorCode: "provider_missing_reference_asset",
      message: "provider_missing_reference_asset: Comfy video workflows require a primary reference image.",
      warnings,
    };
  }

  return {
    ok: true,
    payload: {
      height: job.resolution?.height,
      imageInputs: [primaryImage],
      negativePrompt: job.negativePrompt ?? "",
      positivePrompt: job.prompt,
      samplerSeed: job.seed,
      width: job.resolution?.width,
      workflowId: job.workflowId ?? "default-video-workflow",
      workflowOverrides: job.providerMetadata ?? {},
    },
    warnings,
  };
}
