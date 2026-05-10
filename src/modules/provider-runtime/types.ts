export type ProviderType = "mock" | "comfy" | "wan" | "kling" | "runway";

export type ProviderJobStatus = "pending" | "running" | "completed" | "failed";

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
  execute(projectId: string, job: ProviderJobRequest): Promise<ProviderJobResult>;
  checkHealth(): Promise<boolean>;
}

export type ProviderErrorType = "rate_limit" | "auth_error" | "timeout" | "server_error" | "validation_error" | "unknown";

export class ProviderError extends Error {
  public type: ProviderErrorType;
  public shouldRetry: boolean;

  constructor(message: string, type: ProviderErrorType, shouldRetry: boolean) {
    super(message);
    this.name = "ProviderError";
    this.type = type;
    this.shouldRetry = shouldRetry;
  }
}

export type ProviderCost = {
  provider: ProviderType;
  creditsUsed: number;
  estimatedCostUsd: number;
};
