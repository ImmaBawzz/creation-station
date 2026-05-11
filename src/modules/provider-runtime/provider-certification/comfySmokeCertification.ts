import { ComfyClient } from "@/modules/comfy/client";
import { bootstrapComfy, type ComfyBootstrapResult } from "./comfyBootstrap";
import { fetchComfyJson } from "./comfyDiagnostics";
import {
  collectComfyRuntimeForensics,
  writeComfyRuntimeForensics,
  type ComfyRuntimeTimeoutClassification,
} from "./comfyRuntimeForensics";
import { buildComfyProviderSmokeWorkflow, type ComfySmokeWorkflowResult } from "./comfySmokeWorkflow";

export type ComfySmokeCertificationStatus = "passed" | "failed" | "skipped";

export type ComfyCertificationSummary = {
  productionCertification: {
    reason: string;
    status: "passed" | "failed" | "timeout" | "skipped";
    workflowType: string;
  };
  provider: "comfy";
  smokeCertification: {
    reason: string;
    status: ComfySmokeCertificationStatus;
  };
};

export type ComfySmokeCertificationPhase = {
  details?: Record<string, unknown>;
  error?: string;
  name: string;
  status: "passed" | "failed" | "skipped";
};

export type ComfySmokeCertificationReport = ComfyCertificationSummary & {
  bootstrapResult?: ComfyBootstrapResult;
  certified: boolean;
  comfyUrl: string;
  executionMode: "certify";
  finalStatus: "certified" | "failed" | "skipped_offline";
  generatedAt: string;
  phases: ComfySmokeCertificationPhase[];
  providerId: "comfy";
  smokeWorkflow?: ComfySmokeWorkflowResult;
  timeoutClassification?: ComfyRuntimeTimeoutClassification;
};

