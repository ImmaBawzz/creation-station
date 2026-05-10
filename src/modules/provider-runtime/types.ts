export type ProviderType = "mock" | "comfy" | "wan" | "kling" | "runway";

export type ProviderJobStatus = "pending" | "running" | "completed" | "failed";

export type ProviderHealthState = "healthy" | "degraded" | "offline" | "unknown";

export type ProviderJobRequest = {
  id: string;
  sceneId: string;
  provider: ProviderType;
  prompt: string;
  sourceImage: string;
  duration: number;
  motionType: string;
  startedAt?: string;
};

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
