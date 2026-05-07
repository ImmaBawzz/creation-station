import {
  listRegisteredActions,
  type ActionApprovalRequirement,
  type ActionRegistryEntry,
  type ActionRiskLevel,
} from "@/lib/autonomy/action-registry";
import {
  buildExecutionQueue,
  type ExecutionQueueItem,
  type ExecutionQueueOptions,
  type ExecutionQueuePreview,
} from "@/lib/autonomy/execution-queue";
import type { ExecutionActionRequest } from "@/lib/autonomy/execution-sandbox";
import {
  validateLiveExecutionUnlock,
  type LiveUnlockValidation,
} from "@/lib/autonomy/live-unlock";
import {
  buildToolAdapterPreview,
  type AdapterExecutionMode,
} from "@/lib/autonomy/tool-adapters";
import {
  DEFAULT_WORKSPACE_CAPABILITIES,
  type WorkspaceCapabilities,
} from "@/lib/autonomy/workspace-permissions";
import type { ExecutionAuditLogEntry } from "@/lib/autonomy/execution-audit-log";

export type ExecutionKernelPreview = {
  registry: ActionRegistryEntry[];
  queue: ExecutionQueuePreview;
  executionHistory: ExecutionQueueItem[];
  approvalSummary: Record<ActionApprovalRequirement, number>;
  riskSummary: Record<ActionRiskLevel, number>;
  sandboxViolations: Array<{
    actionId: string;
    reasons: string[];
  }>;
  toolAdapters: {
    auditLog: readonly ExecutionAuditLogEntry[];
    capabilities: WorkspaceCapabilities;
    commandWhitelist: readonly string[];
    liveUnlock: LiveUnlockValidation;
    mode: AdapterExecutionMode;
    writableDirectories: readonly string[];
  };
  trustBoundary: "simulation_only";
};

export function defaultExecutionKernelRequests(stateHash = "preview-state"): ExecutionActionRequest[] {
  return [
    {
      id: "kernel-file-read",
      type: "file_read",
      payload: { path: "docs/autonomy/EXECUTION_KERNEL_SPEC.md" },
      expectedStateHash: stateHash,
    },
    {
      id: "kernel-file-write",
      type: "file_write",
      payload: {
        content: "Simulated execution note. This preview does not write to disk.",
        path: "output/agent-next-input.md",
      },
      expectedStateHash: stateHash,
    },
    {
      id: "kernel-browser-open",
      type: "browser_open",
      payload: { url: "http://localhost:3000" },
      expectedStateHash: stateHash,
    },
    {
      id: "kernel-api-request",
      type: "api_request",
      payload: { method: "GET", url: "http://localhost:3000/api/analytics" },
      expectedStateHash: stateHash,
    },
    {
      id: "kernel-git-commit",
      type: "git_commit",
      payload: { message: "Record focused execution kernel change" },
      expectedStateHash: stateHash,
    },
    {
      id: "kernel-terminal-command",
      type: "terminal_command",
      payload: { command: "npm run lint" },
      expectedStateHash: stateHash,
    },
  ];
}

export function buildExecutionKernelPreview({
  currentStateHash = "preview-state",
  options,
  requests = defaultExecutionKernelRequests(currentStateHash),
}: {
  currentStateHash?: string;
  options?: Omit<ExecutionQueueOptions, "currentStateHash">;
  requests?: ExecutionActionRequest[];
} = {}): ExecutionKernelPreview {
  const queue = buildExecutionQueue(requests, {
    ...options,
    currentStateHash,
  });
  const approvalSummary: Record<ActionApprovalRequirement, number> = {
    auto: 0,
    manual_override: 0,
    user_approval: 0,
  };
  const riskSummary: Record<ActionRiskLevel, number> = {
    high: 0,
    low: 0,
    medium: 0,
  };

  for (const item of queue.items) {
    if (item.approvalRequirement !== "blocked") {
      approvalSummary[item.approvalRequirement] += 1;
    }

    if (item.riskLevel !== "unknown") {
      riskSummary[item.riskLevel] += 1;
    }
  }
  const toolAdapterPreview = buildToolAdapterPreview();
  const fileWriteAction =
    requests.find((request) => request.type === "file_write") ?? requests[0];
  const liveUnlock = validateLiveExecutionUnlock({
    action: fileWriteAction,
    approvals: queue.approvalRequests,
    capabilities: DEFAULT_WORKSPACE_CAPABILITIES,
    snapshots: [],
  });

  return {
    registry: listRegisteredActions(),
    queue,
    executionHistory: queue.items,
    approvalSummary,
    riskSummary,
    sandboxViolations: queue.items
      .filter((item) => item.sandbox.blocked)
      .map((item) => ({
        actionId: item.id,
        reasons: item.sandbox.reasons,
      })),
    toolAdapters: {
      ...toolAdapterPreview,
      capabilities: DEFAULT_WORKSPACE_CAPABILITIES,
      liveUnlock,
    },
    trustBoundary: "simulation_only",
  };
}
