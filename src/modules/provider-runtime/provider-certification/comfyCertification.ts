import { ComfyClient, ComfyError } from "@/modules/comfy/client";
import {
  listSupportedComfyWorkflowTypes,
  prepareComfyWorkflowPrompt,
  validateComfyWorkflow,
  type SupportedComfyWorkflowType,
} from "@/modules/comfy/workflows";
import { mapCanonicalPayloadToComfy } from "@/modules/provider-runtime/payloadMappers";
import { getProviderAdapter } from "@/modules/provider-runtime/providerRegistry";
import { inspectProviderPayload } from "@/modules/provider-runtime/readiness";
import type { ProviderJobRequest } from "@/modules/provider-runtime/types";
import { bootstrapComfy, type ComfyBootstrapResult } from "./comfyBootstrap";
import {
  classifyTimeoutPhase,
  collectOutputDiagnostics,
  collectOutputFilenames,
  collectWorkflowIdentityDiagnostics,
  createInitialComfyDiagnostics,
  fetchComfyJson,
  getHistoryRecord,
  historyHasExecutionError,
  queueContainsPromptId,
  resolveCertificationTimeouts,
  writeComfyCertificationDiagnostics,
  type ComfyCertificationDiagnostics,
} from "./comfyDiagnostics";

export type ComfyCertificationStatus =
  | "certified"
  | "skipped_offline"
  | "bootstrap_config_missing"
  | "comfy_startup_timeout"
  | "comfy_startup_failed"
  | "failed";

export type ComfyCertificationPhase = {
  details?: Record<string, unknown>;
  error?: string;
  name: string;
  status: "passed" | "failed" | "skipped";
};

export type ComfyCertificationReport = {
  artifactValidationResult?: Record<string, unknown>;
  bootstrapResult?: ComfyBootstrapResult;
  certified: boolean;
  comfyUrl: string;
  diagnostics?: Pick<ComfyCertificationDiagnostics, "promptId" | "timeoutPhase" | "workflowIdentity">;
  executionMode: string;
  finalStatus: ComfyCertificationStatus;
  generatedAt: string;
  phases: ComfyCertificationPhase[];
  providerId: "comfy";
};

export const COMFY_CERTIFICATION_PAYLOAD: ProviderJobRequest = {
  aspectRatio: "1:1",
  cameraDirection: "static",
  duration: 1,
  fps: 24,
  id: "comfy-certification",
  motionIntensity: "low",
  negativePrompt: "text, watermark, logo, blurry, corrupted",
  prompt: "simple cinematic test frame, soft light, abstract geometric object, no text",
  provider: "comfy",
  referenceAssets: [],
  resolution: {
    height: 512,
    width: 512,
  },
  sceneId: "comfy-certification-scene",
  seed: 12345,
  workflowId: "flux-fast-concept",
};

function getComfyUrl(): string {
  return process.env.COMFY_API_URL ?? "http://127.0.0.1:8188";
}

function withComfyCertificationEnv<T>(execute: () => Promise<T>): Promise<T> {
  const previousEnv = { ...process.env };
  process.env.PROVIDER_RUNTIME_EXECUTION_MODE = "certify";
  process.env.PROVIDER_RUNTIME_ENABLE_COMFY = "true";
  process.env.PROVIDER_RUNTIME_ENABLE_WAN = "false";
  process.env.PROVIDER_RUNTIME_ENABLE_KLING = "false";
  process.env.PROVIDER_RUNTIME_ENABLE_RUNWAY = "false";
  process.env.COMFY_API_URL = getComfyUrl();

  return execute().finally(() => {
    process.env = previousEnv;
  });
}

function pushPassed(phases: ComfyCertificationPhase[], name: string, details?: Record<string, unknown>): void {
  phases.push({ details, name, status: "passed" });
}

function pushFailed(phases: ComfyCertificationPhase[], name: string, error: string, details?: Record<string, unknown>): void {
  phases.push({ details, error, name, status: "failed" });
}

function pushSkipped(phases: ComfyCertificationPhase[], name: string, details?: Record<string, unknown>): void {
  phases.push({ details, name, status: "skipped" });
}

function finalizeReport({
  artifactValidationResult,
  finalStatus,
  phases,
}: {
  artifactValidationResult?: Record<string, unknown>;
  finalStatus: ComfyCertificationStatus;
  phases: ComfyCertificationPhase[];
}): ComfyCertificationReport {
  return {
    artifactValidationResult,
    certified: finalStatus === "certified",
    comfyUrl: getComfyUrl(),
    executionMode: "certify",
    finalStatus,
    generatedAt: new Date().toISOString(),
    phases,
    providerId: "comfy",
  };
}

