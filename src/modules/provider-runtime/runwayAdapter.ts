import { mapCanonicalPayloadToRunway } from "./payloadMappers";
import { ProviderError } from "./types";
import type { ProviderAdapter, ProviderHealthState, ProviderJobRequest, ProviderJobResult } from "./types";

export const runwayAdapter: ProviderAdapter = {
  providerId: "runway",

  validateConfig(): boolean {
    const apiKey = process.env.RUNWAY_API_KEY;
    const enabled = process.env.PROVIDER_RUNTIME_ENABLE_RUNWAY === "true";
    return enabled && !!apiKey;
  },

  estimateCost(): number {
    return 0.20; // Placeholder cost
  },

  async checkHealth(): Promise<ProviderHealthState> {
    if (!this.validateConfig()) return "offline";
    return "unknown"; 
  },

  async submitJob(_projectId: string, job: ProviderJobRequest): Promise<string> {
    void _projectId;
    const mapping = mapCanonicalPayloadToRunway(job);

    if (!mapping.ok) {
      throw new ProviderError(mapping.message, "validation_error", "runway", "medium", false);
    }

    if (!this.validateConfig()) throw new Error("Runway adapter not properly configured or enabled.");
    throw new Error("Runway adapter submitJob not yet fully implemented.");
  },

  async pollJob(): Promise<ProviderJobResult> {
    throw new Error("Runway adapter pollJob not yet fully implemented.");
  }
};
