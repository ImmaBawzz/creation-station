import type { ProviderAdapter, ProviderHealthState, ProviderJobRequest, ProviderJobResult } from "./types";

export const wanAdapter: ProviderAdapter = {
  providerId: "wan",

  validateConfig(): boolean {
    const apiKey = process.env.WAN_API_KEY;
    const enabled = process.env.PROVIDER_RUNTIME_ENABLE_WAN === "true";
    return enabled && !!apiKey;
  },

  estimateCost(_job: ProviderJobRequest): number {
    return 0.10; // Placeholder cost
  },

  async checkHealth(): Promise<ProviderHealthState> {
    if (!this.validateConfig()) return "offline";
    return "unknown"; 
  },

  async submitJob(_projectId: string, _job: ProviderJobRequest): Promise<string> {
    if (!this.validateConfig()) throw new Error("WAN adapter not properly configured or enabled.");
    throw new Error("WAN adapter submitJob not yet fully implemented.");
  },

  async pollJob(_projectId: string, _jobId: string): Promise<ProviderJobResult> {
    throw new Error("WAN adapter pollJob not yet fully implemented.");
  }
};
