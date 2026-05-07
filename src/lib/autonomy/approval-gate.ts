import type { AutonomyTask } from "@/lib/autonomy/orchestrator";

export type ApprovalDecision = "approve" | "reject" | "";
export type ApprovalState = "pending" | "approved" | "rejected" | "expired" | "stale";

export type ApprovalGateInput = {
  approvalToken?: string;
  decision?: ApprovalDecision;
  expectedApprovalToken: string;
  expiresAt: Date | string;
  now?: Date;
  task: AutonomyTask;
};

export type ApprovalGateResult = {
  approvalState: ApprovalState;
  approvedAt: string | null;
  expiresAt: string;
  reason: string;
  token: string;
};

function stablePayloadSignature(task: AutonomyTask): string {
  return [
    task.id,
    task.order,
    task.title,
    task.description,
    task.action,
    task.dependsOn.join(","),
    task.expectedOutput,
  ].join("|");
}

export function createApprovalToken({
  runId,
  task,
}: {
  runId: string;
  task: AutonomyTask;
}): string {
  let hash = 0;
  const source = `${runId}|${stablePayloadSignature(task)}`;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return `approval-${hash.toString(16)}`;
}

export function evaluateApprovalGate(input: ApprovalGateInput): ApprovalGateResult {
  const now = input.now ?? new Date();
  const expiresAt = new Date(input.expiresAt);

  if (Number.isNaN(expiresAt.getTime()) || now.getTime() > expiresAt.getTime()) {
    return {
      approvalState: "expired",
      approvedAt: null,
      expiresAt: input.expiresAt.toString(),
      reason: "Approval expired before execution could be considered.",
      token: input.expectedApprovalToken,
    };
  }

  if (input.decision === "reject") {
    return {
      approvalState: "rejected",
      approvedAt: null,
      expiresAt: expiresAt.toISOString(),
      reason: "User rejected the controlled execution preview.",
      token: input.expectedApprovalToken,
    };
  }

  if (input.decision === "approve") {
    if (input.approvalToken !== input.expectedApprovalToken) {
      return {
        approvalState: "stale",
        approvedAt: null,
        expiresAt: expiresAt.toISOString(),
        reason: "Approval token does not match the current task payload.",
        token: input.expectedApprovalToken,
      };
    }

    return {
      approvalState: "approved",
      approvedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      reason: "User approval is valid for simulation routing only.",
      token: input.expectedApprovalToken,
    };
  }

  return {
    approvalState: "pending",
    approvedAt: null,
    expiresAt: expiresAt.toISOString(),
    reason: "Explicit approval is required before any execution route can advance.",
    token: input.expectedApprovalToken,
  };
}
