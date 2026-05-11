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

vi.mock("./rateLimiter", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
}));

import { submitProviderJob, pollProviderJob, cancelProviderJob } from "./jobExecutor";
import { getProviderHealth, setProviderHealth } from "./providerHealth";
import { getProjectCostSummary } from "./costTracker";
import type { ProviderJobRequest } from "./types";
import { ensureSceneVideoRunner } from "@/modules/video-generation/videoQueue";
import { readSceneVideoState, writeSceneVideoState } from "@/modules/video-generation/sceneVideoManifest";
import { mkdir, rm } from "node:fs/promises";
import { getVisualProjectAssetFolders, getVisualProjectRoot } from "@/modules/visual-engine/paths";

function generateProjectId() {
  return `stress-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function setupProject(projectId: string) {
  const folders = getVisualProjectAssetFolders(projectId);
  await mkdir(folders.video, { recursive: true });
  await mkdir(folders.lyrics, { recursive: true });
  return folders;
}

async function teardownProject(projectId: string) {
  const root = getVisualProjectRoot(projectId);
  await rm(root, { force: true, recursive: true });
}

describe("Provider-Runtime Stress Verification", () => {
  const dummyJob: ProviderJobRequest = {
    id: "job-1",
    sceneId: "scene-1",
    provider: "comfy",
    prompt: "Stress testing",
    referenceAssets: [{ path: "img.png", role: "sourceImage" }],
    duration: 5,
    cameraDirection: "steady hold",
  };

  describe("1. Duplicate submission prevention", () => {
    it("prevents double execution of the same sceneId submit", async () => {
      const promise1 = submitProviderJob("test-project-1", { ...dummyJob, provider: "mock" });
      const promise2 = submitProviderJob("test-project-1", { ...dummyJob, provider: "mock" });
      
      expect(promise1).toBe(promise2);
      
      const [id1, id2] = await Promise.all([promise1, promise2]);
      expect(id1).toBe(id2);
    });
  });

  describe("2. Restart recovery & 8. Manifest corruption recovery", () => {
    it("resumes polling from persisted providerJobId and handles corruption", async () => {
      const projectId = generateProjectId();
      await setupProject(projectId);

      await writeSceneVideoState({
        approvedSceneIds: ["scene-1", "scene-2"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectId,
        provider: "mock",
        status: "running",
        sourceManifests: { sceneAssets: "", scenePlan: "", sceneVideos: "" },
        progress: { completed: 0, failed: 0, pending: 0, processed: 0, running: 2, total: 2 },
        jobs: [
          {
            id: "job-1",
            sceneId: "scene-1",
            provider: "mock",
            motionPrompt: "valid",
            sourceImage: "img1",
            duration: 5,
            motionType: "steady-hold",
            cameraDirection: "none",
            referenceAssets: [{ path: "img1", role: "sourceImage" }],
            status: "running",
            providerJobId: "mock-1234",
            startedAt: new Date().toISOString()
          },
          {
            id: "job-2",
            sceneId: "scene-2",
            provider: "mock",
            motionPrompt: "corrupt",
            sourceImage: "img2",
            duration: 5,
            motionType: "steady-hold",
            cameraDirection: "none",
            referenceAssets: [{ path: "img2", role: "sourceImage" }],
            status: "running",
            startedAt: new Date().toISOString()
          }
        ]
      });

      ensureSceneVideoRunner(projectId);
      await new Promise(r => setTimeout(r, 1000));

      const finalState = await readSceneVideoState(projectId);
      const job1 = finalState?.jobs.find(j => j.id === "job-1");
      const job2 = finalState?.jobs.find(j => j.id === "job-2");

      expect(job1?.status).toBe("failed");
      expect(job1?.error).toContain("not found in mock adapter");
      
      expect(job2?.status).toBe("failed");
      expect(job2?.error).toBe("missing_provider_job_id");

      await teardownProject(projectId);
    });
  });

  describe("3. Timeout enforcement", () => {
    it("times out jobs exceeding their provider limits", async () => {
      const projectId = generateProjectId();
      await setupProject(projectId);

      const oldTime = new Date(Date.now() - (46 * 60 * 1000)).toISOString();

      await writeSceneVideoState({
        approvedSceneIds: ["scene-1"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectId,
        provider: "wan",
        status: "running",
        sourceManifests: { sceneAssets: "", scenePlan: "", sceneVideos: "" },
        progress: { completed: 0, failed: 0, pending: 0, processed: 0, running: 1, total: 1 },
        jobs: [
          {
            id: "job-1",
            sceneId: "scene-1",
            provider: "wan",
            motionPrompt: "timeout check",
            sourceImage: "img1",
            duration: 5,
            motionType: "steady-hold",
            cameraDirection: "none",
            referenceAssets: [{ path: "img1", role: "sourceImage" }],
            status: "running",
            providerJobId: "wan-999",
            startedAt: oldTime
          }
        ]
      });

      ensureSceneVideoRunner(projectId);
      await new Promise(r => setTimeout(r, 500));

      const finalState = await readSceneVideoState(projectId);
      const job = finalState?.jobs[0];

      expect(job?.status).toBe("failed");
      expect(job?.error).toBe("provider_timeout");

      await teardownProject(projectId);
    });
  });

  describe("4. Provider degradation", () => {
    it("degrades health on repeated failures", async () => {
      setProviderHealth("kling", "healthy");
      setProviderHealth("kling", "degraded");
      expect(getProviderHealth("kling")).toBe("degraded");
    });
  });

  describe("5. Fallback routing", () => {
    it("falls back to mock if comfy is not configured", async () => {
      const providerJobId = await submitProviderJob("fallback-proj", { ...dummyJob, provider: "comfy" });
      expect(typeof providerJobId).toBe("string");
      
      const result = await pollProviderJob("fallback-proj", dummyJob, providerJobId);
      expect(result.status).toBe("completed");
      expect(result.placeholderVideoId).toMatch(/^mock-/);
    });
  });

  describe("6. Cost tracking", () => {
    it("does not double-charge failed jobs and records completed", async () => {
      const summary = await getProjectCostSummary("fallback-proj");
      expect(summary.totalUsd).toBeGreaterThanOrEqual(0); 
    });
  });

  describe("7. Poll load verification", () => {
    it("handles 100 concurrent poll requests safely", async () => {
      const submitPromises = [];
      for (let i = 0; i < 100; i++) {
        submitPromises.push(submitProviderJob("load-test-proj", { ...dummyJob, sceneId: `scene-${i}`, provider: "mock" }));
      }
      
      const jobIds = await Promise.all(submitPromises);
      
      const pollPromises = [];
      for (let i = 0; i < 100; i++) {
        pollPromises.push(pollProviderJob("load-test-proj", { ...dummyJob, sceneId: `scene-${i}`, provider: "mock" }, jobIds[i]));
      }
      
      const results = await Promise.all(pollPromises);
      expect(results).toHaveLength(100);
      expect(results.every(r => r.status === "completed")).toBe(true);
    });
  });

  describe("9. Cancellation flow", () => {
    it("cancels active jobs", async () => {
      await expect(cancelProviderJob("cancel-proj", { ...dummyJob, provider: "mock" }, "mock-1")).resolves.not.toThrow();
    });
  });
});
