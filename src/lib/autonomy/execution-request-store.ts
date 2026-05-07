import { createHash } from "node:crypto";

import { db } from "@/lib/db";

export type ExecutionRequestStatus =
  | "completed"
  | "failed"
  | "failed_rolled_back"
  | "pending"
  | "running";

export type ExecutionRequestApprovalStatus = "approved" | "pending" | "rejected";

export type ExecutionRequestInput = {
  actionType: string;
  approvalStatus?: ExecutionRequestApprovalStatus;
  payload: Record<string, unknown>;
  taskId?: string;
};

export type ExecutionRequestRecord = {
  actionType: string;
  approvalStatus: string;
  auditLog: string;
  completedAt: Date | null;
  createdAt: Date;
  error: string;
  executionHash: string;
  id: string;
  maxRetries: number;
  payload: string;
  result: string;
  retryCount: number;
  rollbackSnapshotId: string | null;
  rollbackPayload: string;
  status: string;
  taskId: string;
  updatedAt: Date;
  workerId: string | null;
};

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_, nestedValue) => {
    if (!nestedValue || typeof nestedValue !== "object" || Array.isArray(nestedValue)) {
      return nestedValue;
    }

    return Object.fromEntries(
      Object.entries(nestedValue as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  });
}

export function buildExecutionHash(input: ExecutionRequestInput): string {
  return createHash("sha256")
    .update(
      stableJson({
        actionType: input.actionType,
        payload: input.payload,
        taskId: input.taskId ?? "",
      }),
    )
    .digest("hex");
}

export async function createExecutionRequest(
  input: ExecutionRequestInput,
): Promise<{ duplicate: boolean; request: ExecutionRequestRecord }> {
  const executionHash = buildExecutionHash(input);
  const existing = await db.executionRequest.findUnique({
    where: { executionHash },
  });

  if (existing) {
    return {
      duplicate: true,
      request: existing,
    };
  }

  const request = await db.executionRequest.create({
    data: {
      actionType: input.actionType,
      approvalStatus: input.approvalStatus ?? "approved",
      executionHash,
      payload: stableJson(input.payload),
      status: "pending",
      taskId: input.taskId ?? "",
    },
  });

  return {
    duplicate: false,
    request,
  };
}

export async function listRecentExecutionRequests(limit = 10): Promise<ExecutionRequestRecord[]> {
  return db.executionRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function parseExecutionPayload(payload: string): Record<string, unknown> {
  const parsed = JSON.parse(payload) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Execution request payload must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}
