import { mapCanonicalPayloadToComfy } from "./payloadMappers";
import { ProviderError } from "./types";
import type { ProviderAdapter, ProviderHealthState, ProviderJobRequest, ProviderJobResult } from "./types";

export const comfyAdapter: ProviderAdapter = {
  providerId: "comfy",

  validateConfig(): boolean {
    const url = process.env.COMFY_API_URL;
    const enabled = process.env.PROVIDER_RUNTIME_ENABLE_COMFY === "true";
    return enabled && !!url;
  },

  estimateCost(): number {
    return 0; // Local COMFY costs 0 USD
  },

  async checkHealth(): Promise<ProviderHealthState> {
    if (!this.validateConfig()) return "offline";
    return "unknown"; // TODO: Implement ping to COMFY_API_URL
  },

  async submitJob(_projectId: string, job: ProviderJobRequest): Promise<string> {
    void _projectId;
    const mapping = mapCanonicalPayloadToComfy(job);

    if (!mapping.ok) {
      throw new ProviderError(mapping.message, "validation_error", "comfy", "medium", false);
    }

    if (!this.validateConfig()) throw new Error("ComfyUI adapter not properly configured or enabled.");
    throw new Error("ComfyUI adapter submitJob not yet fully implemented.");
  },

  async pollJob(): Promise<ProviderJobResult> {
    throw new Error("ComfyUI adapter pollJob not yet fully implemented.");
  }
};
