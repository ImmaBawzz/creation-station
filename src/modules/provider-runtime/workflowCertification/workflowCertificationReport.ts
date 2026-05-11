import { getWorkflowCertificationState, listProviderWorkflowCertificationStates } from "./workflowCertificationRegistry";

export function getWorkflowCertificationReport() {
  return {
    providers: listProviderWorkflowCertificationStates(),
  };
}

export function getSingleWorkflowCertificationReport(workflowId: string) {
  const providers = listProviderWorkflowCertificationStates();
  const matches = providers
    .map((providerState) => getWorkflowCertificationState(providerState.provider, workflowId))
    .filter((workflowState) => workflowState.status !== "uncertified" || workflowState.workflowId === workflowId);

  return {
    workflowId,
    workflows: matches,
  };
}
