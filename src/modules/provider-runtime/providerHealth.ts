import type { ProviderType } from "./types";

const healthStatus = new Map<ProviderType, boolean>();

export function setProviderHealth(provider: ProviderType, isHealthy: boolean): void {
  healthStatus.set(provider, isHealthy);
}

export function isProviderHealthy(provider: ProviderType): boolean {
  return healthStatus.get(provider) ?? true; // Default to true if not checked
}
