import type { ProviderJobRequest } from "../types";
import type { ProviderPayloadMappingResult } from "./mockPayloadMapper";

export type RunwayProviderPayload = {
  durationSeconds: number;
  fps?: number;
  imageInput: string;
  outputResolution?: ProviderJobRequest["resolution"];
  prompt: string;
  providerOptions: Record<string, unknown>;
};

function findPrimaryImage(job: ProviderJobRequest): string | undefined {
  return job.referenceAssets?.find((asset) => asset.role === "sourceImage")?.path
    ?? job.referenceAssets?.[0]?.path;
}

function buildWarnings(job: ProviderJobRequest): string[] {
  const warnings: string[] = [];

  if (job.negativePrompt) warnings.push("negativePrompt is not mapped into current Runway stubs.");
  if (job.aspectRatio) warnings.push("aspectRatio is advisory for Runway; resolution is passed when provided.");
  if (job.cameraDirection) warnings.push("cameraDirection is not mapped into current Runway stubs.");
  if (job.motionIntensity) warnings.push("motionIntensity is not mapped into current Runway stubs.");
  if (job.transitionType) warnings.push("transitionType is not mapped into current Runway stubs.");
  if (job.seed !== undefined) warnings.push("seed is not mapped into current Runway stubs.");
  if (job.model) warnings.push("model is not mapped until Runway model selection is implemented.");
  if (job.workflowId) warnings.push("workflowId is not used by Runway.");
  if (job.audioSyncData) warnings.push("audioSyncData is ignored by current Runway stubs.");
  if (job.subtitleData) warnings.push("subtitleData is ignored by current Runway stubs.");

  return warnings;
}

export function mapCanonicalPayloadToRunway(job: ProviderJobRequest): ProviderPayloadMappingResult<RunwayProviderPayload> {
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
      message: "provider_missing_reference_asset: Runway image-to-video requires a primary image input.",
      warnings,
    };
  }

  return {
    ok: true,
    payload: {
      durationSeconds: job.duration,
      fps: job.fps,
      imageInput: primaryImage,
      outputResolution: job.resolution,
      prompt: job.prompt,
      providerOptions: job.providerMetadata ?? {},
    },
    warnings,
  };
}
