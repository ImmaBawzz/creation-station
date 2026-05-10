import { writeFile } from "node:fs/promises";
import path from "node:path";

import { ComfyClient } from "@/modules/comfy/client";
import {
  prepareComfyWorkflowPrompt,
  validateComfyWorkflow,
  type ComfyWorkflowValidationResult,
} from "@/modules/comfy/workflows";
import { collectComfyRuntimeForensics, type ComfyRuntimeForensics } from "./comfyRuntimeForensics";

export type FluxFastConceptClassification =
  | "static_validation_failed"
  | "minimal_runtime_failed"
  | "production_config_too_heavy"
  | "production_certified"
  | "workflow_runtime_hang"
  | "output_import_failure"
  | "not_run";

export type FluxFastConceptRunMode = "minimal" | "standard";

export type FluxFastConceptTelemetry = {
  artifactValidationState: "passed" | "failed" | "not_run";
  historyState: "appeared" | "missing" | "not_run";
  latentDimensions?: { height?: unknown; width?: unknown };
  modelNames: string[];
  outputDetectionState: "detected" | "missing" | "not_run";
  promptId?: string;
  queueState: "pending" | "running" | "completed" | "unknown" | "not_run";
  sampler?: unknown;
  scheduler?: unknown;
  steps?: unknown;
  timeoutPhase?: string;
  workflowId: "flux-fast-concept";
};

export type FluxFastConceptRunResult = {
  classification?: FluxFastConceptClassification;
  error?: string;
  forensics?: ComfyRuntimeForensics;
  mode: FluxFastConceptRunMode;
  passed: boolean;
  telemetry: FluxFastConceptTelemetry;
};

export type FluxFastConceptCertificationReport = {
  classification: FluxFastConceptClassification;
  generatedAt: string;
  minimalRun: FluxFastConceptRunResult;
  recommendation: string;
  standardRun: FluxFastConceptRunResult;
  staticValidation: {
    errors: string[];
    modelFiles: string[];
    nodeMapping: Record<string, string>;
    passed: boolean;
    warnings: string[];
  };
  workflowId: "flux-fast-concept";
};

const WORKFLOW_ID = "flux-fast-concept";
const REPORT_PATH = path.join(process.cwd(), "docs", "flux-fast-concept-certification-report.md");

