import type { ProviderAdapter, ProviderHealthState, ProviderJobRequest, ProviderJobResult } from "./types";

export const klingAdapter: ProviderAdapter = {
  providerId: "kling",

  validateConfig(): boolean {
    const apiKey = process.env.KLING_API_KEY;
    const enabled = process.env.PROVIDER_RUNTIME_ENABLE_KLING === "true";
    return enabled && !!apiKey;
  },

  estimateCost(_job: ProviderJobRequest): number {
    return 0.15; // Placeholder cost
  },

  async checkHealth(): Promise<ProviderHealthState> {
    if (!this.validateConfig()) return "offline";
    return "unknown"; 
  },

  async submitJob(_projectId: string, _job: ProviderJobRequest): Promise<string> {
    if (!this.validateConfig()) throw new Error("Kling adapter not properly configured or enabled.");
    throw new Error("Kling adapter submitJob not yet fully implemented.");
  },

  async pollJob(_projectId: string, _jobId: string): Promise<ProviderJobResult> {
    throw new Error("Kling adapter pollJob not yet fully implemented.");
  }
};
