import type { ProviderJobRequest } from "../types";
import type { ProviderPayloadMappingResult } from "./mockPayloadMapper";

export type KlingProviderPayload = {
  durationSeconds: number;
  motionPrompt: string;
  prompt: string;
  providerOptions: Record<string, unknown>;
  startFrame: string;
};

function findPrimaryImage(job: ProviderJobRequest): string | undefined {
  return job.referenceAssets?.find((asset) => asset.role === "sourceImage")?.path
    ?? job.referenceAssets?.[0]?.path;
}

function buildMotionPrompt(job: ProviderJobRequest): string {
  return [
    job.cameraDirection,
    job.motionIntensity ? `motion intensity: ${job.motionIntensity}` : undefined,
  ].filter(Boolean).join("; ");
}

function buildWarnings(job: ProviderJobRequest): string[] {
  const warnings: string[] = [];

  if (job.negativePrompt) warnings.push("negativePrompt is not mapped into current Kling stubs.");
  if (job.aspectRatio) warnings.push("aspectRatio is not mapped into current Kling stubs.");
  if (job.resolution) warnings.push("resolution is not mapped until Kling output settings are implemented.");
  if (job.fps) warnings.push("fps is not mapped until Kling output settings are implemented.");
  if (job.seed !== undefined) warnings.push("seed is not mapped into current Kling stubs.");
  if (job.model) warnings.push("model is not mapped until Kling model selection is implemented.");
  if (job.workflowId) warnings.push("workflowId is not used by Kling.");
  if (job.transitionType) warnings.push("transitionType is not mapped into current Kling stubs.");
  if (job.audioSyncData) warnings.push("audioSyncData is ignored by current Kling stubs.");
  if (job.subtitleData) warnings.push("subtitleData is ignored by current Kling stubs.");

  return warnings;
}

export function mapCanonicalPayloadToKling(job: ProviderJobRequest): ProviderPayloadMappingResult<KlingProviderPayload> {
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
      message: "provider_missing_reference_asset: Kling image-to-video requires a primary start frame.",
      warnings,
    };
  }

  return {
    ok: true,
    payload: {
      durationSeconds: job.duration,
      motionPrompt: buildMotionPrompt(job),
      prompt: job.prompt,
      providerOptions: job.providerMetadata ?? {},
      startFrame: primaryImage,
    },
    warnings,
  };
}
