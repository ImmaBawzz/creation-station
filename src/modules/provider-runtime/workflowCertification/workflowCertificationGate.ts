import type { ProviderJobRequest, ProviderType } from "../types";
import {
  getProviderWorkflowCertificationState,
  getWorkflowCertificationState,
} from "./workflowCertificationRegistry";
import type { WorkflowCertificationGateResult } from "./workflowCertificationTypes";

export function evaluateWorkflowCertificationGate(
  provider: ProviderType,
  workflowId: string | undefined,
): WorkflowCertificationGateResult {
  const providerWorkflowState = getProviderWorkflowCertificationState(provider);
  const workflowState = getWorkflowCertificationState(provider, workflowId);
  const missingRequirements: string[] = [];
  const warnings: string[] = [];

  if (providerWorkflowState.providerLifecycleStatus !== "lifecycle_certified") {
    missingRequirements.push("provider_lifecycle_certification");
  }

  if (workflowState.status !== "production_certified") {
    missingRequirements.push("workflow_production_certification");
    if (workflowState.status === "timeout") {
      warnings.push(`Workflow ${workflowState.workflowId} remains blocked after timeout classification ${workflowState.classification ?? "unknown"}.`);
    }
    if (workflowState.status === "smoke_only") {
      warnings.push(`Workflow ${workflowState.workflowId} has smoke-only coverage and is not production-certified.`);
    }
  }

  return {
    canExecuteWorkflow: missingRequirements.length === 0,
    missingRequirements,
    providerLifecycleStatus: providerWorkflowState.providerLifecycleStatus,
    providerWorkflowState,
    warnings,
    workflowCertificationStatus: workflowState.status,
    workflowId: workflowState.workflowId,
    workflowState,
  };
}

export function evaluateJobWorkflowCertificationGate(job: ProviderJobRequest): WorkflowCertificationGateResult {
  return evaluateWorkflowCertificationGate(job.provider, typeof job.workflowId === "string" ? job.workflowId : undefined);
}
