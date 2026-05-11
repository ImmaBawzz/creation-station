import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ComfyClient, resolveComfyPollIntervalMs, resolveComfyTimeoutMs } from "@/modules/comfy/client";
import { importComfyOutputToProject } from "@/modules/comfy/importOutput";
import { queueComfyImageJob, type SupportedComfyWorkflowType } from "@/modules/comfy/queue";
import { validateComfyGenerationRequest } from "@/modules/comfy/validate";
import { validateComfyWorkflow } from "@/modules/comfy/workflows";
import { readScenePlan, type ScenePlan, type ScenePlanPriority, type ScenePlanScene } from "@/modules/scene-planner";
import { relativeProjectPath } from "@/modules/visual-engine/manifest";
import { getVisualProjectAssetFolders } from "@/modules/visual-engine/paths";

const SCENE_ASSETS_FILE = "sceneAssets.json";
const activeRunners = new Map<string, Promise<void>>();

export type SceneExecutionItemStatus = "pending" | "generating" | "completed" | "failed" | "skipped";
export type SceneExecutionStatus = "idle" | "running" | "paused" | "cancelling" | "cancelled" | "completed";

export type SceneExecutionAsset = {
  attempts: number;
  completedAt?: string;
  error?: string;
  id: string;
  imagePath?: string;
  manifestPath?: string;
  priority: ScenePlanPriority;
  prompt: string;
  promptId?: string;
  retryLimit: number;
  sceneId: string;
  startedAt?: string;
  status: SceneExecutionItemStatus;
  workflowType: SupportedComfyWorkflowType;
};

export type SceneExecutionProgress = {
  completed: number;
  failed: number;
  generating: number;
  processed: number;
  skipped: number;
  total: number;
};

export type SceneExecutionState = {
  approvedSceneIds: string[];
  assets: SceneExecutionAsset[];
  concurrency: number;
  createdAt: string;
  negativePrompt: string;
  progress: SceneExecutionProgress;
  projectId: string;
  status: SceneExecutionStatus;
  updatedAt: string;
};

type SceneExecutionError = Error & {
  details?: string[];
  statusCode?: number;
};

type SceneExecutionResult = {
  attempts: number;
  completedAt?: string;
  error?: string;
  imagePath?: string;
  manifestPath?: string;
  promptId?: string;
  sceneId: string;
  startedAt?: string;
  status: SceneExecutionItemStatus;
};

function createSceneExecutionError(message: string, statusCode = 400, details?: string[]): SceneExecutionError {
  const error = new Error(message) as SceneExecutionError;
  error.details = details;
  error.statusCode = statusCode;
  return error;
}

function getSceneAssetsPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, SCENE_ASSETS_FILE);
}

function buildScenePrompt(scene: ScenePlanScene): string {
  return [
    scene.visualDescription,
    scene.cameraDirection,
    scene.lyricSegment ? `Lyric cue: ${scene.lyricSegment}.` : "Instrumental transition frame.",
  ].join(" ");
}

function normalizeProgress(assets: SceneExecutionAsset[]): SceneExecutionProgress {
  const completed = assets.filter((asset) => asset.status === "completed").length;
  const failed = assets.filter((asset) => asset.status === "failed").length;
  const generating = assets.filter((asset) => asset.status === "generating").length;
  const skipped = assets.filter((asset) => asset.status === "skipped").length;

  return {
    completed,
    failed,
    generating,
    processed: completed + failed + skipped,
    skipped,
    total: assets.length,
  };
}

function normalizeState(state: Omit<SceneExecutionState, "progress" | "updatedAt"> & { progress?: SceneExecutionProgress; updatedAt?: string }): SceneExecutionState {
  return {
    ...state,
    progress: normalizeProgress(state.assets),
    updatedAt: new Date().toISOString(),
  };
}

function resolveSceneExecutionMaxConcurrency(): number {
  const rawValue = Number.parseInt(process.env.SCENE_EXECUTION_MAX_CONCURRENCY ?? "1", 10);

  if (!Number.isFinite(rawValue) || rawValue < 1) {
    return 1;
  }

  return Math.min(rawValue, 4);
}

