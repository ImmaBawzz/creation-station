export type RollbackActionType = "file_creation" | "file_edit" | "task_state_change";

export type RollbackReference = {
  rollbackId: string;
  actionType: RollbackActionType;
  canRollback: boolean;
  summary: string;
  simulatedSteps: string[];
};

export type RollbackSimulationResult = {
  rollbackId: string;
  status: "ready" | "failed";
  message: string;
};

export function createRollbackReference({
  actionType,
  runId,
  taskId,
}: {
  actionType: RollbackActionType;
  runId: string;
  taskId: string;
}): RollbackReference {
  const rollbackId = `${runId}:${taskId}:${actionType}:rollback`;

  if (actionType === "file_creation") {
    return {
      rollbackId,
      actionType,
      canRollback: true,
      summary: "Would remove the simulated file creation record.",
      simulatedSteps: [
        "Confirm the created path belongs to the planned workspace.",
        "Discard the simulated file creation preview.",
        "Leave the real filesystem unchanged.",
      ],
    };
  }

  if (actionType === "file_edit") {
    return {
      rollbackId,
      actionType,
      canRollback: true,
      summary: "Would restore the simulated pre-edit content snapshot.",
      simulatedSteps: [
        "Compare simulated before and after content.",
        "Discard the simulated edited content.",
        "Leave the real file unchanged.",
      ],
    };
  }

  return {
    rollbackId,
    actionType,
    canRollback: true,
    summary: "Would restore the simulated prior task state.",
    simulatedSteps: [
      "Read the simulated previous task state.",
      "Discard the simulated state transition.",
      "Leave the real task record unchanged.",
    ],
  };
}

export function simulateRollback(reference: RollbackReference | null): RollbackSimulationResult {
  if (!reference) {
    return {
      rollbackId: "missing-rollback-reference",
      status: "failed",
      message: "Rollback failed because the rollback reference is missing.",
    };
  }

  if (!reference.canRollback || reference.simulatedSteps.length === 0) {
    return {
      rollbackId: reference.rollbackId,
      status: "failed",
      message: "Rollback failed because the simulation reference is incomplete.",
    };
  }

  return {
    rollbackId: reference.rollbackId,
    status: "ready",
    message: reference.summary,
  };
}
