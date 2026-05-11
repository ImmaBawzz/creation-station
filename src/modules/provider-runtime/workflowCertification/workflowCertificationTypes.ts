import type { ProviderType } from "../types";

export type ProviderLifecycleStatus =
  | "uncertified"
  | "lifecycle_certified"
  | "failed"
  | "skipped_offline";

export type WorkflowCertificationStatus =
  | "uncertified"
  | "smoke_only"
  | "production_certified"
  | "timeout"
  | "failed"
  | "missing_model"
  | "missing_workflow"
  | "output_invalid";

export type WorkflowCertificationState = {
  certifiedAt?: string;
  classification?: string;
  provider: ProviderType;
  reason?: string;
  status: WorkflowCertificationStatus;
  workflowId: string;
};

export type ProviderWorkflowCertificationState = {
  provider: ProviderType;
  providerLifecycleStatus: ProviderLifecycleStatus;
  workflows: Record<string, WorkflowCertificationState>;
};

export type WorkflowCertificationGateResult = {
  canExecuteWorkflow: boolean;
  missingRequirements: string[];
  providerLifecycleStatus: ProviderLifecycleStatus;
  providerWorkflowState: ProviderWorkflowCertificationState;
  warnings: string[];
  workflowCertificationStatus: WorkflowCertificationStatus;
  workflowId: string;
  workflowState: WorkflowCertificationState;
};
