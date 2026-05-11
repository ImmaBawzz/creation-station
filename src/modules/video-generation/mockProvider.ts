import { access } from "node:fs/promises";

import type { SceneVideoJobResult, SceneVideoState } from "@/modules/video-generation/types";
import { resolveVisualProjectPath } from "@/modules/visual-engine/paths";

function resolveMockDelayMs(): number {
  const rawValue = Number.parseInt(process.env.SCENE_VIDEO_MOCK_DELAY_MS ?? "50", 10);

  if (!Number.isFinite(rawValue) || rawValue < 0) {
    return 50;
  }

  return Math.min(rawValue, 2_000);
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function runMockSceneVideoJob(
  projectId: string,
  job: SceneVideoState["jobs"][number],
): Promise<SceneVideoJobResult> {
  await access(resolveVisualProjectPath(projectId, job.sourceImage));
  await sleep(resolveMockDelayMs());

  return {
    completedAt: new Date().toISOString(),
    placeholderVideoId: `mock-${job.sceneId}`,
    sceneId: job.sceneId,
    startedAt: job.startedAt,
    status: "completed",
  };
}