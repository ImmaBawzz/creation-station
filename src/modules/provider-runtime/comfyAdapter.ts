import type { ProviderAdapter, ProviderJobRequest, ProviderJobResult } from "./types";

export const comfyAdapter: ProviderAdapter = {
  async execute(_projectId: string, _job: ProviderJobRequest): Promise<ProviderJobResult> {
    // Placeholder implementation
    throw new Error("ComfyUI adapter not yet fully implemented.");
  },
  
  async checkHealth(): Promise<boolean> {
    // Placeholder
    return false;
  }
};
