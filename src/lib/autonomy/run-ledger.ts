import {
  createApprovalToken,
  evaluateApprovalGate,
  type ApprovalDecision,
  type ApprovalState,
} from "@/lib/autonomy/approval-gate";
import type { AutonomyExecutionPreview, AutonomyTask } from "@/lib/autonomy/orchestrator";
import { createRollbackReference, type RollbackReference } from "@/lib/autonomy/rollback-manager";
import type { StopPolicyResult } from "@/lib/autonomy/stop-engine";
import type { TaskChainValidation } from "@/lib/autonomy/validator";

export type ExecutionState =
  | "simulation"
  | "approval_pending"
  | "approved"
  | "rejected"
  | "blocked"
  | "failed"
  | "rollback_triggered"
  | "recovered";

export type RunLedgerEntry = {
  runId: string;
  taskId: string;
  taskPayload: AutonomyTask;
  approvalState: ApprovalState;
  executionState: ExecutionState;
  rollbackReference: RollbackReference;
  createdAt: string;
  updatedAt: string;
  validationResult: {
    isValid: boolean;
    warnings: string[];
  };
  stopEngineResult: {
    canContinue: boolean;
    stopReason: string;
  };
  approvalToken: string;
  approvalExpiresAt: string;
};

export type RunLedgerBuildInput = {
  approvalDecision?: ApprovalDecision;
  approvalToken?: string;
  createdAt?: Date;
  executionPreview: AutonomyExecutionPreview[];
  runId: string;
  stopPolicy: StopPolicyResult;
  tasks: AutonomyTask[];
  validation: TaskChainValidation;
};

export type RunLedgerResult = {
  entries: RunLedgerEntry[];
  duplicateRunBlocked: boolean;
  recovered: boolean;
  recoveryMessages: string[];
};

export type RunLedgerRecoveryResult = {
  entries: RunLedgerEntry[];
  recovered: boolean;
  recoveryMessages: string[];
};

function executionStateFor({
  approvalState,
  preview,
}: {
  approvalState: ApprovalState;
  preview: AutonomyExecutionPreview | undefined;
}): ExecutionState {
  if (approvalState === "rejected") {
    return "rejected";
  }

  if (approvalState === "pending" || approvalState === "expired" || approvalState === "stale") {
    return "approval_pending";
  }

  if (preview?.simulatedStatus === "blocked" || preview?.simulatedStatus === "stalled") {
    return "blocked";
  }

  if (preview?.simulatedStatus === "failed") {
    return "failed";
  }

  return "approved";
}

function rollbackTypeForTask(task: AutonomyTask): "file_creation" | "file_edit" | "task_state_change" {
  if (task.action === "plan_draft") {
    return "file_edit";
  }

  if (task.action === "human_checkpoint") {
    return "task_state_change";
  }

  return "file_creation";
}

export function buildRunLedger(input: RunLedgerBuildInput): RunLedgerResult {
  const createdAt = input.createdAt ?? new Date();
  const approvalExpiresAt = new Date(createdAt.getTime() + 15 * 60 * 1_000);
  const seenTaskIds = new Set<string>();
  const recoveryMessages: string[] = [];
  let duplicateRunBlocked = false;
  let recovered = false;

  const entries = input.tasks.map((task) => {
    if (seenTaskIds.has(task.id)) {
      duplicateRunBlocked = true;
      recovered = true;
      recoveryMessages.push(`Duplicate task ${task.id} was recovered as blocked.`);
    }
    seenTaskIds.add(task.id);

    const approvalToken = createApprovalToken({ runId: input.runId, task });
    const approval = evaluateApprovalGate({
      approvalToken: input.approvalToken,
      decision: input.approvalDecision,
      expectedApprovalToken: approvalToken,
      expiresAt: approvalExpiresAt,
      now: createdAt,
      task,
    });
    const preview = input.executionPreview.find((candidate) => candidate.taskId === task.id);
    const executionState = duplicateRunBlocked
      ? "recovered"
      : executionStateFor({ approvalState: approval.approvalState, preview });

    return {
      runId: input.runId,
      taskId: task.id,
      taskPayload: task,
      approvalState: approval.approvalState,
      executionState,
      rollbackReference: createRollbackReference({
        actionType: rollbackTypeForTask(task),
        runId: input.runId,
        taskId: task.id,
      }),
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      validationResult: {
        isValid: input.validation.isValid,
        warnings: input.validation.warnings.map(
          (warning) => `${warning.taskId}: ${warning.reason}`,
        ),
      },
      stopEngineResult: {
        canContinue: input.stopPolicy.canContinue,
        stopReason: input.stopPolicy.stopReason,
      },
      approvalToken,
      approvalExpiresAt: approval.expiresAt,
    } satisfies RunLedgerEntry;
  });

  return {
    entries,
    duplicateRunBlocked,
    recovered,
    recoveryMessages,
  };
}

export function recoverCorruptedRunLedger(
  entries: Array<Partial<RunLedgerEntry>>,
): RunLedgerRecoveryResult {
  const recoveredEntries: RunLedgerEntry[] = [];
  const recoveryMessages: string[] = [];

  for (const entry of entries) {
    if (
      !entry.runId ||
      !entry.taskId ||
      !entry.taskPayload ||
      !entry.rollbackReference ||
      !entry.validationResult ||
      !entry.stopEngineResult
    ) {
      recoveryMessages.push(
        `Corrupted ledger entry ${entry.taskId ?? "missing-task-id"} was dropped.`,
      );
      continue;
    }

    recoveredEntries.push({
      ...entry,
      approvalState: entry.approvalState ?? "pending",
      approvalToken: entry.approvalToken ?? "recovered-missing-approval-token",
      approvalExpiresAt: entry.approvalExpiresAt ?? entry.updatedAt ?? new Date(0).toISOString(),
      createdAt: entry.createdAt ?? new Date(0).toISOString(),
      executionState: "recovered",
      updatedAt: entry.updatedAt ?? new Date(0).toISOString(),
    } as RunLedgerEntry);
  }

  return {
    entries: recoveredEntries,
    recovered: recoveryMessages.length > 0,
    recoveryMessages,
  };
}
