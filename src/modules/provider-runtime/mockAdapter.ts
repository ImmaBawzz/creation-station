import { runMockSceneVideoJob } from "@/modules/video-generation/mockProvider";
import type { ProviderAdapter, ProviderJobRequest, ProviderJobResult } from "./types";
import type { SceneVideoState } from "@/modules/video-generation/types";

export const mockAdapter: ProviderAdapter = {
  async execute(projectId: string, job: ProviderJobRequest): Promise<ProviderJobResult> {
    // Map the ProviderJobRequest back to a shape that runMockSceneVideoJob expects
    const mockJob: SceneVideoState["jobs"][number] = {
      ...job,
      cameraDirection: "none",
      motionPrompt: job.prompt,
      status: "running"
    } as unknown as SceneVideoState["jobs"][number];
    
    const result = await runMockSceneVideoJob(projectId, mockJob);
    
    return {
      status: result.status,
      completedAt: result.completedAt,
      error: result.error,
      placeholderVideoId: result.placeholderVideoId,
      sceneId: result.sceneId,
      startedAt: result.startedAt,
    };
  },
  
  async checkHealth(): Promise<boolean> {
    return true;
  }
};
