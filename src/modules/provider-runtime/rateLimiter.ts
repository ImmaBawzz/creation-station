import { ProviderError, type ProviderType } from "./types";

type RateLimitState = {
  lastCall: number;
  requestsInMinute: number;
};

const providerLimits = new Map<ProviderType, RateLimitState>();
const projectLimits = new Map<string, RateLimitState>();

function checkLimit(state: RateLimitState, maxRequests: number, resourceName: string, provider: ProviderType): void {
  const now = Date.now();
  if (now - state.lastCall > 60000) {
    state.requestsInMinute = 0;
  }

  if (state.requestsInMinute >= maxRequests) {
    throw new ProviderError(`Rate limit exceeded for ${resourceName}`, "rate_limit", provider, "low", true);
  }

  state.requestsInMinute += 1;
  state.lastCall = now;
}

export async function checkRateLimit(provider: ProviderType, projectId: string): Promise<void> {
  const pState = providerLimits.get(provider) ?? { lastCall: 0, requestsInMinute: 0 };
  const projState = projectLimits.get(projectId) ?? { lastCall: 0, requestsInMinute: 0 };

  // E.g., 60 per minute per provider, 20 per minute per project
  checkLimit(pState, 60, `provider ${provider}`, provider);
  checkLimit(projState, 20, `project ${projectId}`, provider);

  providerLimits.set(provider, pState);
  projectLimits.set(projectId, projState);
}
