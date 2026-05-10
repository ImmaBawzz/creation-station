import type { ProviderType } from "../types";
import type {
  ProviderLifecycleStatus,
  ProviderWorkflowCertificationState,
  WorkflowCertificationState,
} from "./workflowCertificationTypes";

const PROVIDERS: ProviderType[] = ["mock", "comfy", "wan", "kling", "runway"];

const DEFAULT_STATE: Record<ProviderType, ProviderWorkflowCertificationState> = {
  mock: {
    provider: "mock",
    providerLifecycleStatus: "lifecycle_certified",
    workflows: {
      mock: {
        provider: "mock",
        status: "production_certified",
        workflowId: "mock",
      },
    },
  },
  comfy: {
    provider: "comfy",
    providerLifecycleStatus: "lifecycle_certified",
    workflows: {
      "flux-dev-cinematic": {
        provider: "comfy",
        status: "uncertified",
        workflowId: "flux-dev-cinematic",
      },
      "flux-fast-concept": {
        classification: "running_no_history",
        provider: "comfy",
        reason: "Production certification timed out while Comfy reported the prompt running without history.",
        status: "timeout",
        workflowId: "flux-fast-concept",
      },
    },
  },
  wan: {
    provider: "wan",
    providerLifecycleStatus: "uncertified",
    workflows: {},
  },
  kling: {
    provider: "kling",
    providerLifecycleStatus: "uncertified",
    workflows: {},
  },
  runway: {
    provider: "runway",
    providerLifecycleStatus: "uncertified",
    workflows: {},
  },
};

let registryState: Record<ProviderType, ProviderWorkflowCertificationState> = cloneState(DEFAULT_STATE);

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function resetWorkflowCertificationRegistry(): void {
  registryState = cloneState(DEFAULT_STATE);
}

export function getProviderWorkflowCertificationState(provider: ProviderType): ProviderWorkflowCertificationState {
  return cloneState(registryState[provider]);
}

export function listProviderWorkflowCertificationStates(): ProviderWorkflowCertificationState[] {
  return PROVIDERS.map((provider) => getProviderWorkflowCertificationState(provider));
}

export function getWorkflowCertificationState(
  provider: ProviderType,
  workflowId: string | undefined,
): WorkflowCertificationState {
  const normalizedWorkflowId = workflowId?.trim() || (provider === "mock" ? "mock" : "default");
  const providerState = registryState[provider];
  const existing = providerState.workflows[normalizedWorkflowId];

  if (existing) {
    return cloneState(existing);
  }

  return {
    provider,
    status: "uncertified",
    workflowId: normalizedWorkflowId,
  };
}

export function setProviderLifecycleStatus(provider: ProviderType, status: ProviderLifecycleStatus): void {
  registryState[provider] = {
    ...registryState[provider],
    providerLifecycleStatus: status,
  };
}

export function setWorkflowCertificationState(state: WorkflowCertificationState): void {
  const providerState = registryState[state.provider];
  registryState[state.provider] = {
    ...providerState,
    workflows: {
      ...providerState.workflows,
      [state.workflowId]: cloneState(state),
    },
  };
}
