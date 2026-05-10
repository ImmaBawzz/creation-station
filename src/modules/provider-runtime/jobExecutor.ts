import { getProviderAdapter } from "./providerRegistry";
import { checkRateLimit } from "./rateLimiter";
import { trackCost } from "./costTracker";
import { getProviderHealth, setProviderHealth } from "./providerHealth";
import { normalizeError } from "./failureNormalizer";
import type { ProviderJobRequest, ProviderJobResult, ProviderType, ProviderAdapter } from "./types";
import { ProviderError } from "./types";

// Active job registry: Map key is `${projectId}:${sceneId}`
const activeJobs = new Map<string, Promise<ProviderJobResult>>();

// Helper to determine the fallback provider
function resolveFallbackProvider(provider: ProviderType): ProviderType {
  return "mock";
}

async function executeInternal(projectId: string, job: ProviderJobRequest, adapter: ProviderAdapter): Promise<ProviderJobResult> {
  const targetProvider = adapter.providerId;

  try {
    // 1. Rate Limiting
    await checkRateLimit(targetProvider, projectId);

    // 2. Execution (Submit + Poll)
    const providerJobId = await adapter.submitJob(projectId, job);
    
    // Polling loop
    let result: ProviderJobResult | null = null;
    while (!result || result.status === "pending" || result.status === "running") {
      result = await adapter.pollJob(projectId, providerJobId);
      
      if (result.status === "completed" || result.status === "failed") {
        break;
      }
      
      // Basic sleep between polls (in a real system, use an exponential backoff or configured interval)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 3. Update health on success
    setProviderHealth(targetProvider, "healthy");

    // 4. Cost Tracking
    if (result.status === "completed") {
      const estimatedCost = adapter.estimateCost(job);
      await trackCost(projectId, targetProvider, estimatedCost, 1);
    }

    return result;

  } catch (error) {
    // 5. Failure Normalization
    const normalizedError = normalizeError(error, targetProvider);

    // If it's a server error or timeout, maybe the provider is degraded
    if (normalizedError.type === "server_error" || normalizedError.type === "timeout") {
      setProviderHealth(targetProvider, "degraded");
    }

    console.error(`[jobExecutor] Job failed for provider ${targetProvider}: [${normalizedError.type}] ${normalizedError.message}`);

    return {
      status: "failed",
      error: normalizedError.message,
      sceneId: job.sceneId,
      startedAt: job.startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}

export function executeProviderJob(projectId: string, job: ProviderJobRequest): Promise<ProviderJobResult> {
  const jobKey = `${projectId}:${job.sceneId}`;

  // 1. Duplicate Prevention Guard
  if (activeJobs.has(jobKey)) {
    console.log(`[jobExecutor] Attaching to existing active job for ${jobKey}`);
    return activeJobs.get(jobKey)!;
  }

  const executionPromise = (async () => {
    try {
      let targetProvider = job.provider;
      let adapter = getProviderAdapter(targetProvider);

      // Check adapter config/health and fallback if necessary
      const health = getProviderHealth(targetProvider);
      if (!adapter.validateConfig() || health === "offline") {
        console.warn(`[jobExecutor] Provider ${targetProvider} is not configured or offline. Falling back to mock.`);
        targetProvider = resolveFallbackProvider(targetProvider);
        adapter = getProviderAdapter(targetProvider);
      }

      return await executeInternal(projectId, job, adapter);
    } finally {
      // Clean up the active job lock when done (success or failure)
      activeJobs.delete(jobKey);
    }
  })();

  activeJobs.set(jobKey, executionPromise);
  return executionPromise;
}