function resolveSceneExecutionConcurrency(requestedConcurrency?: number): number {
  const maxConcurrency = resolveSceneExecutionMaxConcurrency();

  if (!Number.isFinite(requestedConcurrency) || !requestedConcurrency || requestedConcurrency < 1) {
    return 1;
  }

  return Math.min(Math.floor(requestedConcurrency), maxConcurrency);
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function isTerminalExecutionStatus(status: SceneExecutionStatus): boolean {
  return status === "cancelled" || status === "completed";
}

function buildInitialExecutionState({
  approvedSceneIds,
  concurrency,
  negativePrompt,
  plan,
  projectId,
}: {
  approvedSceneIds: string[];
  concurrency?: number;
  negativePrompt: string;
  plan: ScenePlan;
  projectId: string;
}): SceneExecutionState {
  const approved = new Set(approvedSceneIds);
  const createdAt = new Date().toISOString();
  const assets = plan.scenes.map((scene) => ({
    attempts: 0,
    id: scene.id,
    priority: scene.priority,
    prompt: buildScenePrompt(scene),
    retryLimit: 1,
    sceneId: scene.id,
    status: approved.has(scene.id) ? "pending" : "skipped",
    workflowType: scene.workflowType,
  } satisfies SceneExecutionAsset));

  return normalizeState({
    approvedSceneIds: [...approved],
    assets,
    concurrency: resolveSceneExecutionConcurrency(concurrency),
    createdAt,
    negativePrompt,
    projectId,
    status: assets.some((asset) => asset.status === "pending") ? "running" : "completed",
  });
}

export async function readSceneExecutionState(projectId: string): Promise<SceneExecutionState | null> {
  try {
    const source = await readFile(getSceneAssetsPath(projectId), "utf8");
    const payload = JSON.parse(source) as SceneExecutionState;

    if (!payload || typeof payload !== "object" || !Array.isArray(payload.assets)) {
      return null;
    }

    return normalizeState(payload);
  } catch {
    return null;
  }
}

async function writeSceneExecutionState(state: SceneExecutionState): Promise<SceneExecutionState> {
  const normalized = normalizeState(state);
  const targetPath = getSceneAssetsPath(state.projectId);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  return normalized;
}

function markPendingScenesSkipped(state: SceneExecutionState, reason: string): SceneExecutionState {
  return normalizeState({
    ...state,
    assets: state.assets.map((asset) => asset.status === "pending"
      ? {
          ...asset,
          completedAt: asset.completedAt ?? new Date().toISOString(),
          error: reason,
          status: "skipped",
        }
      : asset),
  });
}

function recoverInterruptedGeneratingScenes(state: SceneExecutionState): SceneExecutionState {
  if (!state.assets.some((asset) => asset.status === "generating")) {
    return state;
  }

  return normalizeState({
    ...state,
    assets: state.assets.map((asset) => asset.status === "generating"
      ? {
          ...asset,
          error: asset.error ?? "Recovered pending scene after an interrupted batch runner.",
          status: "pending",
        }
      : asset),
  });
}

export async function executeSceneAssetWithRetry({
  asset,
  executeScene,
  validateScene,
}: {
  asset: SceneExecutionAsset;
  executeScene: (attempt: number) => Promise<{ imagePath: string; manifestPath: string; promptId: string }>;
  validateScene: () => Promise<string | null>;
}): Promise<SceneExecutionResult> {
  const skipReason = await validateScene();

  if (skipReason) {
    return {
      attempts: asset.attempts,
      completedAt: new Date().toISOString(),
      error: skipReason,
      sceneId: asset.sceneId,
      startedAt: asset.startedAt,
      status: "skipped",
    };
  }

  let attempts = asset.attempts;
  const maxAttempts = asset.retryLimit + 1;
  let lastError = "Scene execution failed.";

  while (attempts <= maxAttempts) {
    try {
      const generated = await executeScene(attempts);

      return {
        attempts,
        completedAt: new Date().toISOString(),
        imagePath: generated.imagePath,
        manifestPath: generated.manifestPath,
        promptId: generated.promptId,
        sceneId: asset.sceneId,
        startedAt: asset.startedAt,
        status: "completed",
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Scene execution failed.";

      if (attempts >= maxAttempts) {
        return {
          attempts,
          completedAt: new Date().toISOString(),
          error: lastError,
          sceneId: asset.sceneId,
          startedAt: asset.startedAt,
          status: "failed",
        };
      }

      attempts += 1;
    }
  }

  return {
    attempts,
    completedAt: new Date().toISOString(),
    error: lastError,
    sceneId: asset.sceneId,
    startedAt: asset.startedAt,
    status: "failed",
  };
}

async function waitForScenePromptCompletion(client: ComfyClient, promptId: string): Promise<void> {
  const startedAt = Date.now();
  const timeoutMs = resolveComfyTimeoutMs();
  const pollIntervalMs = resolveComfyPollIntervalMs();

  while (Date.now() - startedAt <= timeoutMs) {
    const status = await client.getPromptRuntimeStatus(promptId);

    if (status === "completed") {
      return;
    }

    if (status === "failed") {
      throw createSceneExecutionError(`Scene generation failed for prompt ${promptId}.`, 502);
    }

    await sleep(pollIntervalMs);
  }

  throw createSceneExecutionError(`Scene generation timed out after ${timeoutMs}ms.`, 504);
}

async function runSceneAsset(projectId: string, asset: SceneExecutionAsset, negativePrompt: string): Promise<SceneExecutionResult> {
  return executeSceneAssetWithRetry({
    asset,
    executeScene: async () => {
      const client = new ComfyClient();
      await validateComfyGenerationRequest({
        client,
        projectId,
        workflowType: asset.workflowType,
      });

      const job = await queueComfyImageJob({
        client,
        negativePrompt,
        projectId,
        prompt: asset.prompt,
        workflowType: asset.workflowType,
      });

      await waitForScenePromptCompletion(client, job.promptId);
      const outputs = await client.retrieveOutputs(job.promptId);
      const [firstOutput] = outputs;

      if (!firstOutput) {
        throw createSceneExecutionError(`Scene generation produced no output for ${asset.sceneId}.`, 502);
      }

      const imported = await importComfyOutputToProject({
        client,
        output: firstOutput,
        projectId,
      });

      return {
        imagePath: imported.imagePath,
        manifestPath: relativeProjectPath(imported.manifestPath),
        promptId: job.promptId,
      };
    },
    validateScene: async () => {
      const validation = await validateComfyWorkflow(asset.workflowType);

      if (!validation.valid) {
        return validation.errors[0] ?? `${asset.workflowType} failed validation.`;
      }

      return null;
    },
  });
}

function mergeExecutionResults(state: SceneExecutionState, results: SceneExecutionResult[]): SceneExecutionState {
  const resultsBySceneId = new Map(results.map((result) => [result.sceneId, result]));

  return normalizeState({
    ...state,
    assets: state.assets.map((asset) => {
      const result = resultsBySceneId.get(asset.sceneId);

      if (!result) {
        return asset;
      }

      return {
        ...asset,
        attempts: result.attempts,
        completedAt: result.completedAt,
        error: result.error,
        imagePath: result.imagePath,
        manifestPath: result.manifestPath,
        promptId: result.promptId,
        startedAt: result.startedAt,
        status: result.status,
      };
    }),
  });
}

function markAssetsGenerating(state: SceneExecutionState, assets: SceneExecutionAsset[]): SceneExecutionState {
  const nextIds = new Set(assets.map((asset) => asset.sceneId));

  return normalizeState({
    ...state,
    assets: state.assets.map((asset) => nextIds.has(asset.sceneId)
      ? {
          ...asset,
          attempts: asset.attempts + 1,
          error: undefined,
          startedAt: new Date().toISOString(),
          status: "generating",
        }
      : asset),
  });
}

async function runSceneExecutionLoop(projectId: string): Promise<void> {
  while (true) {
    let state = await readSceneExecutionState(projectId);

    if (!state) {
      return;
    }

    if (isTerminalExecutionStatus(state.status) || state.status === "paused") {
      return;
    }

    state = recoverInterruptedGeneratingScenes(state);

    if (state.status === "cancelling") {
      const hasGenerating = state.assets.some((asset) => asset.status === "generating");

      if (!hasGenerating) {
        const cancelledState = await writeSceneExecutionState({
          ...markPendingScenesSkipped(state, "Scene execution cancelled before generation."),
          status: "cancelled",
        });

        if (cancelledState.status === "cancelled") {
          return;
        }
      }
    }

    const pendingAssets = state.assets.filter((asset) => asset.status === "pending");

    if (pendingAssets.length === 0) {
      const nextStatus = state.status === "cancelling" ? "cancelled" : "completed";
      await writeSceneExecutionState({
        ...(nextStatus === "cancelled"
          ? markPendingScenesSkipped(state, "Scene execution cancelled before generation.")
          : state),
        status: nextStatus,
      });
      return;
    }

    const nextAssets = pendingAssets.slice(0, state.concurrency);
    const startedState = await writeSceneExecutionState(markAssetsGenerating(state, nextAssets));
    const currentAssets = startedState.assets.filter((asset) => nextAssets.some((nextAsset) => nextAsset.sceneId === asset.sceneId));
    const results = await Promise.all(currentAssets.map((asset) => runSceneAsset(projectId, asset, startedState.negativePrompt)));
    const latestState = await readSceneExecutionState(projectId);

    if (!latestState) {
      return;
    }

    await writeSceneExecutionState(mergeExecutionResults(latestState, results));
  }
}

function ensureSceneExecutionRunner(projectId: string): void {
  if (activeRunners.has(projectId)) {
    return;
  }

  const promise = runSceneExecutionLoop(projectId)
    .catch(async (error) => {
      const state = await readSceneExecutionState(projectId);

      if (!state) {
        return;
      }

      await writeSceneExecutionState({
        ...state,
        assets: state.assets.map((asset) => asset.status === "generating"
          ? {
              ...asset,
              completedAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : "Scene execution runner failed.",
              status: "failed",
            }
          : asset),
        status: "completed",
      });
    })
    .finally(() => {
      activeRunners.delete(projectId);
    });

  activeRunners.set(projectId, promise);
}

export async function startSceneExecution({
  approvedSceneIds,
  concurrency,
  negativePrompt,
  projectId,
}: {
  approvedSceneIds: string[];
  concurrency?: number;
  negativePrompt?: string;
  projectId: string;
}): Promise<SceneExecutionState> {
  const existing = await readSceneExecutionState(projectId);

  if (existing && (existing.status === "running" || existing.status === "paused" || existing.status === "cancelling")) {
    throw createSceneExecutionError("A scene execution batch is already active for this project.", 409);
  }

  const plan = await readScenePlan(projectId);

  if (!plan) {
    throw createSceneExecutionError("Scene plan not found. Generate a scene plan before batch execution.", 404);
  }

  const uniqueApprovedSceneIds = [...new Set(approvedSceneIds.filter((sceneId) => plan.scenes.some((scene) => scene.id === sceneId)))];

  if (uniqueApprovedSceneIds.length === 0) {
    throw createSceneExecutionError("Approve at least one scene before starting batch generation.", 400);
  }

  const state = await writeSceneExecutionState(buildInitialExecutionState({
    approvedSceneIds: uniqueApprovedSceneIds,
    concurrency,
    negativePrompt: negativePrompt?.trim() ?? "",
    plan,
    projectId,
  }));

  ensureSceneExecutionRunner(projectId);
  return state;
}

export async function pauseSceneExecution(projectId: string): Promise<SceneExecutionState> {
  const state = await readSceneExecutionState(projectId);

  if (!state) {
    throw createSceneExecutionError("Scene execution batch not found.", 404);
  }

  if (state.status !== "running") {
    return state;
  }

  return writeSceneExecutionState({
    ...state,
    status: "paused",
  });
}

export async function resumeSceneExecution(projectId: string): Promise<SceneExecutionState> {
  const state = await readSceneExecutionState(projectId);

  if (!state) {
    throw createSceneExecutionError("Scene execution batch not found.", 404);
  }

  if (state.status !== "paused") {
    return state;
  }

  const resumedState = await writeSceneExecutionState({
    ...state,
    status: "running",
  });

  ensureSceneExecutionRunner(projectId);
  return resumedState;
}

export async function cancelSceneExecution(projectId: string): Promise<SceneExecutionState> {
  const state = await readSceneExecutionState(projectId);

  if (!state) {
    throw createSceneExecutionError("Scene execution batch not found.", 404);
  }

  const hasGenerating = state.assets.some((asset) => asset.status === "generating");

  if (hasGenerating) {
    return writeSceneExecutionState({
      ...state,
      status: "cancelling",
    });
  }

  return writeSceneExecutionState({
    ...markPendingScenesSkipped(state, "Scene execution cancelled before generation."),
    status: "cancelled",
  });
}

export async function getSceneExecutionState(projectId: string): Promise<SceneExecutionState | null> {
  const state = await readSceneExecutionState(projectId);

  if (!state) {
    return null;
  }

  if ((state.status === "running" || state.status === "cancelling") && !activeRunners.has(projectId)) {
    ensureSceneExecutionRunner(projectId);
  }

  return state;
}
