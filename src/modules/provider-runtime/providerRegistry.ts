import type { ProviderAdapter, ProviderType } from "./types";
import { comfyAdapter } from "./comfyAdapter";
import { wanAdapter } from "./wanAdapter";
import { klingAdapter } from "./klingAdapter";
import { runwayAdapter } from "./runwayAdapter";
import { mockAdapter } from "./mockAdapter";

const registry: Record<ProviderType, ProviderAdapter> = {
  mock: mockAdapter,
  comfy: comfyAdapter,
  wan: wanAdapter,
  kling: klingAdapter,
  runway: runwayAdapter,
};

export function getProviderAdapter(provider: ProviderType): ProviderAdapter {
  const adapter = registry[provider];
  if (!adapter) {
    throw new Error(`No adapter found for provider: ${provider}`);
  }
  return adapter;
}
