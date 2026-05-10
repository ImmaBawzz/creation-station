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

export type ComfyCertificationStatus =
  | "certified"
  | "skipped_offline"
  | "failed";

export type ComfyCertificationPhase = {
  details?: Record<string, unknown>;
  error?: string;
  name: string;
  status: "passed" | "failed" | "skipped";
};

export type ComfyCertificationReport = {
  artifactValidationResult?: Record<string, unknown>;
  certified: boolean;
  comfyUrl: string;
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

export async function runComfyCertification({
  executeIfOnline = true,
  payload = COMFY_CERTIFICATION_PAYLOAD,
}: {
  executeIfOnline?: boolean;
  payload?: ProviderJobRequest;
} = {}): Promise<ComfyCertificationReport> {
  return withComfyCertificationEnv(async () => {
    const phases: ComfyCertificationPhase[] = [];
    const adapter = getProviderAdapter("comfy");
    const workflowId = payload.workflowId as SupportedComfyWorkflowType;

    pushPassed(phases, "Config validation", {
      adapterExists: adapter.providerId === "comfy",
      comfyUrl: getComfyUrl(),
      executionMode: process.env.PROVIDER_RUNTIME_EXECUTION_MODE,
      enableComfy: process.env.PROVIDER_RUNTIME_ENABLE_COMFY,
    });

    const client = new ComfyClient({ baseUrl: getComfyUrl() });
    try {
      await client.checkAvailability();
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
        missingModel ? "comfy_model_missing" : "comfy_workflow_missing",
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
    pushPassed(phases, "Dry-run validation", {
      nodeCount: Object.keys(dryRunPrompt.promptPayload).length,
      outputPrefix: dryRunPrompt.outputPrefix,
      workflowId,
    });

    if (!executeIfOnline) {
      pushSkipped(phases, "Certification execution", { reason: "execution_disabled_for_test" });
      return finalizeReport({ finalStatus: "certified", phases });
    }

    try {
      const queued = await client.submitPrompt({ prompt: dryRunPrompt.promptPayload });
      await client.waitForCompletion({
        intervalMs: 500,
        promptId: queued.promptId,
        timeoutMs: 60_000,
      });
      const outputs = await client.retrieveOutputs(queued.promptId);
      const artifactValidationResult = {
        outputs,
        promptId: queued.promptId,
      };
      pushPassed(phases, "Certification execution", artifactValidationResult);
      pushPassed(phases, "Artifact validation", { outputCount: outputs.length });
      return finalizeReport({ artifactValidationResult, finalStatus: "certified", phases });
    } catch (error) {
      if (error instanceof ComfyError && error.code === "COMFY_TIMEOUT") {
        pushFailed(phases, "Certification execution", "provider_timeout", { error: error.message });
      } else if (error instanceof ComfyError && error.code === "COMFY_MISSING_OUTPUT") {
        pushFailed(phases, "Artifact validation", "provider_artifact_invalid", { error: error.message });
      } else {
        pushFailed(phases, "Certification execution", error instanceof Error ? error.message : String(error));
      }
      return finalizeReport({ finalStatus: "failed", phases });
    }
  });
}
