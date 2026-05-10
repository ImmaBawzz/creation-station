import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ComfyOutputRef } from "@/modules/comfy/client";
import type {
  ComfyWorkflowValidationResult,
  SupportedComfyWorkflowType,
  WorkflowRegistryEntry,
} from "@/modules/comfy/workflows";

type FetchLike = typeof fetch;

export type ComfyTimeoutPhase =
  | "before_queue"
  | "queued"
  | "running"
  | "completed_no_history"
  | "history_no_outputs"
  | "outputs_not_found"
  | "artifact_invalid"
  | "unknown_timeout";

export type ComfyWorkflowIdentityDiagnostics = {
  filenamePrefix?: unknown;
  latentSize?: { height?: unknown; width?: unknown };
  modelFilenames: string[];
  negativePromptNodeId: string;
  nodeCount: number;
  positivePromptNodeId: string;
  positivePromptInjected: boolean;
  samplerNodeId?: string;
  samplerSeed?: unknown;
  samplerSteps?: unknown;
  saveImageNodeId: string;
  saveImageNodePresent: boolean;
  workflowPath: string;
  workflowType: SupportedComfyWorkflowType;
};

export type ComfyOutputDiagnostics = {
  accessibleFiles: string[];
  artifactValidationRan: boolean;
  expectedOutputDirectory?: string;
  filesExist: boolean;
  outputFilesDetected: boolean;
  outputFilenames: string[];
  outputNodeIds: string[];
  outputsAccessible: boolean;
};

export type ComfyCertificationDiagnostics = {
  artifactValidationRan: boolean;
  comfyUrl: string;
  executionError?: string;
  finalHistory?: unknown;
  historyAppeared: boolean;
  historyPolls: Array<{
    completed: boolean;
    error?: string;
    hasHistory: boolean;
    hasOutputs: boolean;
    queueState: "absent" | "pending" | "running" | "unknown";
    timestamp: string;
  }>;
  outputDiagnostics?: ComfyOutputDiagnostics;
  promptId?: string;
  queueAfterSubmit?: unknown;
  queueBeforeSubmit?: unknown;
  submittedWorkflowId: string;
  submittedWorkflowType: SupportedComfyWorkflowType;
  systemStats?: unknown;
  timeoutHappenedBeforeHistory: boolean;
  timeoutPhase?: ComfyTimeoutPhase;
  workflowIdentity?: ComfyWorkflowIdentityDiagnostics;
};

type PromptNode = {
  class_type?: string;
  inputs?: Record<string, unknown>;
};

const DEBUG_ROOT = path.join(process.cwd(), ".debug");
export const COMFY_CERTIFICATION_DIAGNOSTICS_PATH = path.join(DEBUG_ROOT, "comfy-certification-diagnostics.json");

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function getPromptNode(promptPayload: Record<string, unknown>, nodeId: string | undefined): PromptNode | null {
  if (!nodeId) {
    return null;
  }

  const node = asRecord(promptPayload[nodeId]);
  if (!node) {
    return null;
  }

  return {
    class_type: typeof node.class_type === "string" ? node.class_type : undefined,
    inputs: asRecord(node.inputs) ?? undefined,
  };
}

function nodeIncludesText(node: PromptNode | null, text: string): boolean {
  if (!node?.inputs) {
    return false;
  }

  return Object.values(node.inputs).some((value) => value === text);
}

export function collectWorkflowIdentityDiagnostics({
  entry,
  prompt,
  promptPayload,
  validation,
  workflowType,
}: {
  entry: WorkflowRegistryEntry;
  prompt: string;
  promptPayload: Record<string, unknown>;
  validation: ComfyWorkflowValidationResult;
  workflowType: SupportedComfyWorkflowType;
}): ComfyWorkflowIdentityDiagnostics {
  const saveNode = getPromptNode(promptPayload, entry.saveImageNodeId);
  const sizeNode = getPromptNode(promptPayload, entry.widthHeightNodeId);
  const samplerNode = getPromptNode(promptPayload, entry.samplerNodeId);

  return {
    filenamePrefix: saveNode?.inputs?.filename_prefix,
    latentSize: {
      height: sizeNode?.inputs?.height,
      width: sizeNode?.inputs?.width,
    },
    modelFilenames: validation.modelFiles,
    negativePromptNodeId: entry.negativePromptNodeId,
    nodeCount: Object.keys(promptPayload).length,
    positivePromptNodeId: entry.positivePromptNodeId,
    positivePromptInjected: nodeIncludesText(getPromptNode(promptPayload, entry.positivePromptNodeId), prompt),
    samplerNodeId: entry.samplerNodeId,
    samplerSeed: samplerNode?.inputs?.seed,
    samplerSteps: samplerNode?.inputs?.steps,
    saveImageNodeId: entry.saveImageNodeId,
    saveImageNodePresent: Boolean(saveNode),
    workflowPath: entry.workflowPath,
    workflowType,
  };
}

