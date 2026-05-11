import type { ProviderJobRequest, ProviderType } from "../types";
import type {
  ProviderLifecycleStatus,
  WorkflowCertificationStatus,
  WorkflowCertificationState,
} from "../workflowCertification";

export type ProviderReadinessLevel =
  | "unavailable"
  | "inspectable"
  | "dryRunReady"
  | "certificationReady"
  | "executionReady";

export type ProviderRuntimeExecutionMode =
  | "disabled"
  | "inspect"
  | "dry-run"
  | "certify"
  | "execute";

export type ProviderReadinessReport = {
  canCertify: boolean;
  canDryRun: boolean;
  canExecute: boolean;
  canInspect: boolean;
  executionMode: ProviderRuntimeExecutionMode;
  missingRequirements: string[];
  providerId: ProviderType;
  providerLifecycleStatus?: ProviderLifecycleStatus;
  readinessLevel: ProviderReadinessLevel;
  warnings: string[];
  workflowCertificationStatus?: WorkflowCertificationStatus;
  workflowState?: WorkflowCertificationState;
};

export type ProviderPayloadInspection = ProviderReadinessReport & {
  canExecuteWorkflow?: boolean;
  mappedPayload?: unknown;
  workflowId?: string;
};

export type ProviderGateDecision =
  | {
      action: "execute";
      inspection: ProviderPayloadInspection;
    }
  | {
      action: "dry-run";
      inspection: ProviderPayloadInspection;
    }
  | {
      action: "inspect";
      inspection: ProviderPayloadInspection;
    }
  | {
      action: "block";
      errorCode: "provider_unavailable" | "provider_payload_invalid" | "provider_missing_reference_asset";
      inspection: ProviderPayloadInspection;
      message: string;
    };

export type ProviderPayloadInspectionInput = {
  job: ProviderJobRequest;
};
