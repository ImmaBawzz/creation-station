export type SceneVideoProvider = "mock" | "comfy" | "wan" | "kling" | "runway";

export type SceneVideoJobStatus = "pending" | "running" | "completed" | "failed";
export type SceneVideoStateStatus = "idle" | "running" | "paused" | "completed" | "failed";
export type SceneVideoMotionType = "cinematic-drift" | "steady-hold" | "pulse-cut";

export type SceneVideoJob = {
  cameraDirection: string;
  completedAt?: string;
  duration: number;
  error?: string;
  id: string;
  motionPrompt: string;
  motionType: SceneVideoMotionType;
  placeholderVideoId?: string;
  provider: SceneVideoProvider;
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