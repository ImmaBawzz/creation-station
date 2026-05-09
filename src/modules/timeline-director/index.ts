import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { readSceneMotionPlan } from "@/modules/motion-director";
import type { SceneMotionPlanItem } from "@/modules/motion-director/types";
import { readScenePlan, type ScenePlanScene } from "@/modules/scene-planner";
import { assignClimaxes } from "@/modules/timeline-director/climaxEngine";
import { balanceRuntime, buildSceneSequence } from "@/modules/timeline-director/continuityEngine";
import { buildPacingMap, buildPacingSeeds } from "@/modules/timeline-director/pacingEngine";
import { buildTransitions } from "@/modules/timeline-director/transitionEngine";
import type { TimelinePlan } from "@/modules/timeline-director/types";
import { relativeProjectPath } from "@/modules/visual-engine/manifest";
import { getVisualProjectAssetFolders } from "@/modules/visual-engine/paths";
import type { VisualEngineLyricsLine } from "@/modules/visual-engine/types";
import { readSceneVideoState } from "@/modules/video-generation/sceneVideoManifest";

const ALIGNED_LYRICS_FILE = "lyrics-aligned.json";
const FALLBACK_LYRICS_FILE = "lyrics.json";
const SCENE_MOTION_PLAN_FILE = "sceneMotionPlan.json";
const SCENE_PLAN_FILE = "scenePlan.json";
const SCENE_VIDEOS_FILE = "sceneVideos.json";
const TIMELINE_PLAN_FILE = "timelinePlan.json";

type TimelineDirectorError = Error & {
  details?: string[];
  statusCode?: number;
};

function createTimelineDirectorError(message: string, statusCode = 400, details?: string[]): TimelineDirectorError {
  const error = new Error(message) as TimelineDirectorError;
  error.details = details;
  error.statusCode = statusCode;
  return error;
}

function getTimelinePlanPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, TIMELINE_PLAN_FILE);
}

function getScenePlanPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, SCENE_PLAN_FILE);
}

function getSceneMotionPlanPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, SCENE_MOTION_PLAN_FILE);
}

function getSceneVideosPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, SCENE_VIDEOS_FILE);
}

function getAlignedLyricsPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, ALIGNED_LYRICS_FILE);
}

function getFallbackLyricsPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, FALLBACK_LYRICS_FILE);
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizePlan(plan: Omit<TimelinePlan, "updatedAt"> & { updatedAt?: string }): TimelinePlan {
  return {
    ...plan,
    updatedAt: new Date().toISOString(),
  };
}

async function readLyricsTiming(projectId: string): Promise<{ path: string; lines: VisualEngineLyricsLine[] }> {
  const alignedPath = getAlignedLyricsPath(projectId);
  const fallbackPath = getFallbackLyricsPath(projectId);

  if (await fileExists(alignedPath)) {
    const payload = JSON.parse(await readFile(alignedPath, "utf8")) as { lines?: VisualEngineLyricsLine[] };

    if (Array.isArray(payload.lines)) {
      return { lines: payload.lines, path: alignedPath };
    }
  }

  if (await fileExists(fallbackPath)) {
    const payload = JSON.parse(await readFile(fallbackPath, "utf8")) as { lines?: VisualEngineLyricsLine[] };

    if (Array.isArray(payload.lines)) {
      return { lines: payload.lines, path: fallbackPath };
    }
  }

  throw createTimelineDirectorError(
    "Lyrics timing metadata not found. Generate lyrics timing before creating a timeline plan.",
    404,
    ["lyrics timing metadata missing"],
  );
}

export async function readTimelinePlan(projectId: string): Promise<TimelinePlan | null> {
  try {
    const source = await readFile(getTimelinePlanPath(projectId), "utf8");
    const payload = JSON.parse(source) as TimelinePlan;

    if (!payload || typeof payload !== "object" || !Array.isArray(payload.sceneSequencing) || !Array.isArray(payload.transitions)) {
      return null;
    }

    return normalizePlan(payload);
  } catch {
    return null;
  }
}

async function writeTimelinePlan(plan: TimelinePlan): Promise<TimelinePlan> {
  const normalized = normalizePlan(plan);
  const targetPath = getTimelinePlanPath(plan.projectId);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  return normalized;
}

function resolveSongDuration(lines: VisualEngineLyricsLine[], scenes: ScenePlanScene[]): number {
  const lastLineEnd = lines.at(-1)?.end ?? 0;
  const lastSceneEnd = scenes.at(-1)?.endTime ?? 0;

  return Number(Math.max(lastLineEnd, lastSceneEnd).toFixed(2));
}

function validateSceneOrder(scenes: ScenePlanScene[]): ScenePlanScene[] {
  return [...scenes].sort((left, right) => left.startTime - right.startTime);
}

