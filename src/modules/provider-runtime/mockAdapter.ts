import { runMockSceneVideoJob } from "@/modules/video-generation/mockProvider";
import { getPrimaryReferenceAssetPath } from "./types";
import type { ProviderAdapter, ProviderHealthState, ProviderJobRequest, ProviderJobResult } from "./types";
import type { SceneVideoState } from "@/modules/video-generation/types";

// In-memory store for mock jobs since runMockSceneVideoJob is sync-ish 
// (it sleeps internally but doesn't expose a pollable id).
// For the new submit/poll contract, we'll wrap it.
const mockJobStore = new Map<string, Promise<ProviderJobResult>>();

export const mockAdapter: ProviderAdapter = {
  providerId: "mock",

  validateConfig(): boolean {
    return true; // Mock is always valid
  },

  estimateCost(_job: ProviderJobRequest): number {
    return 0; // Mock is free
  },

  async checkHealth(): Promise<ProviderHealthState> {
    return "healthy"; // Mock is always healthy
  },

  async submitJob(projectId: string, job: ProviderJobRequest): Promise<string> {
    const mockJobId = `mock-job-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const sourceImage = getPrimaryReferenceAssetPath(job) ?? "";
    
    const mockJob: SceneVideoState["jobs"][number] = {
      cameraDirection: job.cameraDirection ?? "none",
      duration: job.duration,
      id: job.id,
      motionPrompt: job.prompt,
      motionType: "steady-hold",
      provider: job.provider,
      referenceAssets: job.referenceAssets ?? [],
      sceneId: job.sceneId,
      sourceImage,
      startedAt: job.startedAt,
      status: "running",
    };
    
    // Start it and store the promise
    const promise = runMockSceneVideoJob(projectId, mockJob).then(result => ({
      status: result.status,
      completedAt: result.completedAt,
      error: result.error,
      placeholderVideoId: result.placeholderVideoId,
      sceneId: result.sceneId,
      startedAt: result.startedAt,
    }));
    
    mockJobStore.set(mockJobId, promise);
    return mockJobId;
  },

  async pollJob(_projectId: string, jobId: string): Promise<ProviderJobResult> {
    const promise = mockJobStore.get(jobId);
    if (!promise) {
      throw new Error(`Job ${jobId} not found in mock adapter`);
    }
    
    // We await the promise which resolves when the mock sleep completes
    const result = await promise;
    // Clean up
    mockJobStore.delete(jobId);
    return result;
  }
};
