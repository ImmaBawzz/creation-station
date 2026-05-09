import { relativeProjectPath } from "@/modules/visual-engine/manifest";
import { readSceneExecutionState } from "@/modules/scene-execution";
import { readScenePlan, type ScenePlanScene } from "@/modules/scene-planner";
import {
  getSceneAssetsManifestPath,
  getScenePlanManifestPath,
  getSceneVideosManifestPath,
  hasSceneAssetsManifest,
  hasScenePlanManifest,
  readSceneVideoState,
  recoverInterruptedSceneVideoState,
  sceneVideoStateHasPendingJobs,
  writeSceneVideoState,
} from "@/modules/video-generation/sceneVideoManifest";
import type {
  SceneVideoJob,
  SceneVideoMotionType,
  SceneVideoState,
} from "@/modules/video-generation/types";
import { ensureSceneVideoRunner, hasActiveSceneVideoRunner } from "@/modules/video-generation/videoQueue";

type SceneVideoError = Error & {
  details?: string[];
  statusCode?: number;
};

function createSceneVideoError(message: string, statusCode = 400, details?: string[]): SceneVideoError {
  const error = new Error(message) as SceneVideoError;
  error.details = details;
  error.statusCode = statusCode;
  return error;
}

function detectMotionType(scene: ScenePlanScene): SceneVideoMotionType {
  const signal = `${scene.generationType} ${scene.emotionalTone} ${scene.cameraDirection}`.toLowerCase();

  if (scene.generationType === "peak" || scene.generationType === "chorus" || /surge|rush|whip|pulse|fast|kinetic/.test(signal)) {
    return "pulse-cut";
  }

  if (/push|track|glide|drift|dolly|sweep|pan/.test(signal)) {
    return "cinematic-drift";
  }

  return "steady-hold";
}

function buildMotionPrompt(scene: ScenePlanScene, motionType: SceneVideoMotionType): string {
  const motionLabel = motionType.replace(/-/g, " ");
  const lyricCue = scene.lyricSegment ? `Lyric cue: ${scene.lyricSegment}.` : "Instrumental transition.";

  return `${scene.cameraDirection}. Maintain the source frame while using ${motionLabel} motion. Emotional tone: ${scene.emotionalTone}. ${lyricCue}`;
}

function buildPlannedState({
  approvedSceneIds,
  jobs,
  projectId,
}: {
  approvedSceneIds: string[];
  jobs: SceneVideoJob[];
  projectId: string;
}): SceneVideoState {
  const createdAt = new Date().toISOString();

  return {
    approvedSceneIds,
    createdAt,
    jobs,
    progress: {
      completed: 0,
      failed: 0,
      pending: jobs.length,
      processed: 0,
      running: 0,
      total: jobs.length,
    },
    projectId,
    provider: "mock",
    sourceManifests: {
      sceneAssets: relativeProjectPath(getSceneAssetsManifestPath(projectId)),
      scenePlan: relativeProjectPath(getScenePlanManifestPath(projectId)),
      sceneVideos: relativeProjectPath(getSceneVideosManifestPath(projectId)),
    },
    status: "idle",
    updatedAt: createdAt,
  };
}

