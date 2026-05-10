import { mapCanonicalPayloadToKling } from "./payloadMappers";
import { ProviderError } from "./types";
import type { ProviderAdapter, ProviderHealthState, ProviderJobRequest, ProviderJobResult } from "./types";

export const klingAdapter: ProviderAdapter = {
  providerId: "kling",

  validateConfig(): boolean {
    const apiKey = process.env.KLING_API_KEY;
    const enabled = process.env.PROVIDER_RUNTIME_ENABLE_KLING === "true";
    return enabled && !!apiKey;
  },

  estimateCost(): number {
    return 0.15; // Placeholder cost
  },

  async checkHealth(): Promise<ProviderHealthState> {
    if (!this.validateConfig()) return "offline";
    return "unknown"; 
  },

  async submitJob(_projectId: string, job: ProviderJobRequest): Promise<string> {
    void _projectId;
    const mapping = mapCanonicalPayloadToKling(job);

    if (!mapping.ok) {
      throw new ProviderError(mapping.message, "validation_error", "kling", "medium", false);
    }

    if (!this.validateConfig()) throw new Error("Kling adapter not properly configured or enabled.");
    throw new Error("Kling adapter submitJob not yet fully implemented.");
  },

  async pollJob(): Promise<ProviderJobResult> {
    throw new Error("Kling adapter pollJob not yet fully implemented.");
  }
};