function getComfyUrl(): string {
  return process.env.COMFY_API_URL ?? "http://127.0.0.1:8188";
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveSmokeTimeouts(): { executionTimeoutMs: number; queueTimeoutMs: number } {
  return {
    executionTimeoutMs: parsePositiveInteger(process.env.COMFY_SMOKE_EXECUTION_TIMEOUT_MS, 300_000),
    queueTimeoutMs: parsePositiveInteger(process.env.COMFY_SMOKE_QUEUE_TIMEOUT_MS, 60_000),
  };
}

function withComfySmokeEnv<T>(execute: () => Promise<T>): Promise<T> {
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

function phase(
  phases: ComfySmokeCertificationPhase[],
  status: ComfySmokeCertificationPhase["status"],
  name: string,
  details?: Record<string, unknown>,
  error?: string,
): void {
  phases.push({ details, error, name, status });
}

export function buildComfyCertificationSummary({
  productionReason,
  productionStatus,
  smokeReason,
  smokeStatus,
}: {
  productionReason: string;
  productionStatus: "passed" | "failed" | "timeout" | "skipped";
  smokeReason: string;
  smokeStatus: ComfySmokeCertificationStatus;
}): ComfyCertificationSummary {
  return {
    productionCertification: {
      reason: productionReason,
      status: productionStatus,
      workflowType: "flux-fast-concept",
    },
    provider: "comfy",
    smokeCertification: {
      reason: smokeReason,
      status: smokeStatus,
    },
  };
}

function finalizeSmokeReport({
  bootstrapResult,
  phases,
  smokeWorkflow,
  summary,
  timeoutClassification,
}: {
  bootstrapResult?: ComfyBootstrapResult;
  phases: ComfySmokeCertificationPhase[];
  smokeWorkflow?: ComfySmokeWorkflowResult;
  summary: ComfyCertificationSummary;
  timeoutClassification?: ComfyRuntimeTimeoutClassification;
}): ComfySmokeCertificationReport {
  const certified = summary.smokeCertification.status === "passed";
  return {
    ...summary,
    bootstrapResult,
    certified,
    comfyUrl: getComfyUrl(),
    executionMode: "certify",
    finalStatus: certified ? "certified" : summary.smokeCertification.status === "skipped" ? "skipped_offline" : "failed",
    generatedAt: new Date().toISOString(),
    phases,
    providerId: "comfy",
    smokeWorkflow,
    timeoutClassification,
  };
}

export async function runComfySmokeCertification({
  bootstrap = bootstrapComfy,
  smokeWorkflowBuilder = buildComfyProviderSmokeWorkflow,
}: {
  bootstrap?: () => Promise<ComfyBootstrapResult>;
  smokeWorkflowBuilder?: (options?: { systemStats?: unknown }) => Promise<ComfySmokeWorkflowResult>;
} = {}): Promise<ComfySmokeCertificationReport> {
  return withComfySmokeEnv(async () => {
    const phases: ComfySmokeCertificationPhase[] = [];
    const bootstrapResult = await bootstrap();

    phase(phases, "passed", "Config validation", {
      comfyUrl: getComfyUrl(),
      executionMode: process.env.PROVIDER_RUNTIME_EXECUTION_MODE,
      wanEnabled: process.env.PROVIDER_RUNTIME_ENABLE_WAN,
      klingEnabled: process.env.PROVIDER_RUNTIME_ENABLE_KLING,
      runwayEnabled: process.env.PROVIDER_RUNTIME_ENABLE_RUNWAY,
    });

    if (bootstrapResult.status === "skipped_autostart_disabled") {
      phase(phases, "skipped", "Comfy bootstrap", { bootstrapResult, reason: "comfy_offline" });
      return finalizeSmokeReport({
        bootstrapResult,
        phases,
        summary: buildComfyCertificationSummary({
          productionReason: "production_not_run_in_smoke_mode",
          productionStatus: "skipped",
          smokeReason: "comfy_offline",
          smokeStatus: "skipped",
        }),
      });
    }

    if (!["already_running", "started"].includes(bootstrapResult.status)) {
      phase(phases, "failed", "Comfy bootstrap", { bootstrapResult }, bootstrapResult.status);
      return finalizeSmokeReport({
        bootstrapResult,
        phases,
        summary: buildComfyCertificationSummary({
          productionReason: "production_not_run_in_smoke_mode",
          productionStatus: "skipped",
          smokeReason: bootstrapResult.status,
          smokeStatus: "failed",
        }),
      });
    }
    phase(phases, "passed", "Comfy bootstrap", { bootstrapResult });

    const client = new ComfyClient({ baseUrl: getComfyUrl() });
    await client.checkAvailability();
    const systemStats = await fetchComfyJson({ comfyUrl: getComfyUrl(), pathname: "/system_stats" }).catch(() => undefined);
    phase(phases, "passed", "Health validation", { health: "online" });

    const smokeWorkflow = await smokeWorkflowBuilder({ systemStats });
    if (smokeWorkflow.status === "model_missing") {
      phase(phases, "skipped", "Smoke workflow", { smokeWorkflow }, "comfy_smoke_model_missing");
      return finalizeSmokeReport({
        bootstrapResult,
        phases,
        smokeWorkflow,
        summary: buildComfyCertificationSummary({
          productionReason: "production_not_run_in_smoke_mode",
          productionStatus: "skipped",
          smokeReason: "comfy_smoke_model_missing",
          smokeStatus: "failed",
        }),
      });
    }

    phase(phases, "passed", "Smoke workflow", {
      nodeCount: Object.keys(smokeWorkflow.promptPayload).length,
      strategy: smokeWorkflow.strategy,
      workflowType: smokeWorkflow.workflowType,
    });

    const queued = await client.submitPrompt({ prompt: smokeWorkflow.promptPayload });
    const timeouts = resolveSmokeTimeouts();
    const forensics = await collectComfyRuntimeForensics({
      comfyUrl: getComfyUrl(),
      intervalMs: 500,
      promptId: queued.promptId,
      promptPayload: smokeWorkflow.promptPayload,
      timeoutMs: Math.max(timeouts.queueTimeoutMs, timeouts.executionTimeoutMs),
      workflowType: smokeWorkflow.workflowType,
    });
    await writeComfyRuntimeForensics(forensics);

    if (!forensics.outputsAppearButNotImported) {
      phase(phases, "failed", "Smoke execution", {
        promptId: queued.promptId,
        timeoutClassification: forensics.timeoutClassification,
      }, forensics.timeoutClassification);
      return finalizeSmokeReport({
        bootstrapResult,
        phases,
        smokeWorkflow,
        summary: buildComfyCertificationSummary({
          productionReason: "production_not_run_in_smoke_mode",
          productionStatus: "skipped",
          smokeReason: forensics.timeoutClassification,
          smokeStatus: "failed",
        }),
        timeoutClassification: forensics.timeoutClassification,
      });
    }

    const outputs = await client.retrieveOutputs(queued.promptId);
    const firstOutput = outputs[0];
    if (!firstOutput) {
      phase(phases, "failed", "Artifact validation", { promptId: queued.promptId }, "outputs_not_found");
      return finalizeSmokeReport({
        bootstrapResult,
        phases,
        smokeWorkflow,
        summary: buildComfyCertificationSummary({
          productionReason: "production_not_run_in_smoke_mode",
          productionStatus: "skipped",
          smokeReason: "outputs_not_found",
          smokeStatus: "failed",
        }),
        timeoutClassification: "outputs_not_found",
      });
    }

    const bytes = await client.downloadOutput(firstOutput);
    if (bytes.length === 0) {
      phase(phases, "failed", "Artifact validation", { filename: firstOutput.filename }, "artifact_invalid");
      return finalizeSmokeReport({
        bootstrapResult,
        phases,
        smokeWorkflow,
        summary: buildComfyCertificationSummary({
          productionReason: "production_not_run_in_smoke_mode",
          productionStatus: "skipped",
          smokeReason: "artifact_invalid",
          smokeStatus: "failed",
        }),
        timeoutClassification: "artifact_invalid",
      });
    }

    phase(phases, "passed", "Smoke execution", { outputCount: outputs.length, promptId: queued.promptId });
    phase(phases, "passed", "Artifact validation", {
      byteLength: bytes.length,
      filename: firstOutput.filename,
    });
    return finalizeSmokeReport({
      bootstrapResult,
      phases,
      smokeWorkflow,
      summary: buildComfyCertificationSummary({
        productionReason: "production_not_run_in_smoke_mode",
        productionStatus: "skipped",
        smokeReason: "provider_lifecycle_certified",
        smokeStatus: "passed",
      }),
    });
  });
}
