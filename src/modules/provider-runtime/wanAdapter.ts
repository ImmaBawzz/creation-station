import type { ProviderAdapter, ProviderJobRequest, ProviderJobResult } from "./types";

export const wanAdapter: ProviderAdapter = {
  async execute(_projectId: string, _job: ProviderJobRequest): Promise<ProviderJobResult> {
    // Placeholder implementation
    throw new Error("WAN adapter not yet fully implemented.");
  },
  
  async checkHealth(): Promise<boolean> {
    // Placeholder
    return false;
  }
};
