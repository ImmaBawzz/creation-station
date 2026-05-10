import type { ProviderType } from "./types";

const providerLimits = new Map<ProviderType, { lastCall: number; requestsInMinute: number }>();

export async function checkRateLimit(provider: ProviderType): Promise<void> {
  const now = Date.now();
  const state = providerLimits.get(provider) ?? { lastCall: 0, requestsInMinute: 0 };

  // Simple reset every minute
  if (now - state.lastCall > 60000) {
    state.requestsInMinute = 0;
  }

  // Example limit: max 60 requests per minute
  if (state.requestsInMinute >= 60) {
    throw new Error("Rate limit exceeded for provider " + provider);
  }

  state.requestsInMinute += 1;
  state.lastCall = now;
  providerLimits.set(provider, state);
}
