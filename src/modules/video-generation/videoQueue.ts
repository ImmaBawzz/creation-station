import { normalizeLegacyGenerationPayload, submitProviderJob, pollProviderJob, cancelProviderJob } from "@/modules/provider-runtime";
import {
  readSceneVideoState,
  sceneVideoStateHasPendingJobs,
  writeSceneVideoState,
} from "@/modules/video-generation/sceneVideoManifest";
import type { SceneVideoJobResult, SceneVideoState, SceneVideoProvider } from "@/modules/video-generation/types";
import type { ProviderJobRequest } from "@/modules/provider-runtime";

const activeRunners = new Map<string, Promise<void>>();

const POLL_INTERVAL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 1800000;

function getProviderTimeoutMs(provider: SceneVideoProvider): number {
  switch (provider) {
    case "comfy": return 1200000; // 20 mins
    case "wan": return 2700000;   // 45 mins
    case "kling": return 1800000; // 30 mins
    case "runway": return 1800000;// 30 mins
    default: return DEFAULT_TIMEOUT_MS;
  }
}

function markJobRunning(state: SceneVideoState, sceneId: string, providerJobId?: string): SceneVideoState {
  return {
    ...state,
    jobs: state.jobs.map((job) => {
      if (job.sceneId === sceneId) {
        return {
          ...job,
          error: undefined,
          startedAt: job.startedAt || new Date().toISOString(),
          status: "running",
          providerJobId: providerJobId || job.providerJobId,
          attemptCount: (job.attemptCount || 0) + 1,
        };
      }
      return job;
    }),
  };
}

function toProviderJobRequest(job: SceneVideoState["jobs"][number]): ProviderJobRequest {
  const payload = normalizeLegacyGenerationPayload({
    cameraDirection: job.cameraDirection,
    duration: job.duration,
    prompt: job.motionPrompt,
    referenceAssets: job.referenceAssets,
    sourceImage: job.sourceImage,
  });

  return {
    ...payload,
    id: job.id,
    provider: job.provider,
    sceneId: job.sceneId,
    startedAt: job.startedAt,
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
          providerMetadata: result.providerMetadata,
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

    const runningJob = state.jobs.find((job) => job.status === "running");

    if (runningJob) {
      const startedAt = runningJob.startedAt ? new Date(runningJob.startedAt).getTime() : Date.now();
      const elapsed = Date.now() - startedAt;
      const timeoutMs = getProviderTimeoutMs(runningJob.provider);

      if (elapsed > timeoutMs) {
        if (runningJob.providerJobId) {
          try {
            await cancelProviderJob(projectId, toProviderJobRequest(runningJob), runningJob.providerJobId);
          } catch (e) {
            console.error(`[videoQueue] Failed to cancel timed out job ${runningJob.id}`, e);
          }
        }

        const latestState = await readSceneVideoState(projectId);
        if (latestState) {
          await writeSceneVideoState(mergeJobResult(latestState, {
            completedAt: new Date().toISOString(),
            error: "provider_timeout",
            sceneId: runningJob.sceneId,
            startedAt: runningJob.startedAt,
            status: "failed",
          }));
        }
        continue;
      }

      if (runningJob.providerJobId) {
        try {
          const result = await pollProviderJob(projectId, toProviderJobRequest(runningJob), runningJob.providerJobId);

          if (result.status === "completed" || result.status === "failed") {
            const latestState = await readSceneVideoState(projectId);
            if (latestState) {
              await writeSceneVideoState(mergeJobResult(latestState, result));
            }
            continue;
          }
        } catch (error) {
          const latestState = await readSceneVideoState(projectId);
          if (latestState) {
            await writeSceneVideoState(mergeJobResult(latestState, {
              completedAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : "Polling failed.",
              sceneId: runningJob.sceneId,
              startedAt: runningJob.startedAt,
              status: "failed",
            }));
          }
          continue;
        }
      } else {
        const latestState = await readSceneVideoState(projectId);
        if (latestState) {
          await writeSceneVideoState(mergeJobResult(latestState, {
            completedAt: new Date().toISOString(),
            error: "missing_provider_job_id",
            sceneId: runningJob.sceneId,
            startedAt: runningJob.startedAt,
            status: "failed",
          }));
        }
        continue;
      }
      
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
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

    try {
      const providerJobId = await submitProviderJob(projectId, toProviderJobRequest(nextJob));

      const startedState = await writeSceneVideoState(markJobRunning(state, nextJob.sceneId, providerJobId));
      if (!startedState.jobs.find((job) => job.sceneId === nextJob.sceneId)) {
        return;
      }
    } catch (error) {
      const latestState = await readSceneVideoState(projectId);
      if (latestState) {
        await writeSceneVideoState(mergeJobResult(latestState, {
          completedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Submission failed.",
          sceneId: nextJob.sceneId,
          status: "failed",
        }));
      }
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
