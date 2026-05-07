export type RegisteredActionType =
  | "api_request"
  | "browser_open"
  | "file_read"
  | "file_write"
  | "git_commit"
  | "terminal_command";

export type ActionRiskLevel = "low" | "medium" | "high";
export type ActionApprovalRequirement = "auto" | "user_approval" | "manual_override";
export type RollbackStrategy = "none" | "snapshot_restore" | "revert_commit" | "manual_recovery";

export type RollbackBehavior = {
  strategy: RollbackStrategy;
  summary: string;
};

export type ActionRegistryEntry = {
  type: RegisteredActionType;
  label: string;
  riskLevel: ActionRiskLevel;
  approvalRequirement: ActionApprovalRequirement;
  rollbackBehavior: RollbackBehavior;
  timeoutMs: number;
  retryLimit: number;
};

export const ACTION_REGISTRY = {
  file_read: {
    type: "file_read",
    label: "File Read",
    riskLevel: "low",
    approvalRequirement: "auto",
    rollbackBehavior: {
      strategy: "none",
      summary: "Read-only action; no rollback is required.",
    },
    timeoutMs: 5_000,
    retryLimit: 1,
  },
  file_write: {
    type: "file_write",
    label: "File Write",
    riskLevel: "medium",
    approvalRequirement: "user_approval",
    rollbackBehavior: {
      strategy: "snapshot_restore",
      summary: "Restore the pre-write file snapshot before retrying or stopping.",
    },
    timeoutMs: 8_000,
    retryLimit: 1,
  },
  terminal_command: {
    type: "terminal_command",
    label: "Terminal Command",
    riskLevel: "high",
    approvalRequirement: "manual_override",
    rollbackBehavior: {
      strategy: "manual_recovery",
      summary: "Manual operator recovery is required because shell effects are not reliably reversible.",
    },
    timeoutMs: 10_000,
    retryLimit: 0,
  },
  browser_open: {
    type: "browser_open",
    label: "Browser Open",
    riskLevel: "low",
    approvalRequirement: "auto",
    rollbackBehavior: {
      strategy: "none",
      summary: "Navigation preview only; no production state is changed.",
    },
    timeoutMs: 5_000,
    retryLimit: 1,
  },
  api_request: {
    type: "api_request",
    label: "API Request",
    riskLevel: "medium",
    approvalRequirement: "user_approval",
    rollbackBehavior: {
      strategy: "manual_recovery",
      summary: "Inspect response and use the target API's compensating action if mutation occurred.",
    },
    timeoutMs: 10_000,
    retryLimit: 1,
  },
  git_commit: {
    type: "git_commit",
    label: "Git Commit",
    riskLevel: "medium",
    approvalRequirement: "user_approval",
    rollbackBehavior: {
      strategy: "revert_commit",
      summary: "Create a follow-up revert commit if the commit must be undone.",
    },
    timeoutMs: 10_000,
    retryLimit: 0,
  },
} as const satisfies Record<RegisteredActionType, ActionRegistryEntry>;

export function getActionRegistryEntry(type: string): ActionRegistryEntry | null {
  return Object.hasOwn(ACTION_REGISTRY, type)
    ? ACTION_REGISTRY[type as RegisteredActionType]
    : null;
}

export function listRegisteredActions(): ActionRegistryEntry[] {
  return Object.values(ACTION_REGISTRY);
}
