import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { relativeProjectPath } from "@/modules/visual-engine/manifest";
import { readSceneExecutionState } from "@/modules/scene-execution";
import { readScenePlan, type ScenePlanScene } from "@/modules/scene-planner";
import { buildCameraPlan } from "@/modules/motion-director/cameraLogic";
import { getMotionTemplate, selectMotionTemplate } from "@/modules/motion-director/motionTemplates";
import { buildProviderCompatibilityTags, resolveMotionIntensity } from "@/modules/motion-director/motionIntensity";
import { resolveTransitionType } from "@/modules/motion-director/transitionLogic";
import type { SceneMotionPlan, SceneMotionPlanItem } from "@/modules/motion-director/types";
import { getVisualProjectAssetFolders } from "@/modules/visual-engine/paths";

const SCENE_ASSETS_FILE = "sceneAssets.json";
const SCENE_PLAN_FILE = "scenePlan.json";
const SCENE_MOTION_PLAN_FILE = "sceneMotionPlan.json";

type MotionDirectorError = Error & {
  details?: string[];
  statusCode?: number;
};

function createMotionDirectorError(message: string, statusCode = 400, details?: string[]): MotionDirectorError {
  const error = new Error(message) as MotionDirectorError;
  error.details = details;
  error.statusCode = statusCode;
  return error;
}

function getSceneAssetsPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, SCENE_ASSETS_FILE);
}

function getScenePlanPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, SCENE_PLAN_FILE);
}

export function getSceneMotionPlanPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, SCENE_MOTION_PLAN_FILE);
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeState(state: Omit<SceneMotionPlan, "updatedAt"> & { updatedAt?: string }): SceneMotionPlan {
  return {
    ...state,
    updatedAt: new Date().toISOString(),
  };
}

export async function readSceneMotionPlan(projectId: string): Promise<SceneMotionPlan | null> {
  try {
    const source = await readFile(getSceneMotionPlanPath(projectId), "utf8");
    const payload = JSON.parse(source) as SceneMotionPlan;

    if (!payload || typeof payload !== "object" || !Array.isArray(payload.scenes)) {
      return null;
    }

    return normalizeState(payload);
  } catch {
    return null;
  }
}

async function writeSceneMotionPlan(plan: SceneMotionPlan): Promise<SceneMotionPlan> {
  const normalized = normalizeState(plan);
  const targetPath = getSceneMotionPlanPath(plan.projectId);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  return normalized;
}

function buildSceneMotionPlanItem(
  sceneId: string,
  sourceImage: string,
  scene: ScenePlanScene,
  nextScene?: ScenePlanScene,
): SceneMotionPlanItem {
  const templateKey = selectMotionTemplate(scene);
  const template = getMotionTemplate(templateKey);
  const cameraPlan = buildCameraPlan(scene, template);
  const intensity = resolveMotionIntensity(scene, templateKey);

  return {
    cameraMovement: cameraPlan.cameraMovement,
    duration: Number((scene.endTime - scene.startTime).toFixed(2)),
    endFrameStrategy: cameraPlan.endFrameStrategy,
    environmentalMovement: template.environmentalMovement,
    loopSuitability: intensity.loopSuitability,
    motionIntensity: intensity.motionIntensity,
    pacingScore: intensity.pacingScore,
    providerCompatibilityTags: buildProviderCompatibilityTags(templateKey, intensity),
    sceneId,
    sourceImage,
    startFrameStrategy: cameraPlan.startFrameStrategy,
    subjectMovement: template.subjectMovement,
    templateKey,
    transitionType: resolveTransitionType(scene, nextScene, templateKey),
  };
}

export async function generateSceneMotionPlan(projectId: string): Promise<SceneMotionPlan> {
  if (!await fileExists(getSceneAssetsPath(projectId))) {
    throw createMotionDirectorError(
      "Scene image assets not found. Generate approved scene images before generating a motion plan.",
      404,
      ["sceneAssets.json missing"],
    );
  }

  if (!await fileExists(getScenePlanPath(projectId))) {
    throw createMotionDirectorError(
      "Scene plan not found. Generate a scene plan before generating a motion plan.",
      404,
      ["scenePlan.json missing"],
    );
  }

  const sceneAssetsState = await readSceneExecutionState(projectId);

  if (!sceneAssetsState) {
    throw createMotionDirectorError("Scene image assets manifest could not be read.", 500);
  }

  const scenePlan = await readScenePlan(projectId);

  if (!scenePlan) {
    throw createMotionDirectorError("Scene plan manifest could not be read.", 500);
  }

  const approvedSceneIds = [...new Set(sceneAssetsState.approvedSceneIds.filter((sceneId) => typeof sceneId === "string" && sceneId.length > 0))];

  if (approvedSceneIds.length === 0) {
    throw createMotionDirectorError("No approved scenes available for motion planning.", 400);
  }

  const assetsBySceneId = new Map(sceneAssetsState.assets.map((asset) => [asset.sceneId, asset]));
  const scenes = scenePlan.scenes.filter((scene) => approvedSceneIds.includes(scene.id));

  if (scenes.length === 0) {
    throw createMotionDirectorError("No approved scene plan entries available for motion planning.", 400);
  }

  const missingImages = scenes.filter((scene) => !assetsBySceneId.get(scene.id)?.imagePath).map((scene) => scene.id);

  if (missingImages.length > 0) {
    throw createMotionDirectorError(
      "Motion planning requires generated source images for all approved scenes.",
      400,
      missingImages.map((sceneId) => `Missing source image for: ${sceneId}`),
    );
  }

  const items = scenes.map((scene, index) => buildSceneMotionPlanItem(
    scene.id,
    assetsBySceneId.get(scene.id)?.imagePath ?? "",
    scene,
    scenes[index + 1],
  ));
  const createdAt = new Date().toISOString();

  return writeSceneMotionPlan({
    createdAt,
    projectId,
    scenes: items,
    sourceManifests: {
      sceneAssets: relativeProjectPath(getSceneAssetsPath(projectId)),
      sceneMotionPlan: relativeProjectPath(getSceneMotionPlanPath(projectId)),
      scenePlan: relativeProjectPath(getScenePlanPath(projectId)),
    },
    updatedAt: createdAt,
  });
}

export { buildProviderCompatibilityTags, selectMotionTemplate };
export type { SceneMotionPlan } from "@/modules/motion-director/types";