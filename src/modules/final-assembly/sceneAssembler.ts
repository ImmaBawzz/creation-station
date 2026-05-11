import { access, readdir } from "node:fs/promises";
import path from "node:path";

import { normalizeTransitionStyle } from "@/modules/final-assembly/transitionEngine";
import type { FinalAssemblyScene, FinalAssemblyWarning } from "@/modules/final-assembly/types";
import type { TimelinePlan } from "@/modules/timeline-director/types";
import type { SceneExecutionState } from "@/modules/scene-execution";
import type { ProviderExecutionPlan } from "@/modules/video-generation/governance/types";
import type { SceneVideoState } from "@/modules/video-generation/types";
import { getVisualProjectAssetFolders, resolveVisualProjectPath } from "@/modules/visual-engine/paths";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findSceneVideoPath(projectId: string, sceneId: string, placeholderVideoId?: string): Promise<string | null> {
  const videoFolder = getVisualProjectAssetFolders(projectId).video;

  try {
    const entries = await readdir(videoFolder, { withFileTypes: true });
    const candidate = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".mp4"))
      .find((entry) => entry.name.includes(sceneId) || (placeholderVideoId ? entry.name.includes(placeholderVideoId) : false));

    return candidate ? path.join(videoFolder, candidate.name) : null;
  } catch {
    return null;
  }
}

function removeDuplicateTimelineScenes(timelinePlan: TimelinePlan) {
  const seen = new Set<string>();
  const warnings: FinalAssemblyWarning[] = [];

  const sceneSequencing = timelinePlan.sceneSequencing.filter((scene) => {
    if (seen.has(scene.sceneId)) {
      warnings.push({
        code: "duplicate-scene-removed",
        message: `Removed duplicate timeline occurrence for ${scene.sceneId}.`,
        sceneId: scene.sceneId,
      });
      return false;
    }

    seen.add(scene.sceneId);
    return true;
  });

  return { sceneSequencing, warnings };
}

export async function assembleSceneTimeline({
  projectId,
  providerExecutionPlan,
  sceneExecutionState,
  sceneVideoState,
  timelinePlan,
}: {
  projectId: string;
  providerExecutionPlan: ProviderExecutionPlan;
  sceneExecutionState: SceneExecutionState;
  sceneVideoState: SceneVideoState;
  timelinePlan: TimelinePlan;
}): Promise<{ scenes: FinalAssemblyScene[]; warnings: FinalAssemblyWarning[] }> {
  const warnings: FinalAssemblyWarning[] = [];
  const deduped = removeDuplicateTimelineScenes(timelinePlan);
  warnings.push(...deduped.warnings);

  const assetsBySceneId = new Map(sceneExecutionState.assets.map((asset) => [asset.sceneId, asset]));
  const providerPlanBySceneId = new Map(providerExecutionPlan.scenePlans.map((scene) => [scene.sceneId, scene]));
  const sceneVideoBySceneId = new Map(sceneVideoState.jobs.map((job) => [job.sceneId, job]));
  const scenes: FinalAssemblyScene[] = [];

  for (const [index, scene] of deduped.sceneSequencing.entries()) {
    const sceneVideo = sceneVideoBySceneId.get(scene.sceneId);
    const asset = assetsBySceneId.get(scene.sceneId);
    const providerPlan = providerPlanBySceneId.get(scene.sceneId);
    const videoCandidate = sceneVideo
      ? await findSceneVideoPath(projectId, scene.sceneId, sceneVideo.placeholderVideoId)
      : null;
    const videoIsUsable = Boolean(videoCandidate && await pathExists(videoCandidate));
    const fallbackImage = asset?.imagePath
      ? resolveVisualProjectPath(projectId, asset.imagePath)
      : resolveVisualProjectPath(projectId, scene.sourceImage);

    if (!videoIsUsable) {
      warnings.push({
        code: videoCandidate ? "corrupted-clip-fallback" : "missing-scene-fallback",
        message: videoCandidate
          ? `Falling back to source image for ${scene.sceneId} because the scene clip is unavailable or unreadable.`
          : `Falling back to source image for ${scene.sceneId} because no scene clip exists yet.`,
        sceneId: scene.sceneId,
      });
    }

    const expectedDuration = Number(scene.adjustedDuration.toFixed(2));
    const correctedDuration = sceneVideo && Math.abs(sceneVideo.duration - expectedDuration) > 0.05
      ? expectedDuration
      : expectedDuration;

    if (sceneVideo && Math.abs(sceneVideo.duration - expectedDuration) > 0.05) {
      warnings.push({
        code: "duration-mismatch-corrected",
        message: `Corrected ${scene.sceneId} from ${sceneVideo.duration.toFixed(2)}s to ${expectedDuration.toFixed(2)}s to match the timeline plan.`,
        sceneId: scene.sceneId,
      });
    }

    scenes.push({
      correctedDuration,
      expectedDuration,
      fallbackReason: videoIsUsable ? undefined : "source-image",
      isFallback: !videoIsUsable,
      providerId: providerPlan?.primaryProvider ?? "local-mock",
      sceneId: scene.sceneId,
      sourceKind: videoIsUsable ? "scene-video" : "fallback-image",
      sourcePath: videoIsUsable ? path.relative(process.cwd(), videoCandidate as string).replace(/\\/g, "/") : scene.sourceImage,
      timelineOrder: index,
      transition: normalizeTransitionStyle(scene.transitionStyle),
    });
  }

  return { scenes, warnings };
}