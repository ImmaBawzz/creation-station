import { getProviderAdapter } from "./providerRegistry";
import { checkRateLimit } from "./rateLimiter";
import { trackCost } from "./costTracker";
import { getProviderHealth, setProviderHealth } from "./providerHealth";
import { normalizeError } from "./failureNormalizer";
import type { ProviderJobRequest, ProviderJobResult, ProviderType, ProviderAdapter } from "./types";
import { assertValidProviderJobRequest, ProviderError } from "./types";
import { evaluateProviderGate } from "./readiness";

// Active job registry: Map key is `${projectId}:${sceneId}`
// We only use this to prevent double-submit if we somehow trigger submitJob twice.
const activeSubmits = new Map<string, Promise<string>>();
const readinessJobs = new Map<string, ProviderJobResult>();

// Helper to determine the fallback provider
function resolveFallbackProvider(): ProviderType {
  return "mock";
}

function getAdapterWithFallback(targetProvider: ProviderType): ProviderAdapter {
  let adapter = getProviderAdapter(targetProvider);

  // Check adapter config/health and fallback if necessary
  const health = getProviderHealth(targetProvider);
  if (!adapter.validateConfig() || health === "offline") {
    console.warn(`[jobExecutor] Provider ${targetProvider} is not configured or offline. Falling back to mock.`);
    targetProvider = resolveFallbackProvider();
    adapter = getProviderAdapter(targetProvider);
  }

  return adapter;
}

export function submitProviderJob(projectId: string, job: ProviderJobRequest): Promise<string> {
  assertValidProviderJobRequest(job);

  const jobKey = `${projectId}:${job.sceneId}`;

  // Duplicate Prevention Guard for submit
  if (activeSubmits.has(jobKey)) {
    console.log(`[jobExecutor] Attaching to existing active submit for ${jobKey}`);
    return activeSubmits.get(jobKey)!;
  }

  const executionPromise = (async () => {
    try {
      const gate = evaluateProviderGate(job);

      if (gate.action === "block") {
        if (job.provider !== "mock" && gate.errorCode === "provider_unavailable" && gate.inspection.executionMode === "disabled") {
          const fallbackAdapter = getProviderAdapter(resolveFallbackProvider());
          await checkRateLimit(fallbackAdapter.providerId, projectId);
          return await fallbackAdapter.submitJob(projectId, job);
        }

        throw new ProviderError(gate.message, gate.errorCode === "provider_unavailable" ? "provider_unavailable" : "validation_error", job.provider, "medium", false);
      }

      if (gate.action === "inspect" || gate.action === "dry-run") {
        const providerJobId = `${gate.action}-${job.provider}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        readinessJobs.set(providerJobId, {
          completedAt: new Date().toISOString(),
          placeholderVideoId: `${gate.action}-${job.sceneId}`,
          providerMetadata: {
            readinessInspection: gate.inspection,
          },
          sceneId: job.sceneId,
          startedAt: job.startedAt,
          status: "completed",
        });
        return providerJobId;
      }

      const adapter = getAdapterWithFallback(job.provider);
      const targetProvider = adapter.providerId;

      await checkRateLimit(targetProvider, projectId);
      
      const providerJobId = await adapter.submitJob(projectId, job);
      return providerJobId;

    } catch (error) {
      const targetProvider = job.provider;
      const normalizedError = normalizeError(error, targetProvider);

      if (normalizedError.type === "server_error" || normalizedError.type === "timeout") {
        setProviderHealth(targetProvider, "degraded");
      }

      console.error(`[jobExecutor] Submit failed for provider ${targetProvider}: [${normalizedError.type}] ${normalizedError.message}`);
      throw normalizedError;
    } finally {
      activeSubmits.delete(jobKey);
    }
  })();

  activeSubmits.set(jobKey, executionPromise);
  return executionPromise;
}

export async function pollProviderJob(projectId: string, job: ProviderJobRequest, providerJobId: string): Promise<ProviderJobResult> {
  assertValidProviderJobRequest(job);

  const readinessResult = readinessJobs.get(providerJobId);
  if (readinessResult) {
    readinessJobs.delete(providerJobId);
    return readinessResult;
  }

  const adapter = getAdapterWithFallback(job.provider);
  const targetProvider = adapter.providerId;

  try {
    const result = await adapter.pollJob(projectId, providerJobId);

    if (result.status === "completed") {
      setProviderHealth(targetProvider, "healthy");
      const estimatedCost = adapter.estimateCost(job);
      await trackCost(projectId, targetProvider, estimatedCost, 1);
    }

    return result;
  } catch (error) {
    const normalizedError = normalizeError(error, targetProvider);

    if (normalizedError.type === "server_error" || normalizedError.type === "timeout") {
      setProviderHealth(targetProvider, "degraded");
    }

    console.error(`[jobExecutor] Poll failed for provider ${targetProvider}: [${normalizedError.type}] ${normalizedError.message}`);

    return {
      status: "failed",
      error: normalizedError.message,
      sceneId: job.sceneId,
      startedAt: job.startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}

export async function cancelProviderJob(projectId: string, job: ProviderJobRequest, providerJobId: string): Promise<void> {
  assertValidProviderJobRequest(job);

  const adapter = getAdapterWithFallback(job.provider);
  if (adapter.cancelJob) {
    await adapter.cancelJob(projectId, providerJobId);
  }
}
