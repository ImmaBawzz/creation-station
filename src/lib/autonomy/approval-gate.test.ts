import { describe, expect, it } from "vitest";

import { createApprovalToken, evaluateApprovalGate } from "@/lib/autonomy/approval-gate";
import type { AutonomyTask } from "@/lib/autonomy/orchestrator";

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

describe("approval gate", () => {
  it("marks approvals stale when the token no longer matches the task payload", () => {
    const currentTask = task({ title: "Current Goal" });
    const staleTask = task({ title: "Old Goal" });
    const staleToken = createApprovalToken({ runId: "run-a", task: staleTask });
    const currentToken = createApprovalToken({ runId: "run-a", task: currentTask });

    const result = evaluateApprovalGate({
      approvalToken: staleToken,
      decision: "approve",
      expectedApprovalToken: currentToken,
      expiresAt: "2026-05-07T12:15:00.000Z",
      now: new Date("2026-05-07T12:00:00.000Z"),
      task: currentTask,
    });

    expect(result.approvalState).toBe("stale");
  });

  it("expires approvals after the timeout window", () => {
    const currentTask = task();
    const token = createApprovalToken({ runId: "run-a", task: currentTask });

    const result = evaluateApprovalGate({
      approvalToken: token,
      decision: "approve",
      expectedApprovalToken: token,
      expiresAt: "2026-05-07T12:00:00.000Z",
      now: new Date("2026-05-07T12:16:00.000Z"),
      task: currentTask,
    });

    expect(result.approvalState).toBe("expired");
  });
});
