import { describe, expect, it } from "vitest";

import {
  createRollbackReference,
  simulateRollback,
} from "@/lib/autonomy/rollback-manager";

describe("rollback manager", () => {
  it("creates reversible simulations for file creation, file edits, and task state changes", () => {
    expect(
      createRollbackReference({
        actionType: "file_creation",
        runId: "run-a",
        taskId: "task-a",
      }),
    ).toMatchObject({ actionType: "file_creation", canRollback: true });
    expect(
      createRollbackReference({
        actionType: "file_edit",
        runId: "run-a",
        taskId: "task-b",
      }),
    ).toMatchObject({ actionType: "file_edit", canRollback: true });
    expect(
      createRollbackReference({
        actionType: "task_state_change",
        runId: "run-a",
        taskId: "task-c",
      }),
    ).toMatchObject({ actionType: "task_state_change", canRollback: true });
  });

  it("fails safely when rollback reference is missing or incomplete", () => {
    expect(simulateRollback(null)).toMatchObject({
      rollbackId: "missing-rollback-reference",
      status: "failed",
    });

    expect(
      simulateRollback({
        actionType: "file_edit",
        canRollback: false,
        rollbackId: "rollback-a",
        simulatedSteps: [],
        summary: "Broken rollback",
      }),
    ).toMatchObject({ rollbackId: "rollback-a", status: "failed" });
  });
});
