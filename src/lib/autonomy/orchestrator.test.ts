import { describe, expect, it } from "vitest";

import { orchestrateAutonomyGoal } from "@/lib/autonomy/orchestrator";

describe("orchestrateAutonomyGoal safety", () => {
  it("blocks dependent tasks when a failed task would otherwise propagate corruption", () => {
    const baselinePlan = orchestrateAutonomyGoal({ goal: "Preview a safe plan" });
    const failedTaskId = baselinePlan.tasks[0].id;
    const plan = orchestrateAutonomyGoal({
      goal: "Preview a safe plan",
      simulation: { failedTaskIds: [failedTaskId] },
    });

    expect(plan.executionPreview[0].simulatedStatus).toBe("failed");
    expect(plan.executionPreview[1].simulatedStatus).toBe("blocked");
    expect(plan.simulationDashboard.failedTasks).toHaveLength(1);
    expect(plan.simulationDashboard.blockedTasks.length).toBeGreaterThan(0);
  });

  it("shows rollback previews for failed or blocked partial tasks", () => {
    const baselinePlan = orchestrateAutonomyGoal({ goal: "Preview rollback handling" });
    const failedTaskId = baselinePlan.tasks[0].id;
    const plan = orchestrateAutonomyGoal({
      goal: "Preview rollback handling",
      simulation: { failedTaskIds: [failedTaskId] },
    });

    expect(plan.executionPreview[0].rollbackPreview).toBe(
      "Observer mode would discard simulated output and keep production state unchanged.",
    );
    expect(plan.executionPreview[1].rollbackPreview).toBe(
      "Observer mode would discard simulated output and keep production state unchanged.",
    );
  });

  it("keeps task state serializable across refresh or reload", () => {
    const plan = orchestrateAutonomyGoal({
      goal: "Preview reload persistence",
      revision: "Keep state read-only.",
    });
    const reloadedPlan = JSON.parse(JSON.stringify(plan));

    expect(reloadedPlan.goal).toBe(plan.goal);
    expect(reloadedPlan.executionOrder).toEqual(plan.executionOrder);
    expect(reloadedPlan.simulationDashboard.stopReason).toBe("none");
    expect(reloadedPlan.executionPreview.every((task: { mutationRisk: string }) => task.mutationRisk === "none")).toBe(
      true,
    );
  });

  it("emits structured logs for simulated lifecycle events", () => {
    const baselinePlan = orchestrateAutonomyGoal({ goal: "Preview logs" });
    const plan = orchestrateAutonomyGoal({
      goal: "Preview logs",
      simulation: { completedTaskIds: [baselinePlan.tasks[0].id] },
    });

    expect(plan.logs.map((log) => log.event)).toEqual(
      expect.arrayContaining(["task_started", "task_completed"]),
    );
  });
});