function getComfyUrl(): string {
  return process.env.COMFY_API_URL ?? "http://127.0.0.1:8188";
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getTimeoutMs(mode: FluxFastConceptRunMode): number {
  const envKey = mode === "minimal"
    ? process.env.COMFY_FLUX_MINIMAL_TIMEOUT_MS
    : process.env.COMFY_FLUX_STANDARD_TIMEOUT_MS;
  return parsePositiveInteger(envKey, mode === "minimal" ? 120_000 : 1_200_000);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function getNodeInputs(promptPayload: Record<string, unknown>, nodeId: string): Record<string, unknown> {
  const node = asRecord(promptPayload[nodeId]);
  const inputs = asRecord(node?.inputs);
  return inputs ?? {};
}

function setInput(promptPayload: Record<string, unknown>, nodeId: string, key: string, value: unknown): void {
  const inputs = getNodeInputs(promptPayload, nodeId);
  inputs[key] = value;
  const node = asRecord(promptPayload[nodeId]);
  if (node) {
    node.inputs = inputs;
  }
}

function applyMinimalOverrides(promptPayload: Record<string, unknown>): void {
  setInput(promptPayload, "6", "width", 512);
  setInput(promptPayload, "6", "height", 512);
  setInput(promptPayload, "6", "batch_size", 1);
  setInput(promptPayload, "7", "steps", 4);
  setInput(promptPayload, "7", "seed", 12345);
  setInput(promptPayload, "7", "control_after_generate", "fixed");
  setInput(promptPayload, "9", "filename_prefix", "certification-flux-fast-concept-minimal");
}

function modelNames(promptPayload: Record<string, unknown>): string[] {
  const names = new Set<string>();

  for (const node of Object.values(promptPayload)) {
    const inputs = asRecord(asRecord(node)?.inputs);
    for (const value of Object.values(inputs ?? {})) {
      if (typeof value === "string" && /\.(safetensors|ckpt|gguf|pt|bin)$/i.test(value)) {
        names.add(value);
      }
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

function createTelemetry({
  forensics,
  promptPayload,
  promptId,
}: {
  forensics?: ComfyRuntimeForensics;
  promptPayload?: Record<string, unknown>;
  promptId?: string;
}): FluxFastConceptTelemetry {
  const sizeInputs = promptPayload ? getNodeInputs(promptPayload, "6") : {};
  const samplerInputs = promptPayload ? getNodeInputs(promptPayload, "7") : {};

  return {
    artifactValidationState: "not_run",
    historyState: forensics ? forensics.historyAppeared ? "appeared" : "missing" : "not_run",
    latentDimensions: promptPayload ? { height: sizeInputs.height, width: sizeInputs.width } : undefined,
    modelNames: promptPayload ? modelNames(promptPayload) : [],
    outputDetectionState: forensics ? forensics.outputsAppearButNotImported ? "detected" : "missing" : "not_run",
    promptId,
    queueState: forensics
      ? forensics.queuePendingContainsPrompt
        ? "pending"
        : forensics.promptIdRemainsRunning
          ? "running"
          : forensics.outputsAppearButNotImported
            ? "completed"
            : "unknown"
      : "not_run",
    sampler: samplerInputs.sampler_name,
    scheduler: samplerInputs.scheduler,
    steps: samplerInputs.steps,
    timeoutPhase: forensics?.timeoutClassification,
    workflowId: WORKFLOW_ID,
  };
}

async function buildPrompt(mode: FluxFastConceptRunMode): Promise<Record<string, unknown>> {
  const prepared = await prepareComfyWorkflowPrompt({
    negativePrompt: "text, watermark, logo, blurry, corrupted",
    projectId: mode === "minimal" ? "certification-flux-fast-concept-minimal" : "certification-flux-fast-concept-standard",
    prompt: "simple cinematic test frame, soft light, abstract geometric object, no text",
    smokeTest: mode === "minimal",
    workflowType: WORKFLOW_ID,
  });

  if (mode === "minimal") {
    applyMinimalOverrides(prepared.promptPayload);
  }

  return prepared.promptPayload;
}

function classifyRunFailure(run: FluxFastConceptRunResult): FluxFastConceptClassification {
  if (run.telemetry.outputDetectionState === "detected" && run.telemetry.artifactValidationState === "failed") {
    return "output_import_failure";
  }

  if (run.telemetry.timeoutPhase === "running_no_history") {
    return "workflow_runtime_hang";
  }

  return "minimal_runtime_failed";
}

async function runFluxFastConceptAttempt({
  client,
  mode,
}: {
  client: Pick<ComfyClient, "downloadOutput" | "retrieveOutputs" | "submitPrompt">;
  mode: FluxFastConceptRunMode;
}): Promise<FluxFastConceptRunResult> {
  let promptPayload: Record<string, unknown> | undefined;
  let promptId: string | undefined;

  try {
    promptPayload = await buildPrompt(mode);
    const queued = await client.submitPrompt({ prompt: promptPayload });
    promptId = queued.promptId;
    const forensics = await collectComfyRuntimeForensics({
      comfyUrl: getComfyUrl(),
      promptId,
      promptPayload,
      timeoutMs: getTimeoutMs(mode),
      workflowType: WORKFLOW_ID,
    });

    const telemetry = createTelemetry({ forensics, promptId, promptPayload });
    if (!forensics.outputsAppearButNotImported) {
      return {
        classification: mode === "minimal" ? classifyRunFailure({ mode, passed: false, telemetry }) : "production_config_too_heavy",
        forensics,
        mode,
        passed: false,
        telemetry,
      };
    }

    try {
      const outputs = await client.retrieveOutputs(promptId);
      const firstOutput = outputs[0];
      if (!firstOutput) {
        return {
          classification: "output_import_failure",
          forensics,
          mode,
          passed: false,
          telemetry: { ...telemetry, artifactValidationState: "failed" },
        };
      }

      const bytes = await client.downloadOutput(firstOutput);
      if (bytes.length === 0) {
        return {
          classification: "output_import_failure",
          forensics,
          mode,
          passed: false,
          telemetry: { ...telemetry, artifactValidationState: "failed" },
        };
      }

      return {
        mode,
        passed: true,
        telemetry: {
          ...telemetry,
          artifactValidationState: "passed",
          outputDetectionState: "detected",
        },
      };
    } catch (error) {
      return {
        classification: "output_import_failure",
        error: error instanceof Error ? error.message : String(error),
        forensics,
        mode,
        passed: false,
        telemetry: { ...telemetry, artifactValidationState: "failed" },
      };
    }
  } catch (error) {
    return {
      classification: mode === "minimal" ? "minimal_runtime_failed" : "production_config_too_heavy",
      error: error instanceof Error ? error.message : String(error),
      mode,
      passed: false,
      telemetry: createTelemetry({ promptId, promptPayload }),
    };
  }
}

function staticResult(validation: ComfyWorkflowValidationResult): FluxFastConceptCertificationReport["staticValidation"] {
  return {
    errors: validation.errors,
    modelFiles: validation.modelFiles,
    nodeMapping: validation.nodeMapping,
    passed: validation.valid,
    warnings: validation.warnings,
  };
}

function recommendationFor(classification: FluxFastConceptClassification): string {
  switch (classification) {
    case "static_validation_failed":
      return "Fix workflow file, node mappings, or model resolution before attempting runtime certification.";
    case "workflow_runtime_hang":
      return "Inspect Comfy runtime logs and node execution for the minimal FLUX workflow; provider lifecycle remains valid.";
    case "production_config_too_heavy":
      return "Reduce production settings such as steps, resolution, model variant, or increase workflow-specific certification timeout.";
    case "output_import_failure":
      return "Fix Comfy output resolver or artifact import separately; this is not a provider timeout.";
    case "production_certified":
      return "Update workflow certification registry only after confirming this result in the durable report.";
    default:
      return "Keep flux-fast-concept blocked and use runtime telemetry to isolate the workflow failure.";
  }
}

export async function runFluxFastConceptCertificationLadder({
  client = new ComfyClient({ baseUrl: getComfyUrl() }),
}: {
  client?: Pick<ComfyClient, "downloadOutput" | "retrieveOutputs" | "submitPrompt">;
} = {}): Promise<FluxFastConceptCertificationReport> {
  const validation = await validateComfyWorkflow(WORKFLOW_ID);
  const emptyRun = (mode: FluxFastConceptRunMode): FluxFastConceptRunResult => ({
    mode,
    passed: false,
    telemetry: createTelemetry({}),
  });

  if (!validation.valid) {
    return {
      classification: "static_validation_failed",
      generatedAt: new Date().toISOString(),
      minimalRun: emptyRun("minimal"),
      recommendation: recommendationFor("static_validation_failed"),
      standardRun: emptyRun("standard"),
      staticValidation: staticResult(validation),
      workflowId: WORKFLOW_ID,
    };
  }

  const minimalRun = await runFluxFastConceptAttempt({ client, mode: "minimal" });
  if (!minimalRun.passed) {
    const classification = minimalRun.classification === "workflow_runtime_hang"
      ? "workflow_runtime_hang"
      : minimalRun.classification ?? "minimal_runtime_failed";
    return {
      classification,
      generatedAt: new Date().toISOString(),
      minimalRun,
      recommendation: recommendationFor(classification),
      standardRun: emptyRun("standard"),
      staticValidation: staticResult(validation),
      workflowId: WORKFLOW_ID,
    };
  }

  const standardRun = await runFluxFastConceptAttempt({ client, mode: "standard" });
  if (!standardRun.passed) {
    const classification = standardRun.classification === "output_import_failure"
      ? "output_import_failure"
      : "production_config_too_heavy";
    return {
      classification,
      generatedAt: new Date().toISOString(),
      minimalRun,
      recommendation: recommendationFor(classification),
      standardRun,
      staticValidation: staticResult(validation),
      workflowId: WORKFLOW_ID,
    };
  }

  return {
    classification: "production_certified",
    generatedAt: new Date().toISOString(),
    minimalRun,
    recommendation: recommendationFor("production_certified"),
    standardRun,
    staticValidation: staticResult(validation),
    workflowId: WORKFLOW_ID,
  };
}

export async function writeFluxFastConceptCertificationReport(
  report: FluxFastConceptCertificationReport,
): Promise<string> {
  const lines = [
    "# Flux Fast Concept Certification Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Final classification: \`${report.classification}\``,
    "",
    "## Static Validation",
    "",
    `Status: ${report.staticValidation.passed ? "`passed`" : "`failed`"}`,
    "",
    `Model files: ${report.staticValidation.modelFiles.map((file) => `\`${file}\``).join(", ") || "none"}`,
    "",
    `Node mapping: \`${JSON.stringify(report.staticValidation.nodeMapping)}\``,
    "",
    `Errors: ${report.staticValidation.errors.length > 0 ? report.staticValidation.errors.map((error) => `\`${error}\``).join(", ") : "none"}`,
    "",
    "## Minimal Run",
    "",
    `Status: ${report.minimalRun.passed ? "`passed`" : "`failed`"}`,
    "",
    `Timeout phase: \`${report.minimalRun.telemetry.timeoutPhase ?? "not_run"}\``,
    "",
    `Queue state: \`${report.minimalRun.telemetry.queueState}\``,
    "",
    `History state: \`${report.minimalRun.telemetry.historyState}\``,
    "",
    `Output detection: \`${report.minimalRun.telemetry.outputDetectionState}\``,
    "",
    `Artifact validation: \`${report.minimalRun.telemetry.artifactValidationState}\``,
    "",
    "## Standard Run",
    "",
    `Status: ${report.standardRun.passed ? "`passed`" : "`failed`"}`,
    "",
    `Timeout phase: \`${report.standardRun.telemetry.timeoutPhase ?? "not_run"}\``,
    "",
    `Queue state: \`${report.standardRun.telemetry.queueState}\``,
    "",
    `History state: \`${report.standardRun.telemetry.historyState}\``,
    "",
    `Output detection: \`${report.standardRun.telemetry.outputDetectionState}\``,
    "",
    `Artifact validation: \`${report.standardRun.telemetry.artifactValidationState}\``,
    "",
    "## Recommended Fix",
    "",
    report.recommendation,
    "",
  ];

  await writeFile(REPORT_PATH, lines.join("\n"), "utf8");
  return REPORT_PATH;
}
