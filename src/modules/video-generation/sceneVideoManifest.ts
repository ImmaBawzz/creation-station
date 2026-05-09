import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SceneVideoJob, SceneVideoProgress, SceneVideoState } from "@/modules/video-generation/types";
import { getVisualProjectAssetFolders } from "@/modules/visual-engine/paths";

const SCENE_ASSETS_FILE = "sceneAssets.json";
const SCENE_PLAN_FILE = "scenePlan.json";
const SCENE_VIDEOS_FILE = "sceneVideos.json";

function normalizeProgress(jobs: SceneVideoJob[]): SceneVideoProgress {
  const completed = jobs.filter((job) => job.status === "completed").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const pending = jobs.filter((job) => job.status === "pending").length;
  const running = jobs.filter((job) => job.status === "running").length;

  return {
    completed,
    failed,
    pending,
    processed: completed + failed,
    running,
    total: jobs.length,
  };
}

function normalizeState(
  state: Omit<SceneVideoState, "progress" | "updatedAt"> & { progress?: SceneVideoProgress; updatedAt?: string },
): SceneVideoState {
  return {
    ...state,
    progress: normalizeProgress(state.jobs),
    updatedAt: new Date().toISOString(),
  };
}

export function getSceneAssetsManifestPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, SCENE_ASSETS_FILE);
}

export function getScenePlanManifestPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, SCENE_PLAN_FILE);
}

export function getSceneVideosManifestPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, SCENE_VIDEOS_FILE);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function hasSceneAssetsManifest(projectId: string): Promise<boolean> {
  return pathExists(getSceneAssetsManifestPath(projectId));
}

export async function hasScenePlanManifest(projectId: string): Promise<boolean> {
  return pathExists(getScenePlanManifestPath(projectId));
}

export async function hasSceneVideosManifest(projectId: string): Promise<boolean> {
  return pathExists(getSceneVideosManifestPath(projectId));
}

export async function readSceneVideoState(projectId: string): Promise<SceneVideoState | null> {
  try {
    const source = await readFile(getSceneVideosManifestPath(projectId), "utf8");
    const payload = JSON.parse(source) as SceneVideoState;

    if (!payload || typeof payload !== "object" || !Array.isArray(payload.jobs)) {
      return null;
    }

    return normalizeState(payload);
  } catch {
    return null;
  }
}

export async function writeSceneVideoState(state: SceneVideoState): Promise<SceneVideoState> {
  const normalized = normalizeState(state);
  const targetPath = getSceneVideosManifestPath(state.projectId);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  return normalized;
}

export function recoverInterruptedSceneVideoState(state: SceneVideoState): SceneVideoState {
  if (state.status !== "running" || !state.jobs.some((job) => job.status === "running")) {
    return state;
  }

  return normalizeState({
    ...state,
    jobs: state.jobs.map((job) => job.status === "running"
      ? {
          ...job,
          error: job.error ?? "Recovered pending scene video job after an interrupted queue runner.",
          status: "pending",
        }
      : job),
    status: "paused",
  });
}

export function sceneVideoStateHasPendingJobs(state: SceneVideoState): boolean {
  return state.jobs.some((job) => job.status === "pending");
}