function isMissingModelError(errors: string[]): string | undefined {
  return errors.find((error) => error.toLowerCase().includes("missing model file"));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWorkflowValidationError(errors: string[]): string {
  if (errors.some((error) => error.toLowerCase().includes("missing saveimage"))) {
    return "comfy_output_node_missing";
  }

  if (errors.some((error) => error.toLowerCase().includes("positive prompt"))) {
    return "comfy_prompt_injection_failed";
  }

  return "comfy_workflow_missing";
}

function queueState(queue: unknown, promptId: string): "absent" | "pending" | "running" | "unknown" {
  if (queueContainsPromptId(queue, promptId, "queue_pending")) {
    return "pending";
  }

  if (queueContainsPromptId(queue, promptId, "queue_running")) {
    return "running";
  }

  return queue ? "absent" : "unknown";
}

async function waitForComfyCompletionWithDiagnostics({
  comfyUrl,
  diagnostics,
  promptId,
}: {
  comfyUrl: string;
  diagnostics: ComfyCertificationDiagnostics;
  promptId: string;
}): Promise<"completed"> {
  const timeouts = resolveCertificationTimeouts();
  const startedAt = Date.now();
  let lastQueueState: "absent" | "pending" | "running" | "unknown" = "unknown";
  let historyCompleted = false;
  let outputFilesDetected = false;

  while (Date.now() - startedAt <= timeouts.executionTimeoutMs) {
    let queue: unknown;
    let history: unknown;
    let historyRecord: Record<string, unknown> | null = null;
    let error: string | undefined;

    try {
      queue = await fetchComfyJson({ comfyUrl, pathname: "/queue" });
      lastQueueState = queueState(queue, promptId);
    } catch (queueError) {
      error = queueError instanceof Error ? queueError.message : String(queueError);
    }

    try {
      history = await fetchComfyJson({ comfyUrl, pathname: `/history/${encodeURIComponent(promptId)}` });
      diagnostics.finalHistory = history;
      historyRecord = getHistoryRecord(history, promptId);
      diagnostics.historyAppeared = Boolean(historyRecord);
      if (historyRecord) {
        const status = historyRecord.status && typeof historyRecord.status === "object"
          ? historyRecord.status as Record<string, unknown>
          : {};
        const outputs = collectOutputFilenames(historyRecord);
        outputFilesDetected = outputs.filenames.length > 0;
        historyCompleted = status.completed === true || outputFilesDetected;
        diagnostics.executionError = historyHasExecutionError(historyRecord);

        if (diagnostics.executionError) {
          throw new ComfyError("ComfyUI reported an execution error in history.", {
            code: "COMFY_JOB_FAILED",
            details: [diagnostics.executionError],
            statusCode: 502,
          });
        }

        if (historyCompleted && outputFilesDetected) {
          diagnostics.timeoutHappenedBeforeHistory = false;
          return "completed";
        }
      }
    } catch (historyError) {
      if (historyError instanceof ComfyError) {
        throw historyError;
      }
      error = historyError instanceof Error ? historyError.message : String(historyError);
    }

    diagnostics.historyPolls.push({
      completed: historyCompleted,
      error,
      hasHistory: Boolean(historyRecord),
      hasOutputs: outputFilesDetected,
      queueState: lastQueueState,
      timestamp: new Date().toISOString(),
    });

    if (lastQueueState === "pending" && Date.now() - startedAt > timeouts.queueTimeoutMs) {
      break;
    }

    await sleep(500);
  }

  diagnostics.timeoutHappenedBeforeHistory = !diagnostics.historyAppeared;
  diagnostics.timeoutPhase = classifyTimeoutPhase({
    executionError: diagnostics.executionError,
    historyAppeared: diagnostics.historyAppeared,
    historyCompleted,
    outputFilesDetected,
    promptId,
    queueState: lastQueueState,
  });

  throw new ComfyError(`ComfyUI job timed out: ${promptId}`, {
    code: "COMFY_TIMEOUT",
    details: [diagnostics.timeoutPhase],
    statusCode: 504,
  });
}

export async function runComfyCertification({
  bootstrap = bootstrapComfy,
  executeIfOnline = true,
  payload = COMFY_CERTIFICATION_PAYLOAD,
}: {
  bootstrap?: () => Promise<ComfyBootstrapResult>;
  executeIfOnline?: boolean;
  payload?: ProviderJobRequest;
} = {}): Promise<ComfyCertificationReport> {
  return withComfyCertificationEnv(async () => {
    const phases: ComfyCertificationPhase[] = [];
    const adapter = getProviderAdapter("comfy");
    const workflowId = payload.workflowId as SupportedComfyWorkflowType;
    const bootstrapResult = await bootstrap();
    const diagnostics = createInitialComfyDiagnostics({
      comfyUrl: getComfyUrl(),
      workflowId: String(payload.workflowId ?? workflowId),
      workflowType: workflowId,
    });

    pushPassed(phases, "Config validation", {
      adapterExists: adapter.providerId === "comfy",
      comfyUrl: getComfyUrl(),
      comfyAutoStart: process.env.COMFY_AUTO_START ?? "false",
      executionMode: process.env.PROVIDER_RUNTIME_EXECUTION_MODE,
      enableComfy: process.env.PROVIDER_RUNTIME_ENABLE_COMFY,
    });

    if (bootstrapResult.status === "missing_start_command") {
      pushSkipped(phases, "Comfy bootstrap", {
        reason: "bootstrap_config_missing",
        bootstrapResult,
      });
      return {
        ...finalizeReport({ finalStatus: "bootstrap_config_missing", phases }),
        bootstrapResult,
      };
    }

    if (bootstrapResult.status === "startup_timeout") {
      pushFailed(phases, "Comfy bootstrap", "comfy_startup_timeout", { bootstrapResult });
      return {
        ...finalizeReport({ finalStatus: "comfy_startup_timeout", phases }),
        bootstrapResult,
      };
    }

    if (bootstrapResult.status === "startup_failed") {
      pushFailed(phases, "Comfy bootstrap", "comfy_startup_failed", { bootstrapResult });
      return {
        ...finalizeReport({ finalStatus: "comfy_startup_failed", phases }),
        bootstrapResult,
      };
    }

    pushPassed(phases, "Comfy bootstrap", { bootstrapResult });

    if (bootstrapResult.status === "skipped_autostart_disabled") {
      pushSkipped(phases, "Health validation", {
        reason: "comfy_offline",
        bootstrapResult,
      });
      pushSkipped(phases, "Certification execution", { reason: "comfy_offline" });
      return {
        ...finalizeReport({ finalStatus: "skipped_offline", phases }),
        bootstrapResult,
      };
    }

    const client = new ComfyClient({ baseUrl: getComfyUrl() });
    try {
      await client.checkAvailability();
      diagnostics.systemStats = await fetchComfyJson({ comfyUrl: getComfyUrl(), pathname: "/system_stats" }).catch((error) => ({
        error: error instanceof Error ? error.message : String(error),
      }));
      pushPassed(phases, "Health validation", { health: "online" });
    } catch (error) {
      pushSkipped(phases, "Health validation", {
        reason: "comfy_offline",
        error: error instanceof Error ? error.message : String(error),
      });
      pushSkipped(phases, "Certification execution", { reason: "comfy_offline" });
      return finalizeReport({ finalStatus: "skipped_offline", phases });
    }

    if (!listSupportedComfyWorkflowTypes().includes(workflowId)) {
      pushFailed(phases, "Workflow validation", "comfy_workflow_missing", { workflowId });
      return finalizeReport({ finalStatus: "failed", phases });
    }

    const workflowValidation = await validateComfyWorkflow(workflowId);
    if (!workflowValidation.valid) {
      const missingModel = isMissingModelError(workflowValidation.errors);
      pushFailed(
        phases,
        "Workflow validation",
        missingModel ? "comfy_model_missing" : getWorkflowValidationError(workflowValidation.errors),
        {
          errors: workflowValidation.errors,
          missingModel,
          workflowId,
        },
      );
      return finalizeReport({ finalStatus: "failed", phases });
    }
    pushPassed(phases, "Workflow validation", {
      modelValidationStatus: workflowValidation.modelValidationStatus,
      workflowId,
    });

    const mapping = mapCanonicalPayloadToComfy(payload);
    if (!mapping.ok) {
      pushFailed(phases, "Payload inspection", "provider_payload_invalid", {
        error: mapping.message,
        warnings: mapping.warnings,
      });
      return finalizeReport({ finalStatus: "failed", phases });
    }

    pushPassed(phases, "Payload inspection", {
      mappedPayload: mapping.payload,
      readinessInspection: inspectProviderPayload(payload),
      warnings: mapping.warnings,
    });

    const dryRunPrompt = await prepareComfyWorkflowPrompt({
      negativePrompt: payload.negativePrompt ?? "",
      projectId: "comfy-certification-dry-run",
      prompt: payload.prompt,
      smokeTest: true,
      workflowType: workflowId,
    });
    diagnostics.workflowIdentity = collectWorkflowIdentityDiagnostics({
      entry: dryRunPrompt.entry,
      prompt: payload.prompt,
      promptPayload: dryRunPrompt.promptPayload,
      validation: workflowValidation,
      workflowType: workflowId,
    });

    if (!diagnostics.workflowIdentity.positivePromptInjected) {
      pushFailed(phases, "Workflow validation", "comfy_prompt_injection_failed", {
        positivePromptNodeId: diagnostics.workflowIdentity.positivePromptNodeId,
      });
      await writeComfyCertificationDiagnostics(diagnostics);
      return {
        ...finalizeReport({ finalStatus: "failed", phases }),
        diagnostics: {
          promptId: diagnostics.promptId,
          timeoutPhase: diagnostics.timeoutPhase,
          workflowIdentity: diagnostics.workflowIdentity,
        },
      };
    }

    if (!diagnostics.workflowIdentity.saveImageNodePresent) {
      pushFailed(phases, "Workflow validation", "comfy_output_node_missing", {
        saveImageNodeId: diagnostics.workflowIdentity.saveImageNodeId,
      });
      await writeComfyCertificationDiagnostics(diagnostics);
      return {
        ...finalizeReport({ finalStatus: "failed", phases }),
        diagnostics: {
          promptId: diagnostics.promptId,
          timeoutPhase: diagnostics.timeoutPhase,
          workflowIdentity: diagnostics.workflowIdentity,
        },
      };
    }

    pushPassed(phases, "Dry-run validation", {
      nodeCount: Object.keys(dryRunPrompt.promptPayload).length,
      outputPrefix: dryRunPrompt.outputPrefix,
      workflowIdentity: diagnostics.workflowIdentity,
      workflowId,
    });

    if (!executeIfOnline) {
      pushSkipped(phases, "Certification execution", { reason: "execution_disabled_for_test" });
      return finalizeReport({ finalStatus: "certified", phases });
    }

    try {
      diagnostics.queueBeforeSubmit = await fetchComfyJson({ comfyUrl: getComfyUrl(), pathname: "/queue" }).catch((error) => ({
        error: error instanceof Error ? error.message : String(error),
      }));
      const queued = await client.submitPrompt({ prompt: dryRunPrompt.promptPayload });
      diagnostics.promptId = queued.promptId;
      diagnostics.queueAfterSubmit = await fetchComfyJson({ comfyUrl: getComfyUrl(), pathname: "/queue" }).catch((error) => ({
        error: error instanceof Error ? error.message : String(error),
      }));
      await waitForComfyCompletionWithDiagnostics({
        comfyUrl: getComfyUrl(),
        diagnostics,
        promptId: queued.promptId,
      });
      const outputs = await client.retrieveOutputs(queued.promptId);
      diagnostics.outputDiagnostics = await collectOutputDiagnostics({
        historyRecord: getHistoryRecord(diagnostics.finalHistory, queued.promptId),
        outputs,
      });
      const artifactValidationResult = {
        outputs,
        promptId: queued.promptId,
      };
      diagnostics.artifactValidationRan = true;
      if (diagnostics.outputDiagnostics) {
        diagnostics.outputDiagnostics.artifactValidationRan = true;
      }
      await writeComfyCertificationDiagnostics(diagnostics);
      pushPassed(phases, "Certification execution", artifactValidationResult);
      pushPassed(phases, "Artifact validation", { outputCount: outputs.length });
      return {
        ...finalizeReport({ artifactValidationResult, finalStatus: "certified", phases }),
        diagnostics: {
          promptId: diagnostics.promptId,
          timeoutPhase: diagnostics.timeoutPhase,
          workflowIdentity: diagnostics.workflowIdentity,
        },
      };
    } catch (error) {
      if (error instanceof ComfyError && error.code === "COMFY_TIMEOUT") {
        await writeComfyCertificationDiagnostics(diagnostics);
        pushFailed(phases, "Certification execution", "provider_timeout", {
          error: error.message,
          timeoutPhase: diagnostics.timeoutPhase ?? error.details[0] ?? "unknown_timeout",
        });
      } else if (error instanceof ComfyError && error.code === "COMFY_MISSING_OUTPUT") {
        diagnostics.outputDiagnostics = await collectOutputDiagnostics({
          historyRecord: diagnostics.promptId ? getHistoryRecord(diagnostics.finalHistory, diagnostics.promptId) : null,
        });
        diagnostics.timeoutPhase = "outputs_not_found";
        await writeComfyCertificationDiagnostics(diagnostics);
        pushFailed(phases, "Artifact validation", "provider_artifact_invalid", {
          error: error.message,
          timeoutPhase: diagnostics.timeoutPhase,
        });
      } else {
        await writeComfyCertificationDiagnostics(diagnostics);
        pushFailed(phases, "Certification execution", error instanceof Error ? error.message : String(error));
      }
      return {
        ...finalizeReport({ finalStatus: "failed", phases }),
        diagnostics: {
          promptId: diagnostics.promptId,
          timeoutPhase: diagnostics.timeoutPhase,
          workflowIdentity: diagnostics.workflowIdentity,
        },
      };
    }
  });
}
