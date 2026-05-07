import { approvalRequirementForRisk } from "@/lib/autonomy/approval-policy";
import type {
  ActionApprovalRequirement,
  ActionRegistryEntry,
  ActionRiskLevel,
  RollbackBehavior,
} from "@/lib/autonomy/action-registry";
import {
  validateExecutionAction,
  type ExecutionActionRequest,
  type SandboxValidation,
} from "@/lib/autonomy/execution-sandbox";

export type ExecutionQueueStatus =
  | "auto_simulated"
  | "approval_pending"
  | "blocked"
  | "cancelled"
  | "failed"
  | "manual_override_required"
  | "retry_scheduled"
  | "stale_rejected";

export type FailureLog = {
  actionId: string;
  message: string;
  retryCount: number;
  retryLimit: number;
  rollbackSummary: string;
};

export type ApprovalRequestRecord = {
  actionId: string;
  actionType: string;
  idempotencyKey: string;
  reason: string;
  reusedByActionIds: string[];
  status: "pending";
};

export type ExecutionQueueItem = {
  approvalRequestKey: string | null;
  id: string;
  type: string;
  label: string;
  riskLevel: ActionRiskLevel | "unknown";
  approvalRequirement: ActionApprovalRequirement | "blocked";
  rollbackBehavior: RollbackBehavior;
  timeoutMs: number;
  retryLimit: number;
  status: ExecutionQueueStatus;
  reason: string;
  simulatedEffects: string[];
  sandbox: SandboxValidation;
};

export type ExecutionQueuePreview = {
  activeHighRiskActionId: string | null;
  approvalRequests: ApprovalRequestRecord[];
  items: ExecutionQueueItem[];
  failureLogs: FailureLog[];
  rollbackControls: Array<{
    actionId: string;
    enabled: boolean;
    summary: string;
  }>;
};

export type ExecutionQueueOptions = {
  cancelledActionIds?: string[];
  currentStateHash?: string;
  failedActionIds?: string[];
  retryCountsByActionId?: Record<string, number>;
};

const blockedRollback: RollbackBehavior = {
  strategy: "none",
  summary: "Blocked before execution; no rollback is required.",
};

function stablePayloadValue(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, stablePayloadValue(nestedValue)]),
  );
}

export function buildApprovalRequestIdempotencyKey(request: ExecutionActionRequest): string {
  return `${request.type}:${JSON.stringify(stablePayloadValue(request.payload))}`;
}

function blockedItem({
  request,
  sandbox,
  status,
}: {
  request: ExecutionActionRequest;
  sandbox: SandboxValidation;
  status: ExecutionQueueStatus;
}): ExecutionQueueItem {
  return {
    approvalRequestKey: null,
    id: request.id,
    type: request.type,
    label: request.type,
    riskLevel: sandbox.action?.riskLevel ?? "unknown",
    approvalRequirement: "blocked",
    rollbackBehavior: sandbox.action?.rollbackBehavior ?? blockedRollback,
    timeoutMs: sandbox.action?.timeoutMs ?? 0,
    retryLimit: sandbox.action?.retryLimit ?? 0,
    status,
    reason: sandbox.reasons.join(" ") || "Action was blocked by execution policy.",
    simulatedEffects: sandbox.simulatedEffects,
    sandbox,
  };
}

function initialStatusFor(
  action: ActionRegistryEntry,
  request?: ExecutionActionRequest,
): ExecutionQueueStatus {
  if (!request || (request.type !== "file_read" && request.type !== "file_write")) {
    return "manual_override_required";
  }

  const approvalRequirement = approvalRequirementForRisk(action.riskLevel);

  if (approvalRequirement === "auto") {
    return "auto_simulated";
  }

  if (approvalRequirement === "user_approval") {
    return "approval_pending";
  }

  return "manual_override_required";
}

