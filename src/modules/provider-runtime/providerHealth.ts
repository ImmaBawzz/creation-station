import type { ProviderHealthState, ProviderType } from "./types";

const healthStatus = new Map<ProviderType, ProviderHealthState>();

export function setProviderHealth(provider: ProviderType, state: ProviderHealthState): void {
  healthStatus.set(provider, state);
}

export function getProviderHealth(provider: ProviderType): ProviderHealthState {
  return healthStatus.get(provider) ?? "unknown";
}

export function isProviderAvailable(provider: ProviderType): boolean {
  const state = getProviderHealth(provider);
  // Offline prevents selection. Unknown or Degraded allows it, but might be lower priority in routing.
  return state !== "offline";
}
