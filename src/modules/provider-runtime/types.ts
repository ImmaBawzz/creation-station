export type ProviderType = "mock" | "comfy" | "wan" | "kling" | "runway";

export type ProviderJobStatus = "pending" | "running" | "completed" | "failed";

export type ProviderHealthState = "healthy" | "degraded" | "offline" | "unknown";

export type GenerationAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
export type GenerationMotionIntensity = "low" | "medium" | "high" | "extreme";

export type GenerationResolution = {
  height: number;
  width: number;
};

export type GenerationReferenceAsset = {
  path: string;
  role: "sourceImage" | "styleReference" | "mask" | "control" | "other";
};

export type GenerationAudioSyncData = {
  bpm?: number;
  beats?: number[];
  cues?: Array<{
    label: string;
    time: number;
  }>;
};

export type GenerationSubtitleData = {
  lines: Array<{
    end: number;
    start: number;
    text: string;
  }>;
};

export type BaseGenerationPayload = {
  aspectRatio?: GenerationAspectRatio;
  audioSyncData?: GenerationAudioSyncData;
  cameraDirection?: string;
  duration: number;
  fps?: number;
  model?: string;
  motionIntensity?: GenerationMotionIntensity;
  negativePrompt?: string;
  prompt: string;
  providerMetadata?: Record<string, unknown>;
  referenceAssets?: GenerationReferenceAsset[];
  resolution?: GenerationResolution;
  seed?: number;
  subtitleData?: GenerationSubtitleData;
  transitionType?: string;
  workflowId?: string;
};

export interface ProviderJobRequest extends BaseGenerationPayload {
  id: string;
  provider: ProviderType;
  sceneId: string;
  startedAt?: string;
}

type LegacyGenerationPayload = Partial<BaseGenerationPayload> & {
  motionPrompt?: unknown;
  motionType?: unknown;
  sourceImage?: unknown;
};

const BASE_GENERATION_PAYLOAD_KEYS = new Set<keyof BaseGenerationPayload>([
  "aspectRatio",
  "audioSyncData",
  "cameraDirection",
  "duration",
  "fps",
  "model",
  "motionIntensity",
  "negativePrompt",
  "prompt",
  "providerMetadata",
  "referenceAssets",
  "resolution",
  "seed",
  "subtitleData",
  "transitionType",
  "workflowId",
]);

