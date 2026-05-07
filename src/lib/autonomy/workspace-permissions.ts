import type { RegisteredActionType } from "@/lib/autonomy/action-registry";

export type WorkspaceCapabilities = {
  canWriteFiles: boolean;
  canRunCommands: boolean;
  canUseGit: boolean;
  canDeploy: boolean;
  canUseExternalApis: boolean;
};

export type WorkspaceCapability = keyof WorkspaceCapabilities;

export const DEFAULT_WORKSPACE_CAPABILITIES: WorkspaceCapabilities = {
  canDeploy: false,
  canRunCommands: false,
  canUseExternalApis: false,
  canUseGit: false,
  canWriteFiles: false,
};

export const SIMULATION_WORKSPACE_CAPABILITIES: WorkspaceCapabilities = {
  canDeploy: false,
  canRunCommands: false,
  canUseExternalApis: false,
  canUseGit: false,
  canWriteFiles: false,
};

export function requiredCapabilityForAction(
  actionType: RegisteredActionType | string,
): WorkspaceCapability | null {
  if (actionType === "file_write") {
    return "canWriteFiles";
  }

  if (actionType === "terminal_command") {
    return "canRunCommands";
  }

  if (actionType === "git_commit") {
    return "canUseGit";
  }

  if (actionType === "api_request") {
    return "canUseExternalApis";
  }

  return null;
}

export function hasWorkspaceCapability({
  actionType,
  capabilities,
}: {
  actionType: RegisteredActionType | string;
  capabilities: WorkspaceCapabilities;
}): boolean {
  const capability = requiredCapabilityForAction(actionType);
  return capability ? capabilities[capability] : true;
}

export function capabilityViolationReason({
  actionType,
  capabilities,
}: {
  actionType: RegisteredActionType | string;
  capabilities: WorkspaceCapabilities;
}): string | null {
  const capability = requiredCapabilityForAction(actionType);

  if (!capability || capabilities[capability]) {
    return null;
  }

  return `Workspace capability ${capability} is required for ${actionType}.`;
}
