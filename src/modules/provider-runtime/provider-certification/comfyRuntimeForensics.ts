import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  collectOutputFilenames,
  fetchComfyJson,
  getHistoryRecord,
  historyHasExecutionError,
  queueContainsPromptId,
} from "./comfyDiagnostics";

type FetchLike = typeof fetch;

export type ComfyRuntimeTimeoutClassification =
  | "submit_failed"
  | "queued_never_started"
  | "running_no_history"
  | "running_node_unknown"
  | "history_error"
  | "history_no_outputs"
  | "outputs_not_found"
  | "artifact_invalid"
  | "interrupted_after_timeout"
  | "unknown";

export type ComfyRuntimeForensics = {
  comfyUrl: string;
  currentQueueRunningItem?: unknown;
  executionError?: string;
  finalHistory?: unknown;
  historyAppeared: boolean;
  historyBeforeSubmit?: unknown;
  historyPolls: Array<{
    executionError?: string;
    hasHistory: boolean;
    hasOutputs: boolean;
    queuePendingContainsPrompt: boolean;
    queueRunningContainsPrompt: boolean;
    timestamp: string;
  }>;
  objectInfo?: unknown;
  outputsAppearButNotImported: boolean;
  promptId?: string;
  promptIdRemainsRunning: boolean;
  queueAfterSubmit?: unknown;
  queueBeforeSubmit?: unknown;
  queuePendingContainsPrompt: boolean;
  submittedModelFilenames: string[];
  submittedWorkflowNodeIds: string[];
  submittedWorkflowType: string;
  systemStats?: unknown;
  timeoutClassification: ComfyRuntimeTimeoutClassification;
};

export const COMFY_RUNTIME_FORENSICS_PATH = path.join(
  process.cwd(),
  ".debug",
  "comfy-runtime-forensics.json",
);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function queueRunningItem(queue: unknown, promptId: string): unknown {
  const running = asRecord(queue)?.queue_running;
  if (!Array.isArray(running)) {
    return undefined;
  }

  return running.find((entry) => JSON.stringify(entry).includes(promptId));
}

export function classifyComfyRuntimeTimeout({
  artifactInvalid = false,
  executionError,
  historyAppeared,
  interruptedAfterTimeout = false,
  outputFilesDetected,
  outputFilesExist,
  promptId,
  queuePendingContainsPrompt,
  queueRunningContainsPrompt,
}: {
  artifactInvalid?: boolean;
  executionError?: string;
  historyAppeared: boolean;
  interruptedAfterTimeout?: boolean;
  outputFilesDetected: boolean;
  outputFilesExist?: boolean;
  promptId?: string;
  queuePendingContainsPrompt: boolean;
  queueRunningContainsPrompt: boolean;
}): ComfyRuntimeTimeoutClassification {
  if (interruptedAfterTimeout) {
    return "interrupted_after_timeout";
  }

  if (!promptId) {
    return "submit_failed";
  }

  if (executionError) {
    return "history_error";
  }

  if (artifactInvalid) {
    return "artifact_invalid";
  }

  if (outputFilesDetected && outputFilesExist === false) {
    return "outputs_not_found";
  }

  if (historyAppeared && !outputFilesDetected) {
    return "history_no_outputs";
  }

  if (queuePendingContainsPrompt && !queueRunningContainsPrompt) {
    return "queued_never_started";
  }

  if (queueRunningContainsPrompt && !historyAppeared) {
    return "running_no_history";
  }

  if (queueRunningContainsPrompt) {
    return "running_node_unknown";
  }

  return "unknown";
}

export function extractSubmittedModelFilenames(promptPayload: Record<string, unknown>): string[] {
  const filenames = new Set<string>();

  for (const value of Object.values(promptPayload)) {
    const inputs = asRecord(asRecord(value)?.inputs);
    for (const inputValue of Object.values(inputs ?? {})) {
      if (typeof inputValue === "string" && /\.(safetensors|ckpt|pt|bin|gguf)$/i.test(inputValue)) {
        filenames.add(inputValue);
      }
    }
  }

  return [...filenames].sort((left, right) => left.localeCompare(right));
}