export function buildExecutionQueue(
  requests: ExecutionActionRequest[],
  options: ExecutionQueueOptions = {},
): ExecutionQueuePreview {
  const cancelledActionIds = new Set(options.cancelledActionIds ?? []);
  const failedActionIds = new Set(options.failedActionIds ?? []);
  const retryCountsByActionId = options.retryCountsByActionId ?? {};
  const items: ExecutionQueueItem[] = [];
  const approvalRequestByKey = new Map<string, ApprovalRequestRecord>();
  const failureLogs: FailureLog[] = [];
  let activeHighRiskActionId: string | null = null;

  for (const request of requests) {
    const sandbox = validateExecutionAction(request);

    if (cancelledActionIds.has(request.id)) {
      items.push({
        approvalRequestKey: null,
        id: request.id,
        type: request.type,
        label: sandbox.action?.label ?? request.type,
        riskLevel: sandbox.action?.riskLevel ?? "unknown",
        approvalRequirement: sandbox.action?.approvalRequirement ?? "blocked",
        rollbackBehavior: sandbox.action?.rollbackBehavior ?? blockedRollback,
        timeoutMs: sandbox.action?.timeoutMs ?? 0,
        retryLimit: sandbox.action?.retryLimit ?? 0,
        status: "cancelled",
        reason: "Action was cancelled before execution.",
        simulatedEffects: sandbox.simulatedEffects,
        sandbox,
      });
      continue;
    }

    if (
      request.expectedStateHash &&
      options.currentStateHash &&
      request.expectedStateHash !== options.currentStateHash
    ) {
      items.push(
        blockedItem({
          request,
          sandbox: {
            ...sandbox,
            blocked: true,
            reasons: [
              ...sandbox.reasons,
              "Stale state rejection: current state differs from planned state.",
            ],
          },
          status: "stale_rejected",
        }),
      );
      continue;
    }

    if (sandbox.blocked || !sandbox.action) {
      items.push(blockedItem({ request, sandbox, status: "blocked" }));
      continue;
    }

    if (sandbox.action.riskLevel === "high") {
      if (activeHighRiskActionId) {
        items.push({
          approvalRequestKey: null,
          id: request.id,
          type: request.type,
          label: sandbox.action.label,
          riskLevel: sandbox.action.riskLevel,
          approvalRequirement: sandbox.action.approvalRequirement,
          rollbackBehavior: sandbox.action.rollbackBehavior,
          timeoutMs: sandbox.action.timeoutMs,
          retryLimit: sandbox.action.retryLimit,
          status: "blocked",
          reason: `High-risk action is queued behind ${activeHighRiskActionId}; only one high-risk execution may be active.`,
          simulatedEffects: sandbox.simulatedEffects,
          sandbox,
        });
        continue;
      }

      activeHighRiskActionId = request.id;
    }

    const retryCount = retryCountsByActionId[request.id] ?? 0;
    const failed = failedActionIds.has(request.id);
    const status =
      failed && retryCount < sandbox.action.retryLimit
        ? "retry_scheduled"
        : failed
          ? "failed"
          : initialStatusFor(sandbox.action, request);
    const reason = failed
      ? retryCount < sandbox.action.retryLimit
        ? "Simulated failure captured; retry is scheduled within policy."
        : "Simulated failure captured; retry limit reached."
      : sandbox.action.approvalRequirement === "manual_override"
          ? "Action remains locked until a manual override is supplied."
          : status === "approval_pending"
            ? "Medium-risk action is queued for user approval."
            : status === "manual_override_required"
              ? "Action remains locked until a manual override is supplied."
              : "Low-risk action was auto-approved for simulation.";
    const needsApproval =
      !failed &&
      !sandbox.blocked &&
      request.type === "file_write" &&
      sandbox.action.approvalRequirement === "user_approval";
    let approvalRequestKey: string | null = null;

    if (needsApproval) {
      approvalRequestKey = buildApprovalRequestIdempotencyKey(request);
      const existingApprovalRequest = approvalRequestByKey.get(approvalRequestKey);

      if (existingApprovalRequest) {
        existingApprovalRequest.reusedByActionIds.push(request.id);
      } else {
        approvalRequestByKey.set(approvalRequestKey, {
          actionId: request.id,
          actionType: request.type,
          idempotencyKey: approvalRequestKey,
          reason,
          reusedByActionIds: [],
          status: "pending",
        });
      }
    }

    if (failed) {
      failureLogs.push({
        actionId: request.id,
        message: reason,
        retryCount,
        retryLimit: sandbox.action.retryLimit,
        rollbackSummary: sandbox.action.rollbackBehavior.summary,
      });
    }

    items.push({
      approvalRequestKey,
      id: request.id,
      type: request.type,
      label: sandbox.action.label,
      riskLevel: sandbox.action.riskLevel,
      approvalRequirement: sandbox.action.approvalRequirement,
      rollbackBehavior: sandbox.action.rollbackBehavior,
      timeoutMs: sandbox.action.timeoutMs,
      retryLimit: sandbox.action.retryLimit,
      status,
      reason,
      simulatedEffects: sandbox.simulatedEffects,
      sandbox,
    });
  }

  return {
    activeHighRiskActionId,
    approvalRequests: [...approvalRequestByKey.values()],
    items,
    failureLogs,
    rollbackControls: items.map((item) => ({
      actionId: item.id,
      enabled: ["failed", "retry_scheduled", "approval_pending", "manual_override_required"].includes(
        item.status,
      ),
      summary: item.rollbackBehavior.summary,
    })),
  };
}
