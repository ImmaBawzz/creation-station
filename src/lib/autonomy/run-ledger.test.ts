import { describe, expect, it } from "vitest";

import { buildRunLedger, recoverCorruptedRunLedger } from "@/lib/autonomy/run-ledger";
import type { AutonomyExecutionPreview, AutonomyTask } from "@/lib/autonomy/orchestrator";
import type { StopPolicyResult } from "@/lib/autonomy/stop-engine";
import type { TaskChainValidation } from "@/lib/autonomy/validator";

function task(overrides: Partial<AutonomyTask> = {}): AutonomyTask {
  return {
    action: "goal_review",
    dependsOn: [],
    description: "Review the goal in observer mode.",
    expectedOutput: "Read-only review summary.",
    id: "task-a",
    mutatesProduction: false,
    order: 1,
    title: "Review Goal",
    ...overrides,
  };
}

function preview(taskId: string): AutonomyExecutionPreview {
  return {
    mutationRisk: "none",
    preview: "Would simulate.",
    rollbackPreview: "No rollback required.",
    simulatedStatus: "would_run",
    taskId,
    taskTitle: "Review Goal",
  };
}

const validation: TaskChainValidation = {
  duplicateExecutionAttempts: [],
  duplicateTasks: [],
  invalidChains: [],
  invalidTasks: [],
  isValid: true,
  unsafeExecutionRequests: [],
  warnings: [],
};

const stopPolicy: StopPolicyResult = {
  canContinue: true,
  messages: [],
  policy: {
    maxIterations: 5,
    maxRecursionDepth: 2,
    maxRetriesPerTask: 2,
    maxStalledMs: 5_000,
    maxStateRecoveryAttempts: 1,
    maxTaskRevisits: 1,
    timeoutMs: 10_000,
  },
  stopReason: "none",
};

describe("run ledger", () => {
  it("prevents duplicate run task entries from advancing", () => {
    const result = buildRunLedger({
      executionPreview: [preview("task-a"), preview("task-a")],
      runId: "run-a",
      stopPolicy,
      tasks: [task(), task({ order: 2, title: "Duplicate title" })],
      validation,
    });

    expect(result.duplicateRunBlocked).toBe(true);
    expect(result.entries[1].executionState).toBe("recovered");
  });

  it("recovers from corrupted ledger entries by dropping unsafe records", () => {
    const goodLedger = buildRunLedger({
      executionPreview: [preview("task-a")],
      runId: "run-a",
      stopPolicy,
      tasks: [task()],
      validation,
    });

    const recovery = recoverCorruptedRunLedger([
      goodLedger.entries[0],
      { runId: "run-a", taskId: "missing-payload" },
    ]);

    expect(recovery.recovered).toBe(true);
    expect(recovery.entries).toHaveLength(1);
    expect(recovery.entries[0].executionState).toBe("recovered");
  });
});
