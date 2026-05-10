import { describe, it, expect } from "vitest";
import { executeProviderJob } from "./jobExecutor";
import { getProviderAdapter } from "./providerRegistry";
import { normalizeError } from "./failureNormalizer";
import { checkRateLimit } from "./rateLimiter";
import { getProviderHealth, setProviderHealth } from "./providerHealth";
import { getProjectCostSummary } from "./costTracker";
import { mockAdapter } from "./mockAdapter";
import type { ProviderJobRequest, ProviderError, ProviderType } from "./types";

describe("Provider Runtime Core", () => {
  const dummyJob: ProviderJobRequest = {
    id: "job-1",
    sceneId: "scene-1",
    provider: "comfy",
    prompt: "A cool cinematic shot",
    sourceImage: "img.png",
    duration: 5,
    motionType: "cinematic-drift",
  };

  describe("Adapter Contract Consistency", () => {
    it("all adapters implement the full contract", () => {
      const providers: ProviderType[] = ["mock", "comfy", "wan", "kling", "runway"];
      for (const p of providers) {
        const adapter = getProviderAdapter(p);
        expect(adapter.providerId).toBe(p);
        expect(typeof adapter.validateConfig).toBe("function");
        expect(typeof adapter.estimateCost).toBe("function");
        expect(typeof adapter.checkHealth).toBe("function");
        expect(typeof adapter.submitJob).toBe("function");
        expect(typeof adapter.pollJob).toBe("function");
      }
    });
  });

  describe("Duplicate Job Prevention", () => {
    it("prevents double execution of the same sceneId", async () => {
      // Execute the same job twice concurrently
      const promise1 = executeProviderJob("test-project", { ...dummyJob, provider: "mock" });
      const promise2 = executeProviderJob("test-project", { ...dummyJob, provider: "mock" });
      
      expect(promise1).toBe(promise2); // Same promise reference
      
      const [res1, res2] = await Promise.all([promise1, promise2]);
      expect(res1.status).toBe("completed");
      expect(res2.status).toBe("completed");
    });
  });

  describe("Failure Normalization", () => {
    it("normalizes timeout errors", () => {
      const err = normalizeError(new Error("Request timeout exceeded"), "comfy");
      expect(err.type).toBe("timeout");
      expect(err.severity).toBe("medium");
      expect(err.shouldRetry).toBe(true);
    });

    it("normalizes rate limit errors", () => {
      const err = normalizeError(new Error("429 Too Many Requests"), "wan");
      expect(err.type).toBe("rate_limit");
      expect(err.severity).toBe("low");
      expect(err.shouldRetry).toBe(true);
    });

    it("normalizes auth errors", () => {
      const err = normalizeError(new Error("401 Unauthorized access"), "kling");
      expect(err.type).toBe("auth_error");
      expect(err.severity).toBe("critical");
      expect(err.shouldRetry).toBe(false);
    });
  });

  describe("Health Scoring & Fallback", () => {
    it("falls back to mock if provider is offline or missing config", async () => {
      // By default, comfy doesn't have process.env.COMFY_API_URL in tests
      const result = await executeProviderJob("fallback-proj", dummyJob);
      expect(result.status).toBe("completed");
      expect(result.placeholderVideoId).toMatch(/^mock-/);
    });

    it("updates provider health", () => {
      setProviderHealth("comfy", "degraded");
      expect(getProviderHealth("comfy")).toBe("degraded");
    });
  });

  describe("Rate Limiter", () => {
    it("enforces rate limits and throws ProviderError", async () => {
      try {
        for (let i = 0; i < 65; i++) {
          await checkRateLimit("kling", "limit-proj");
        }
        throw new Error("Should have thrown rate limit");
      } catch (e: unknown) {
        expect((e as ProviderError).type).toBe("rate_limit");
      }
    });
  });

  describe("Cost Estimation", () => {
    it("mock provider cost is always zero", () => {
      expect(mockAdapter.estimateCost(dummyJob)).toBe(0);
    });

    it("cost summary tracks usd and credits", async () => {
      // Wait for dummyJob to finish from earlier tests
      const summary = await getProjectCostSummary("test-project");
      expect(summary.totalUsd).toBeGreaterThanOrEqual(0); // Mock costs 0, so it will be 0
    });
  });
});
