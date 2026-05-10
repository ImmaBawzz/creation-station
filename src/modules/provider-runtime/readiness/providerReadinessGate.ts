import { getProviderAdapter } from "../providerRegistry";
import type { ProviderJobRequest, ProviderType } from "../types";
import { getArtifactReadinessWarnings } from "./artifactReadiness";
import { getCredentialRequirements, hasProviderCredentials } from "./credentialReadiness";
import { getProviderEnableRequirements, isProviderExecutionEnabled } from "./endpointReadiness";
import { getProviderRuntimeExecutionMode } from "./executionMode";
import { mapPayloadForInspection } from "./payloadReadiness";
import { evaluateJobWorkflowCertificationGate, getProviderWorkflowCertificationState } from "../workflowCertification";
import type {
  ProviderGateDecision,
  ProviderPayloadInspection,
  ProviderReadinessLevel,
  ProviderReadinessReport,
} from "./readinessTypes";

const PROVIDERS: ProviderType[] = ["mock", "comfy", "wan", "kling", "runway"];

function hasAdapter(providerId: ProviderType): boolean {
  try {
    getProviderAdapter(providerId);
    return true;
  } catch {
    return false;
  }
}

function rankReadinessLevel(providerId: ProviderType, payloadReady: boolean): ProviderReadinessLevel {
  if (providerId === "mock") {
    return "executionReady";
  }

  if (!hasAdapter(providerId)) {
    return "unavailable";
  }

  if (isProviderExecutionEnabled(providerId) && hasProviderCredentials(providerId)) {
    return "executionReady";
  }

  if (hasProviderCredentials(providerId)) {
    return "certificationReady";
  }

  if (payloadReady) {
    return "dryRunReady";
  }

  return "inspectable";
}

function summarizeCapabilities(level: ProviderReadinessLevel) {
  return {
    canCertify: level === "certificationReady" || level === "executionReady",
    canDryRun: level === "dryRunReady" || level === "certificationReady" || level === "executionReady",
    canExecute: level === "executionReady",
    canInspect: level !== "unavailable",
  };
}

export function getProviderReadiness(providerId: ProviderType, job?: ProviderJobRequest): ProviderReadinessReport {
  const executionMode = getProviderRuntimeExecutionMode();
  const warnings = getArtifactReadinessWarnings(providerId);
  const missingRequirements: string[] = [];
  const payload = job ? mapPayloadForInspection(job) : { missingRequirements: [], warnings: [] };
  const workflowGate = job ? evaluateJobWorkflowCertificationGate(job) : undefined;
  const providerWorkflowState = getProviderWorkflowCertificationState(providerId);

  missingRequirements.push(...payload.missingRequirements);
  warnings.push(...payload.warnings);
  if (workflowGate) {
    warnings.push(...workflowGate.warnings);
  }

  const payloadReady = payload.missingRequirements.length === 0;
  let readinessLevel = rankReadinessLevel(providerId, payloadReady);

  if (providerId !== "mock" && executionMode === "disabled") {
    readinessLevel = readinessLevel === "unavailable" ? "unavailable" : "inspectable";
    missingRequirements.push("PROVIDER_RUNTIME_EXECUTION_MODE");
  }

  if (providerId !== "mock" && (executionMode === "certify" || executionMode === "execute")) {
    missingRequirements.push(...getCredentialRequirements(providerId));
  }

  if (providerId !== "mock" && executionMode === "execute") {
    missingRequirements.push(...getProviderEnableRequirements(providerId));
    if (workflowGate) {
      missingRequirements.push(...workflowGate.missingRequirements);
    }
    if (!isProviderExecutionEnabled(providerId) || !hasProviderCredentials(providerId)) {
      readinessLevel = hasAdapter(providerId) ? "dryRunReady" : "unavailable";
    }
    if (workflowGate && !workflowGate.canExecuteWorkflow) {
      readinessLevel = hasAdapter(providerId) ? "certificationReady" : "unavailable";
    }
  }

  const uniqueMissingRequirements = [...new Set(missingRequirements)];
  const capabilities = summarizeCapabilities(readinessLevel);

  return {
    ...capabilities,
    executionMode,
    missingRequirements: uniqueMissingRequirements,
    providerId,
    providerLifecycleStatus: workflowGate?.providerLifecycleStatus ?? providerWorkflowState.providerLifecycleStatus,
    readinessLevel,
    warnings: [...new Set(warnings)],
    workflowCertificationStatus: workflowGate?.workflowCertificationStatus,
    workflowState: workflowGate?.workflowState,
  };
}

export function listProviderReadiness(): ProviderReadinessReport[] {
  return PROVIDERS.map((providerId) => getProviderReadiness(providerId));
}

export function inspectProviderPayload(job: ProviderJobRequest): ProviderPayloadInspection {
  const readiness = getProviderReadiness(job.provider, job);
  const payload = mapPayloadForInspection(job);

  return {
    ...readiness,
    canExecuteWorkflow: readiness.workflowState ? readiness.canExecute && readiness.workflowCertificationStatus === "production_certified" : undefined,
    mappedPayload: payload.mappedPayload,
    missingRequirements: [...new Set([...readiness.missingRequirements, ...payload.missingRequirements])],
    warnings: [...new Set([...readiness.warnings, ...payload.warnings])],
    workflowId: typeof job.workflowId === "string" ? job.workflowId : undefined,
  };
}

export function evaluateProviderGate(job: ProviderJobRequest): ProviderGateDecision {
  const inspection = inspectProviderPayload(job);

  if (job.provider === "mock") {
    return { action: "execute", inspection };
  }

  if (inspection.missingRequirements.includes("provider_payload_invalid")) {
    return {
      action: "block",
      errorCode: "provider_payload_invalid",
      inspection,
      message: "provider_payload_invalid: provider payload failed local validation.",
    };
  }

  if (inspection.missingRequirements.includes("provider_missing_reference_asset")) {
    return {
      action: "block",
      errorCode: "provider_missing_reference_asset",
      inspection,
      message: "provider_missing_reference_asset: provider payload is missing a primary reference asset.",
    };
  }

  if (inspection.executionMode === "inspect") {
    return { action: "inspect", inspection };
  }

  if (inspection.executionMode === "dry-run") {
    return { action: "dry-run", inspection };
  }

  if (inspection.executionMode === "certify" && inspection.canCertify) {
    return { action: "execute", inspection };
  }

  if (inspection.executionMode === "execute" && inspection.canExecute) {
    return { action: "execute", inspection };
  }

  return {
    action: "block",
    errorCode: "provider_unavailable",
    inspection,
    message: `provider_unavailable: ${job.provider} is not allowed to submit jobs in ${inspection.executionMode} mode.`,
  };
}
