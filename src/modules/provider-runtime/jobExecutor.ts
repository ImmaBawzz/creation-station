import { getProviderAdapter } from "./providerRegistry";
import { checkRateLimit } from "./rateLimiter";
import { trackCost } from "./costTracker";
import { isProviderHealthy, setProviderHealth } from "./providerHealth";
import { normalizeError } from "./failureNormalizer";
import type { ProviderJobRequest, ProviderJobResult, ProviderType } from "./types";
import { ProviderError } from "./types";

// Helper to determine the fallback provider if the target provider is unhealthy
function resolveFallbackProvider(provider: ProviderType): ProviderType {
  // If we are already mock, stay mock
  if (provider === "mock") return "mock";
  // The system rules state to preserve mock fallback behavior.
  // We can fallback to mock if the requested real provider is down.
  return "mock";
}

export async function executeProviderJob(projectId: string, job: ProviderJobRequest): Promise<ProviderJobResult> {
  let targetProvider = job.provider;

  // 1. Check health and fallback if necessary
  if (!isProviderHealthy(targetProvider)) {
    console.warn(`[jobExecutor] Provider ${targetProvider} is unhealthy. Falling back to mock.`);
    targetProvider = resolveFallbackProvider(targetProvider);
    // If the provider changes, we should ideally update the job's stated provider so it matches what actually ran,
    // but the caller might expect the status back for the original job. We'll proceed with the fallback adapter.
  }

  const adapter = getProviderAdapter(targetProvider);

  try {
    // 2. Rate Limiting
    await checkRateLimit(targetProvider);

    // 3. Execution
    const result = await adapter.execute(projectId, { ...job, provider: targetProvider });

    // 4. Update health on success
    setProviderHealth(targetProvider, true);

    // 5. Cost Tracking (Estimate: only run on success or based on specific provider rules)
    if (result.status === "completed") {
      await trackCost(targetProvider, 0.05, 1); // Placeholder cost values
    }

    return result;

  } catch (error) {
    // 6. Failure Normalization
    const normalizedError = normalizeError(error);

    // If it's a server error or timeout, maybe the provider is unhealthy
    if (normalizedError.type === "server_error" || normalizedError.type === "timeout") {
      setProviderHealth(targetProvider, false);
    }

    console.error(`[jobExecutor] Job failed for provider ${targetProvider}: ${normalizedError.message}`);

    return {
      status: "failed",
      error: normalizedError.message,
      sceneId: job.sceneId,
      startedAt: job.startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}
