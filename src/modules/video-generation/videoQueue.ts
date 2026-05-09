import { runMockSceneVideoJob } from "@/modules/video-generation/mockProvider";
import {
  readSceneVideoState,
  sceneVideoStateHasPendingJobs,
  writeSceneVideoState,
} from "@/modules/video-generation/sceneVideoManifest";
import type { SceneVideoJobResult, SceneVideoState } from "@/modules/video-generation/types";

const activeRunners = new Map<string, Promise<void>>();

function markJobRunning(state: SceneVideoState, sceneId: string): SceneVideoState {
  return {
    ...state,
    jobs: state.jobs.map((job) => job.sceneId === sceneId
      ? {
          ...job,
          error: undefined,
          startedAt: new Date().toISOString(),
          status: "running",
        }
      : job),
  };
}

function mergeJobResult(state: SceneVideoState, result: SceneVideoJobResult): SceneVideoState {
  return {
    ...state,
    jobs: state.jobs.map((job) => job.sceneId === result.sceneId
      ? {
          ...job,
          completedAt: result.completedAt,
          error: result.error,
          placeholderVideoId: result.placeholderVideoId,
          startedAt: result.startedAt ?? job.startedAt,
          status: result.status,
        }
      : job),
  };
}

async function runSceneVideoQueue(projectId: string): Promise<void> {
  while (true) {
    const state = await readSceneVideoState(projectId);

    if (!state || state.status !== "running") {
      return;
    }

    if (!sceneVideoStateHasPendingJobs(state)) {
      await writeSceneVideoState({
        ...state,
        status: state.jobs.some((job) => job.status === "failed") ? "failed" : "completed",
      });
      return;
    }

    const nextJob = state.jobs.find((job) => job.status === "pending");

    if (!nextJob) {
      await writeSceneVideoState({
        ...state,
        status: state.jobs.some((job) => job.status === "failed") ? "failed" : "completed",
      });
      return;
    }

    const startedState = await writeSceneVideoState(markJobRunning(state, nextJob.sceneId));
    const startedJob = startedState.jobs.find((job) => job.sceneId === nextJob.sceneId);

    if (!startedJob) {
      return;
    }

    try {
      const result = await runMockSceneVideoJob(projectId, startedJob);
      const latestState = await readSceneVideoState(projectId);

      if (!latestState) {
        return;
      }

      await writeSceneVideoState(mergeJobResult(latestState, result));
    } catch (error) {
      const latestState = await readSceneVideoState(projectId);

      if (!latestState) {
        return;
      }

      await writeSceneVideoState(mergeJobResult(latestState, {
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Mock video generation failed.",
        sceneId: nextJob.sceneId,
        startedAt: startedJob.startedAt,
        status: "failed",
      }));
    }
  }
}

export function hasActiveSceneVideoRunner(projectId: string): boolean {
  return activeRunners.has(projectId);
}

export function ensureSceneVideoRunner(projectId: string): void {
  if (activeRunners.has(projectId)) {
    return;
  }

  const promise = runSceneVideoQueue(projectId)
    .finally(() => {
      activeRunners.delete(projectId);
    });

  activeRunners.set(projectId, promise);
}