const PROVIDER_JOB_REQUEST_KEYS = new Set<string>([
  ...BASE_GENERATION_PAYLOAD_KEYS,
  "id",
  "provider",
  "sceneId",
  "startedAt",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isGenerationAspectRatio(value: unknown): value is GenerationAspectRatio {
  return value === "16:9" || value === "9:16" || value === "1:1" || value === "4:3" || value === "3:4";
}

function isGenerationMotionIntensity(value: unknown): value is GenerationMotionIntensity {
  return value === "low" || value === "medium" || value === "high" || value === "extreme";
}

function isGenerationResolution(value: unknown): value is GenerationResolution {
  return isPlainObject(value)
    && typeof value.width === "number"
    && Number.isFinite(value.width)
    && value.width > 0
    && typeof value.height === "number"
    && Number.isFinite(value.height)
    && value.height > 0;
}

function isReferenceAsset(value: unknown): value is GenerationReferenceAsset {
  if (!isPlainObject(value)) {
    return false;
  }

  return typeof value.path === "string"
    && value.path.trim().length > 0
    && (value.role === "sourceImage"
      || value.role === "styleReference"
      || value.role === "mask"
      || value.role === "control"
      || value.role === "other");
}

function isAudioSyncData(value: unknown): value is GenerationAudioSyncData {
  if (!isPlainObject(value)) {
    return false;
  }

  if (value.bpm !== undefined && (typeof value.bpm !== "number" || !Number.isFinite(value.bpm) || value.bpm <= 0)) {
    return false;
  }

  if (value.beats !== undefined && (!Array.isArray(value.beats) || !value.beats.every((beat) => typeof beat === "number" && Number.isFinite(beat)))) {
    return false;
  }

  if (value.cues !== undefined && (!Array.isArray(value.cues) || !value.cues.every((cue) => (
    isPlainObject(cue)
    && typeof cue.label === "string"
    && typeof cue.time === "number"
    && Number.isFinite(cue.time)
  )))) {
    return false;
  }

  return true;
}

function isSubtitleData(value: unknown): value is GenerationSubtitleData {
  return isPlainObject(value)
    && Array.isArray(value.lines)
    && value.lines.every((line) => (
      isPlainObject(line)
      && typeof line.text === "string"
      && typeof line.start === "number"
      && Number.isFinite(line.start)
      && typeof line.end === "number"
      && Number.isFinite(line.end)
      && line.end >= line.start
    ));
}

function pickBaseGenerationPayload(payload: Record<string, unknown>): Partial<BaseGenerationPayload> {
  const basePayload: Record<string, unknown> = {};

  for (const key of BASE_GENERATION_PAYLOAD_KEYS) {
    if (key in payload) {
      basePayload[key] = payload[key];
    }
  }

  return basePayload as Partial<BaseGenerationPayload>;
}

export function normalizeLegacyGenerationPayload(payload: LegacyGenerationPayload): BaseGenerationPayload {
  const normalized: BaseGenerationPayload = {
    aspectRatio: payload.aspectRatio,
    audioSyncData: payload.audioSyncData,
    cameraDirection: payload.cameraDirection,
    duration: payload.duration ?? 0,
    fps: payload.fps,
    model: payload.model,
    motionIntensity: payload.motionIntensity,
    negativePrompt: payload.negativePrompt,
    prompt: payload.prompt ?? "",
    providerMetadata: payload.providerMetadata,
    referenceAssets: payload.referenceAssets,
    resolution: payload.resolution,
    seed: payload.seed,
    subtitleData: payload.subtitleData,
    transitionType: payload.transitionType,
    workflowId: payload.workflowId,
  };

  if (normalized.prompt.length === 0 && typeof payload.motionPrompt === "string") {
    normalized.prompt = payload.motionPrompt;
  }

  if (!normalized.cameraDirection && typeof payload.motionType === "string") {
    normalized.cameraDirection = payload.motionType;
  }

  if ((!normalized.referenceAssets || normalized.referenceAssets.length === 0) && typeof payload.sourceImage === "string" && payload.sourceImage.trim().length > 0) {
    normalized.referenceAssets = [{ path: payload.sourceImage, role: "sourceImage" }];
  }

  return normalized;
}

export function getPrimaryReferenceAssetPath(payload: BaseGenerationPayload): string | undefined {
  return payload.referenceAssets?.find((asset) => asset.role === "sourceImage")?.path
    ?? payload.referenceAssets?.[0]?.path;
}

export function validateBaseGenerationPayload(payload: unknown): string[] {
  const errors: string[] = [];

  if (!isPlainObject(payload)) {
    return ["Payload must be an object."];
  }

  for (const key of Object.keys(payload)) {
    if (!BASE_GENERATION_PAYLOAD_KEYS.has(key as keyof BaseGenerationPayload)) {
      errors.push(`Unsupported generation payload field: ${key}`);
    }
  }

  if (typeof payload.prompt !== "string" || payload.prompt.trim().length === 0) {
    errors.push("prompt must be a non-empty string.");
  }

  if (typeof payload.duration !== "number" || !Number.isFinite(payload.duration) || payload.duration <= 0) {
    errors.push("duration must be a positive number.");
  }

  if (payload.negativePrompt !== undefined && typeof payload.negativePrompt !== "string") {
    errors.push("negativePrompt must be a string when provided.");
  }

  if (payload.aspectRatio !== undefined && !isGenerationAspectRatio(payload.aspectRatio)) {
    errors.push("aspectRatio must be one of 16:9, 9:16, 1:1, 4:3, or 3:4.");
  }

  if (payload.cameraDirection !== undefined && typeof payload.cameraDirection !== "string") {
    errors.push("cameraDirection must be a string when provided.");
  }

  if (payload.motionIntensity !== undefined && !isGenerationMotionIntensity(payload.motionIntensity)) {
    errors.push("motionIntensity must be one of low, medium, high, or extreme.");
  }

  if (payload.transitionType !== undefined && typeof payload.transitionType !== "string") {
    errors.push("transitionType must be a string when provided.");
  }

  if (payload.resolution !== undefined && !isGenerationResolution(payload.resolution)) {
    errors.push("resolution must contain positive numeric width and height.");
  }

  if (payload.fps !== undefined && (typeof payload.fps !== "number" || !Number.isInteger(payload.fps) || payload.fps <= 0)) {
    errors.push("fps must be a positive integer when provided.");
  }

  if (payload.seed !== undefined && (typeof payload.seed !== "number" || !Number.isInteger(payload.seed))) {
    errors.push("seed must be an integer when provided.");
  }

  if (payload.model !== undefined && typeof payload.model !== "string") {
    errors.push("model must be a string when provided.");
  }

  if (payload.workflowId !== undefined && typeof payload.workflowId !== "string") {
    errors.push("workflowId must be a string when provided.");
  }

  if (payload.referenceAssets !== undefined && (!Array.isArray(payload.referenceAssets) || !payload.referenceAssets.every(isReferenceAsset))) {
    errors.push("referenceAssets must be an array of assets with path and role.");
  }

  if (payload.audioSyncData !== undefined && !isAudioSyncData(payload.audioSyncData)) {
    errors.push("audioSyncData must contain valid bpm, beats, or cues when provided.");
  }

  if (payload.subtitleData !== undefined && !isSubtitleData(payload.subtitleData)) {
    errors.push("subtitleData must contain subtitle lines with start, end, and text.");
  }

  if (payload.providerMetadata !== undefined && !isPlainObject(payload.providerMetadata)) {
    errors.push("providerMetadata must be an object when provided.");
  }

  return errors;
}

export function validateProviderJobRequest(job: unknown): string[] {
  const errors: string[] = [];

  if (!isPlainObject(job)) {
    return ["Provider job request must be an object."];
  }

  for (const key of Object.keys(job)) {
    if (!PROVIDER_JOB_REQUEST_KEYS.has(key)) {
      errors.push(`Unsupported provider job request field: ${key}`);
    }
  }

  if (typeof job.id !== "string" || job.id.trim().length === 0) {
    errors.push("id must be a non-empty string.");
  }

  if (typeof job.sceneId !== "string" || job.sceneId.trim().length === 0) {
    errors.push("sceneId must be a non-empty string.");
  }

  if (job.provider !== "mock" && job.provider !== "comfy" && job.provider !== "wan" && job.provider !== "kling" && job.provider !== "runway") {
    errors.push("provider must be one of mock, comfy, wan, kling, or runway.");
  }

  if (job.startedAt !== undefined && typeof job.startedAt !== "string") {
    errors.push("startedAt must be a string when provided.");
  }

  return [...errors, ...validateBaseGenerationPayload(pickBaseGenerationPayload(job))];
}

export function assertValidProviderJobRequest(job: ProviderJobRequest): void {
  const errors = validateProviderJobRequest(job);

  if (errors.length > 0) {
    throw new ProviderError(errors.join(" "), "validation_error", isPlainObject(job) && typeof job.provider === "string" ? job.provider as ProviderType : "mock", "high", false);
  }
}

export type ProviderJobResult = {
  status: ProviderJobStatus;
  completedAt?: string;
  startedAt?: string;
  error?: string;
  placeholderVideoId?: string;
  sceneId: string;
};

export interface ProviderAdapter {
  providerId: ProviderType;
  validateConfig(): boolean;
  estimateCost(job: ProviderJobRequest): number;
  checkHealth(): Promise<ProviderHealthState>;
  submitJob(projectId: string, job: ProviderJobRequest): Promise<string>;
  pollJob(projectId: string, jobId: string): Promise<ProviderJobResult>;
  cancelJob?(projectId: string, jobId: string): Promise<void>;
}

export type ProviderErrorType = "rate_limit" | "auth_error" | "timeout" | "server_error" | "validation_error" | "unknown";
export type ProviderErrorSeverity = "low" | "medium" | "high" | "critical";

export class ProviderError extends Error {
  public type: ProviderErrorType;
  public provider: ProviderType;
  public severity: ProviderErrorSeverity;
  public shouldRetry: boolean;

  constructor(message: string, type: ProviderErrorType, provider: ProviderType, severity: ProviderErrorSeverity, shouldRetry: boolean) {
    super(message);
    this.name = "ProviderError";
    this.type = type;
    this.provider = provider;
    this.severity = severity;
    this.shouldRetry = shouldRetry;
  }
}

export type ProviderCost = {
  provider: ProviderType;
  creditsUsed: number;
  estimatedCostUsd: number;
};