function filterApprovedScenes(
  orderedScenes: ScenePlanScene[],
  motionItems: SceneMotionPlanItem[],
  sceneVideoIds: Set<string>,
): ScenePlanScene[] {
  const motionIds = new Set(motionItems.map((item) => item.sceneId));

  return orderedScenes.filter((scene) => motionIds.has(scene.id) && sceneVideoIds.has(scene.id));
}

function applySceneRuntimeDurations(
  scenes: ScenePlanScene[],
  sceneVideoDurations: Map<string, number>,
) {
  return scenes.map((scene) => ({
    ...scene,
    endTime: Number((scene.startTime + (sceneVideoDurations.get(scene.id) ?? (scene.endTime - scene.startTime))).toFixed(2)),
  }));
}

export async function generateTimelinePlan(projectId: string): Promise<TimelinePlan> {
  if (!await fileExists(getScenePlanPath(projectId))) {
    throw createTimelineDirectorError("Scene plan not found. Generate a scene plan before creating a timeline plan.", 404, ["scenePlan.json missing"]);
  }

  if (!await fileExists(getSceneMotionPlanPath(projectId))) {
    throw createTimelineDirectorError("Scene motion plan not found. Generate a motion plan before creating a timeline plan.", 404, ["sceneMotionPlan.json missing"]);
  }

  if (!await fileExists(getSceneVideosPath(projectId))) {
    throw createTimelineDirectorError("Scene video manifest not found. Generate scene videos before creating a timeline plan.", 404, ["sceneVideos.json missing"]);
  }

  const scenePlan = await readScenePlan(projectId);
  const motionPlan = await readSceneMotionPlan(projectId);
  const sceneVideos = await readSceneVideoState(projectId);
  const lyricsTiming = await readLyricsTiming(projectId);

  if (!scenePlan) {
    throw createTimelineDirectorError("Scene plan manifest could not be read.", 500);
  }

  if (!motionPlan) {
    throw createTimelineDirectorError("Scene motion plan manifest could not be read.", 500);
  }

  if (!sceneVideos) {
    throw createTimelineDirectorError("Scene video manifest could not be read.", 500);
  }

  const completedVideoIds = new Set(sceneVideos.jobs.filter((job) => job.status === "completed").map((job) => job.sceneId));
  const sceneVideoDurations = new Map(sceneVideos.jobs.map((job) => [job.sceneId, job.duration]));
  const orderedScenes = validateSceneOrder(scenePlan.scenes);
  const usableScenes = applySceneRuntimeDurations(
    filterApprovedScenes(orderedScenes, motionPlan.scenes, completedVideoIds),
    sceneVideoDurations,
  );

  if (usableScenes.length === 0) {
    throw createTimelineDirectorError("No completed scene video outputs are available for timeline generation.", 400);
  }

  const seeds = buildPacingSeeds(usableScenes);
  const initialPacingMap = buildPacingMap(seeds);
  const initialSequence = buildSceneSequence(initialPacingMap, motionPlan.scenes);
  const songDuration = resolveSongDuration(lyricsTiming.lines, orderedScenes);
  const balanced = balanceRuntime(initialSequence, songDuration);
  const climaxResult = assignClimaxes(usableScenes, balanced.sequence);
  const transitions = buildTransitions(climaxResult.sequence, motionPlan.scenes);
  const pacingMap = climaxResult.sequence.map((item) => ({
    duration: item.adjustedDuration,
    endTime: item.endTime,
    pacingScore: item.pacingScore,
    sceneId: item.sceneId,
    sectionKind: item.sectionKind,
    startTime: item.startTime,
  }));
  const createdAt = new Date().toISOString();

  return writeTimelinePlan({
    climaxMap: climaxResult.climaxMap,
    createdAt,
    pacingMap,
    projectId,
    runtimeBalanceStrategy: balanced.runtimeBalanceStrategy,
    sceneSequencing: climaxResult.sequence.map((item) => ({
      ...item,
      transitionStyle: transitions.find((transition) => transition.fromSceneId === item.sceneId)?.transitionStyle ?? item.transitionStyle,
    })),
    sourceManifests: {
      lyricsTiming: relativeProjectPath(lyricsTiming.path),
      sceneMotionPlan: relativeProjectPath(getSceneMotionPlanPath(projectId)),
      scenePlan: relativeProjectPath(getScenePlanPath(projectId)),
      sceneVideos: relativeProjectPath(getSceneVideosPath(projectId)),
      timelinePlan: relativeProjectPath(getTimelinePlanPath(projectId)),
    },
    totalRuntime: balanced.totalRuntime,
    transitions,
    updatedAt: createdAt,
  });
}

export type { TimelinePlan } from "@/modules/timeline-director/types";