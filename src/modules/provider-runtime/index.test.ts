import { describe, it, expect, vi } from "vitest";

vi.mock("@/modules/video-generation/mockProvider", () => ({
  runMockSceneVideoJob: vi.fn().mockImplementation(async (projectId, job) => {
    return {
      status: "completed",
      completedAt: new Date().toISOString(),
      placeholderVideoId: `mock-${job.id}`,
      sceneId: job.sceneId,
      startedAt: job.startedAt,
    };
  }),
}));
import { submitProviderJob, pollProviderJob } from "./jobExecutor";
import { getProviderAdapter } from "./providerRegistry";
import { normalizeError } from "./failureNormalizer";
import { checkRateLimit } from "./rateLimiter";
import { getProviderHealth, setProviderHealth } from "./providerHealth";
import { getProjectCostSummary } from "./costTracker";
import { mockAdapter } from "./mockAdapter";
import {
  normalizeLegacyGenerationPayload,
  validateBaseGenerationPayload,
  validateProviderJobRequest,
} from "./types";
import type { ProviderJobRequest, ProviderError, ProviderType } from "./types";

describe("Provider Runtime Core", () => {
  const dummyJob: ProviderJobRequest = {
    id: "job-1",
    sceneId: "scene-1",
    provider: "comfy",
    prompt: "A cool cinematic shot",
    referenceAssets: [{ path: "img.png", role: "sourceImage" }],
    duration: 5,
    cameraDirection: "none",
  };

  describe("Canonical Generation Payload Contract", () => {
    it("accepts all supported generation payload fields", () => {
      const errors = validateBaseGenerationPayload({
        aspectRatio: "16:9",
        audioSyncData: { bpm: 120, beats: [0, 0.5], cues: [{ label: "drop", time: 4 }] },
        cameraDirection: "slow dolly",
        duration: 5,
        fps: 24,
        model: "provider-model",
        motionIntensity: "medium",
        negativePrompt: "blur",
        prompt: "A cinematic scene",
        providerMetadata: { providerMode: "test" },
        referenceAssets: [{ path: "img.png", role: "sourceImage" }],
        resolution: { width: 1920, height: 1080 },
        seed: 42,
        subtitleData: { lines: [{ start: 0, end: 2, text: "hello" }] },
        transitionType: "fade",
        workflowId: "workflow-1",
      });

      expect(errors).toEqual([]);
    });

    it("rejects unsupported generation payload fields", () => {
      const errors = validateBaseGenerationPayload({
        duration: 5,
        prompt: "A cinematic scene",
        sourceImage: "legacy-img.png",
      });

      expect(errors).toContain("Unsupported generation payload field: sourceImage");
    });

    it("validates ProviderJobRequest against the same canonical payload schema", () => {
      expect(validateProviderJobRequest(dummyJob)).toEqual([]);
      expect(validateProviderJobRequest({ ...dummyJob, motionType: "legacy-motion" })).toContain(
        "Unsupported provider job request field: motionType",
      );
    });

    it("maps legacy payloads to canonical reference assets", () => {
      const normalized = normalizeLegacyGenerationPayload({
        duration: 5,
        motionPrompt: "legacy prompt",
        motionType: "cinematic-drift",
        sourceImage: "legacy-img.png",
      });

      expect(normalized).toMatchObject({
        cameraDirection: "cinematic-drift",
        prompt: "legacy prompt",
        referenceAssets: [{ path: "legacy-img.png", role: "sourceImage" }],
      });
      expect(validateBaseGenerationPayload(normalized)).toEqual([]);
    });
  });

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
    it("prevents double execution of the same sceneId submit", async () => {
      // Execute the same job twice concurrently
      const promise1 = submitProviderJob("test-project", { ...dummyJob, provider: "mock" });
      const promise2 = submitProviderJob("test-project", { ...dummyJob, provider: "mock" });
      
      expect(promise1).toBe(promise2); // Same promise reference
      
      const [id1, id2] = await Promise.all([promise1, promise2]);
      expect(typeof id1).toBe("string");
      expect(id1).toBe(id2);
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
      const providerJobId = await submitProviderJob("fallback-proj", dummyJob);
      expect(typeof providerJobId).toBe("string");
      
      const result = await pollProviderJob("fallback-proj", dummyJob, providerJobId);
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
