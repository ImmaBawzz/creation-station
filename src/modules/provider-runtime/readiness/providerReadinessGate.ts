import { getProviderAdapter } from "../providerRegistry";
import type { ProviderJobRequest, ProviderType } from "../types";
import { getArtifactReadinessWarnings } from "./artifactReadiness";
import { getCredentialRequirements, hasProviderCredentials } from "./credentialReadiness";
import { getProviderEnableRequirements, isProviderExecutionEnabled } from "./endpointReadiness";
import { getProviderRuntimeExecutionMode } from "./executionMode";
import { mapPayloadForInspection } from "./payloadReadiness";
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

  missingRequirements.push(...payload.missingRequirements);
  warnings.push(...payload.warnings);

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
    if (!isProviderExecutionEnabled(providerId) || !hasProviderCredentials(providerId)) {
      readinessLevel = hasAdapter(providerId) ? "dryRunReady" : "unavailable";
    }
  }

  const uniqueMissingRequirements = [...new Set(missingRequirements)];
  const capabilities = summarizeCapabilities(readinessLevel);

  return {
    ...capabilities,
    executionMode,
    missingRequirements: uniqueMissingRequirements,
    providerId,
    readinessLevel,
    warnings: [...new Set(warnings)],
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
    mappedPayload: payload.mappedPayload,
    missingRequirements: [...new Set([...readiness.missingRequirements, ...payload.missingRequirements])],
    warnings: [...new Set([...readiness.warnings, ...payload.warnings])],
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
