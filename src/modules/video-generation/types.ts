import type { BaseGenerationPayload, GenerationReferenceAsset, ProviderType } from "@/modules/provider-runtime/types";

export type SceneVideoProvider = ProviderType;

export type SceneVideoJobStatus = "pending" | "running" | "completed" | "failed";
export type SceneVideoStateStatus = "idle" | "running" | "paused" | "completed" | "failed";
export type SceneVideoMotionType = "cinematic-drift" | "steady-hold" | "pulse-cut";

export type SceneVideoJob = Required<Pick<BaseGenerationPayload, "cameraDirection" | "duration">> & {
  completedAt?: string;
  error?: string;
  id: string;
  motionPrompt: string;
  motionType: SceneVideoMotionType;
  placeholderVideoId?: string;
  provider: SceneVideoProvider;
  providerJobId?: string;
  attemptCount?: number;
  referenceAssets?: GenerationReferenceAsset[];
  sceneId: string;
  sourceImage: string;
  startedAt?: string;
  status: SceneVideoJobStatus;
};

export type SceneVideoProgress = {
  completed: number;
  failed: number;
  pending: number;
  processed: number;
  running: number;
  total: number;
};

export type SceneVideoState = {
  approvedSceneIds: string[];
  createdAt: string;
  jobs: SceneVideoJob[];
  progress: SceneVideoProgress;
  projectId: string;
  provider: SceneVideoProvider;
  sourceManifests: {
    sceneAssets: string;
    scenePlan: string;
    sceneVideos: string;
  };
  status: SceneVideoStateStatus;
  updatedAt: string;
};

export type SceneVideoJobResult = {
  completedAt?: string;
  error?: string;
  placeholderVideoId?: string;
  sceneId: string;
  startedAt?: string;
  status: SceneVideoJobStatus;
};