export function resolveCertificationTimeouts(env: NodeJS.ProcessEnv = process.env): {
  artifactValidationTimeoutMs: number;
  executionTimeoutMs: number;
  outputImportTimeoutMs: number;
  queueTimeoutMs: number;
} {
  return {
    artifactValidationTimeoutMs: parsePositiveInteger(env.COMFY_ARTIFACT_VALIDATION_TIMEOUT_MS, 60_000),
    executionTimeoutMs: parsePositiveInteger(env.COMFY_EXECUTION_TIMEOUT_MS, 1_200_000),
    outputImportTimeoutMs: parsePositiveInteger(env.COMFY_OUTPUT_IMPORT_TIMEOUT_MS, 120_000),
    queueTimeoutMs: parsePositiveInteger(env.COMFY_QUEUE_TIMEOUT_MS, 120_000),
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function fetchComfyJson({
  comfyUrl,
  fetchImpl = fetch,
  pathname,
}: {
  comfyUrl: string;
  fetchImpl?: FetchLike;
  pathname: string;
}): Promise<unknown> {
  const response = await fetchImpl(`${comfyUrl.replace(/\/+$/, "")}${pathname}`);
  if (!response.ok) {
    throw new Error(`Comfy ${pathname} returned HTTP ${response.status}.`);
  }

  return response.json();
}

export function queueContainsPromptId(queue: unknown, promptId: string, key: "queue_pending" | "queue_running"): boolean {
  const entries = asRecord(queue)?.[key];
  if (!Array.isArray(entries)) {
    return false;
  }

  return entries.some((entry) => entryContainsPromptId(entry, promptId));
}

function entryContainsPromptId(value: unknown, promptId: string): boolean {
  if (typeof value === "string") {
    return value === promptId;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => entryContainsPromptId(entry, promptId));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((entry) => entryContainsPromptId(entry, promptId));
  }

  return false;
}

export function getHistoryRecord(history: unknown, promptId: string): Record<string, unknown> | null {
  return asRecord(asRecord(history)?.[promptId]);
}

export function collectOutputFilenames(historyRecord: unknown): { filenames: string[]; outputNodeIds: string[] } {
  const outputs = asRecord(asRecord(historyRecord)?.outputs);
  const filenames: string[] = [];
  const outputNodeIds: string[] = [];

  for (const [nodeId, nodeOutput] of Object.entries(outputs ?? {})) {
    outputNodeIds.push(nodeId);
    const nodeOutputRecord = asRecord(nodeOutput);

    for (const value of Object.values(nodeOutputRecord ?? {})) {
      if (!Array.isArray(value)) {
        continue;
      }

      for (const item of value) {
        const output = asRecord(item);
        if (typeof output?.filename === "string" && output.filename) {
          filenames.push(output.filename);
        }
      }
    }
  }

  return { filenames, outputNodeIds };
}

export function historyHasExecutionError(historyRecord: unknown): string | undefined {
  const status = asRecord(asRecord(historyRecord)?.status);
  if (status?.status_str === "error") {
    return "Comfy history status_str is error.";
  }

  const messages = status?.messages;
  if (Array.isArray(messages)) {
    const serialized = JSON.stringify(messages);
    if (serialized.toLowerCase().includes("error")) {
      return serialized;
    }
  }

  return undefined;
}

export function classifyTimeoutPhase({
  executionError,
  historyAppeared,
  historyCompleted,
  outputFilesDetected,
  outputFilesExist,
  promptId,
  queueState,
}: {
  executionError?: string;
  historyAppeared: boolean;
  historyCompleted: boolean;
  outputFilesDetected: boolean;
  outputFilesExist?: boolean;
  promptId?: string;
  queueState: "absent" | "pending" | "running" | "unknown";
}): ComfyTimeoutPhase {
  if (!promptId) {
    return "before_queue";
  }

  if (executionError) {
    return "unknown_timeout";
  }

  if (historyCompleted && !outputFilesDetected) {
    return "history_no_outputs";
  }

  if (outputFilesDetected && outputFilesExist === false) {
    return "outputs_not_found";
  }

  if (!historyAppeared && queueState === "pending") {
    return "queued";
  }

  if (queueState === "running" || (historyAppeared && !historyCompleted)) {
    return "running";
  }

  if (!historyAppeared && queueState === "absent") {
    return "completed_no_history";
  }

  return "unknown_timeout";
}

export function createInitialComfyDiagnostics({
  comfyUrl,
  workflowId,
  workflowType,
}: {
  comfyUrl: string;
  workflowId: string;
  workflowType: SupportedComfyWorkflowType;
}): ComfyCertificationDiagnostics {
  return {
    artifactValidationRan: false,
    comfyUrl,
    historyAppeared: false,
    historyPolls: [],
    submittedWorkflowId: workflowId,
    submittedWorkflowType: workflowType,
    timeoutHappenedBeforeHistory: false,
  };
}

export async function collectOutputDiagnostics({
  expectedOutputDirectory = process.env.COMFY_OUTPUT_DIR ?? process.env.COMFY_OUTPUT_DIRECTORY,
  historyRecord,
  outputs,
}: {
  expectedOutputDirectory?: string;
  historyRecord: unknown;
  outputs?: ComfyOutputRef[];
}): Promise<ComfyOutputDiagnostics> {
  const { filenames, outputNodeIds } = collectOutputFilenames(historyRecord);
  const accessibleFiles: string[] = [];

  if (expectedOutputDirectory) {
    for (const filename of filenames) {
      const candidate = path.join(expectedOutputDirectory, filename);
      try {
        await access(candidate);
        accessibleFiles.push(candidate);
      } catch {
        // Keep collecting the remaining candidates.
      }
    }
  }

  return {
    accessibleFiles,
    artifactValidationRan: false,
    expectedOutputDirectory,
    filesExist: expectedOutputDirectory ? accessibleFiles.length === filenames.length && filenames.length > 0 : true,
    outputFilesDetected: filenames.length > 0 || Boolean(outputs?.length),
    outputFilenames: filenames.length > 0 ? filenames : outputs?.map((output) => output.filename) ?? [],
    outputNodeIds,
    outputsAccessible: Boolean(outputs?.length) || accessibleFiles.length > 0,
  };
}

export async function writeComfyCertificationDiagnostics(
  diagnostics: ComfyCertificationDiagnostics,
): Promise<string> {
  await mkdir(DEBUG_ROOT, { recursive: true });
  await writeFile(COMFY_CERTIFICATION_DIAGNOSTICS_PATH, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");
  return COMFY_CERTIFICATION_DIAGNOSTICS_PATH;
}