export async function collectComfyRuntimeForensics({
  comfyUrl,
  fetchImpl = fetch,
  interruptedAfterTimeout = false,
  intervalMs = 500,
  promptId,
  promptPayload,
  timeoutMs = 60_000,
  workflowType,
}: {
  comfyUrl: string;
  fetchImpl?: FetchLike;
  interruptedAfterTimeout?: boolean;
  intervalMs?: number;
  promptId?: string;
  promptPayload: Record<string, unknown>;
  timeoutMs?: number;
  workflowType: string;
}): Promise<ComfyRuntimeForensics> {
  const forensics: ComfyRuntimeForensics = {
    comfyUrl,
    historyAppeared: false,
    historyPolls: [],
    outputsAppearButNotImported: false,
    promptId,
    promptIdRemainsRunning: false,
    queuePendingContainsPrompt: false,
    submittedModelFilenames: extractSubmittedModelFilenames(promptPayload),
    submittedWorkflowNodeIds: Object.keys(promptPayload),
    submittedWorkflowType: workflowType,
    timeoutClassification: "unknown",
  };

  forensics.systemStats = await fetchComfyJson({ comfyUrl, fetchImpl, pathname: "/system_stats" }).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));
  forensics.objectInfo = await fetchComfyJson({ comfyUrl, fetchImpl, pathname: "/object_info" }).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));
  forensics.queueBeforeSubmit = await fetchComfyJson({ comfyUrl, fetchImpl, pathname: "/queue" }).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));
  forensics.historyBeforeSubmit = promptId
    ? await fetchComfyJson({ comfyUrl, fetchImpl, pathname: `/history/${encodeURIComponent(promptId)}` }).catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }))
    : await fetchComfyJson({ comfyUrl, fetchImpl, pathname: "/history" }).catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }));

  const startedAt = Date.now();
  while (promptId && Date.now() - startedAt <= timeoutMs) {
    const [queue, history] = await Promise.all([
      fetchComfyJson({ comfyUrl, fetchImpl, pathname: "/queue" }).catch((error) => ({
        error: error instanceof Error ? error.message : String(error),
      })),
      fetchComfyJson({ comfyUrl, fetchImpl, pathname: `/history/${encodeURIComponent(promptId)}` }).catch((error) => ({
        error: error instanceof Error ? error.message : String(error),
      })),
    ]);

    forensics.queueAfterSubmit = queue;
    forensics.finalHistory = history;
    forensics.promptIdRemainsRunning = queueContainsPromptId(queue, promptId, "queue_running");
    forensics.queuePendingContainsPrompt = queueContainsPromptId(queue, promptId, "queue_pending");
    forensics.currentQueueRunningItem = queueRunningItem(queue, promptId);

    const historyRecord = getHistoryRecord(history, promptId);
    const outputs = collectOutputFilenames(historyRecord);
    forensics.historyAppeared = Boolean(historyRecord);
    forensics.executionError = historyHasExecutionError(historyRecord);
    forensics.outputsAppearButNotImported = outputs.filenames.length > 0;
    forensics.historyPolls.push({
      executionError: forensics.executionError,
      hasHistory: Boolean(historyRecord),
      hasOutputs: outputs.filenames.length > 0,
      queuePendingContainsPrompt: forensics.queuePendingContainsPrompt,
      queueRunningContainsPrompt: forensics.promptIdRemainsRunning,
      timestamp: new Date().toISOString(),
    });

    if (forensics.executionError || outputs.filenames.length > 0) {
      break;
    }

    await sleep(intervalMs);
  }

  forensics.timeoutClassification = classifyComfyRuntimeTimeout({
    executionError: forensics.executionError,
    historyAppeared: forensics.historyAppeared,
    interruptedAfterTimeout,
    outputFilesDetected: forensics.outputsAppearButNotImported,
    promptId,
    queuePendingContainsPrompt: forensics.queuePendingContainsPrompt,
    queueRunningContainsPrompt: forensics.promptIdRemainsRunning,
  });

  return forensics;
}

export async function writeComfyRuntimeForensics(forensics: ComfyRuntimeForensics): Promise<string> {
  await mkdir(path.dirname(COMFY_RUNTIME_FORENSICS_PATH), { recursive: true });
  await writeFile(COMFY_RUNTIME_FORENSICS_PATH, `${JSON.stringify(forensics, null, 2)}\n`, "utf8");
  return COMFY_RUNTIME_FORENSICS_PATH;
}