async function buildSceneVideoPlanState(projectId: string): Promise<SceneVideoState> {
  if (!await hasSceneAssetsManifest(projectId)) {
    throw createSceneVideoError(
      "Scene image assets not found. Generate approved scene images before planning scene videos.",
      404,
      ["sceneAssets.json missing"],
    );
  }

  if (!await hasScenePlanManifest(projectId)) {
    throw createSceneVideoError(
      "Scene plan not found. Generate a scene plan before planning scene videos.",
      404,
      ["scenePlan.json missing"],
    );
  }

  const sceneAssetsState = await readSceneExecutionState(projectId);

  if (!sceneAssetsState) {
    throw createSceneVideoError("Scene image assets manifest could not be read.", 500);
  }

  const scenePlan = await readScenePlan(projectId);

  if (!scenePlan) {
    throw createSceneVideoError("Scene plan manifest could not be read.", 500);
  }

  const approvedSceneIds = [...new Set(sceneAssetsState.approvedSceneIds.filter((sceneId) => typeof sceneId === "string" && sceneId.length > 0))];

  if (approvedSceneIds.length === 0) {
    throw createSceneVideoError("No approved scenes available for scene video generation.", 400);
  }

  const assetsBySceneId = new Map(sceneAssetsState.assets.map((asset) => [asset.sceneId, asset]));
  const scenesById = new Map(scenePlan.scenes.map((scene) => [scene.id, scene]));
  const missingImages: string[] = [];
  const missingScenes: string[] = [];
  const jobs: SceneVideoJob[] = [];

  for (const sceneId of approvedSceneIds) {
    const asset = assetsBySceneId.get(sceneId);
    const scene = scenesById.get(sceneId);

    if (!scene) {
      missingScenes.push(sceneId);
      continue;
    }

    if (!asset?.imagePath) {
      missingImages.push(sceneId);
      continue;
    }

    const motionType = detectMotionType(scene);

    jobs.push({
      cameraDirection: scene.cameraDirection,
      duration: Number((scene.endTime - scene.startTime).toFixed(2)),
      id: scene.id,
      motionPrompt: buildMotionPrompt(scene, motionType),
      motionType,
      provider: "mock",
      sceneId: scene.id,
      sourceImage: asset.imagePath,
      status: "pending",
    });
  }

  if (missingScenes.length > 0) {
    throw createSceneVideoError(
      "Scene video planning requires matching scene plan entries for approved scenes.",
      400,
      missingScenes.map((sceneId) => `Missing scene plan entry: ${sceneId}`),
    );
  }

  if (missingImages.length > 0) {
    throw createSceneVideoError(
      "Scene video planning requires generated image assets for all approved scenes.",
      400,
      missingImages.map((sceneId) => `Missing source image for: ${sceneId}`),
    );
  }

  return buildPlannedState({ approvedSceneIds, jobs, projectId });
}

export async function planSceneVideos(projectId: string): Promise<SceneVideoState> {
  const existing = await readSceneVideoState(projectId);

  if (existing?.status === "running" && hasActiveSceneVideoRunner(projectId)) {
    throw createSceneVideoError("A scene video queue is already active for this project.", 409);
  }

  return writeSceneVideoState(await buildSceneVideoPlanState(projectId));
}

export async function runSceneVideoGeneration(projectId: string): Promise<SceneVideoState> {
  let state = await readSceneVideoState(projectId);

  if (!state) {
    state = await planSceneVideos(projectId);
  }

  if (state.status === "running" && hasActiveSceneVideoRunner(projectId)) {
    return state;
  }

  if (state.status === "running" && !hasActiveSceneVideoRunner(projectId)) {
    state = await writeSceneVideoState(recoverInterruptedSceneVideoState(state));
  }

  if (!sceneVideoStateHasPendingJobs(state)) {
    const nextStatus = state.jobs.some((job) => job.status === "failed") ? "failed" : "completed";

    if (state.status !== nextStatus) {
      state = await writeSceneVideoState({
        ...state,
        status: nextStatus,
      });
    }

    return state;
  }

  const runningState = await writeSceneVideoState({
    ...state,
    status: "running",
  });

  ensureSceneVideoRunner(projectId);
  return runningState;
}

export async function getSceneVideoGenerationState(projectId: string): Promise<SceneVideoState | null> {
  const state = await readSceneVideoState(projectId);

  if (!state) {
    return null;
  }

  if (state.status === "running" && !hasActiveSceneVideoRunner(projectId)) {
    return writeSceneVideoState(recoverInterruptedSceneVideoState(state));
  }

  return state;
}

export type { SceneVideoJob, SceneVideoState } from "@/modules/video-generation/types";