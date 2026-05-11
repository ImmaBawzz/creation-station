import type { ProviderJobRequest } from "../types";

export type ProviderPayloadMappingErrorCode = "provider_payload_invalid" | "provider_missing_reference_asset";

export type ProviderPayloadMappingResult<TPayload> = {
  ok: true;
  payload: TPayload;
  warnings: string[];
} | {
  ok: false;
  errorCode: ProviderPayloadMappingErrorCode;
  message: string;
  warnings: string[];
};

export type CanonicalPayloadSnapshot = {
  aspectRatio?: ProviderJobRequest["aspectRatio"];
  audioSyncData?: ProviderJobRequest["audioSyncData"];
  cameraDirection?: string;
  duration: number;
  fps?: number;
  model?: string;
  motionIntensity?: ProviderJobRequest["motionIntensity"];
  negativePrompt?: string;
  prompt: string;
  providerMetadata?: Record<string, unknown>;
  referenceAssets: NonNullable<ProviderJobRequest["referenceAssets"]>;
  resolution?: ProviderJobRequest["resolution"];
  seed?: number;
  subtitleData?: ProviderJobRequest["subtitleData"];
  transitionType?: string;
  workflowId?: string;
};

export type MockProviderPayload = {
  canonicalPayload: CanonicalPayloadSnapshot;
  primaryImage: string;
  warnings: string[];
};

function findPrimaryImage(job: ProviderJobRequest): string | undefined {
  return job.referenceAssets?.find((asset) => asset.role === "sourceImage")?.path
    ?? job.referenceAssets?.[0]?.path;
}

function validateCommon(job: ProviderJobRequest): ProviderPayloadMappingResult<{ primaryImage: string }> {
  const warnings: string[] = [];

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
      message: "provider_missing_reference_asset: primary source image is required.",
      warnings,
    };
  }

  return { ok: true, payload: { primaryImage }, warnings };
}

export function mapCanonicalPayloadToMock(job: ProviderJobRequest): ProviderPayloadMappingResult<MockProviderPayload> {
  const common = validateCommon(job);

  if (!common.ok) {
    return common;
  }

  const warnings = [...common.warnings];

  return {
    ok: true,
    payload: {
      canonicalPayload: {
        aspectRatio: job.aspectRatio,
        audioSyncData: job.audioSyncData,
        cameraDirection: job.cameraDirection,
        duration: job.duration,
        fps: job.fps,
        model: job.model,
        motionIntensity: job.motionIntensity,
        negativePrompt: job.negativePrompt,
        prompt: job.prompt,
        providerMetadata: job.providerMetadata,
        referenceAssets: job.referenceAssets ?? [],
        resolution: job.resolution,
        seed: job.seed,
        subtitleData: job.subtitleData,
        transitionType: job.transitionType,
        workflowId: job.workflowId,
      },
      primaryImage: common.payload.primaryImage,
      warnings,
    },
    warnings,
  };
}
