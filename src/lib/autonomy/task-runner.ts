import type {
  AutonomyExecutionPreview,
  AutonomyTask,
} from "@/lib/autonomy/orchestrator";
import { createAutonomyLogEvent, type AutonomyLogEvent } from "@/lib/autonomy/logger";
import type { TaskChainValidation } from "@/lib/autonomy/validator";

export type AutonomySimulationOptions = {
  completedTaskIds?: string[];
  failedTaskIds?: string[];
  stalledTaskIds?: string[];
};

export type AutonomySimulationResult = {
  logs: AutonomyLogEvent[];
  previews: AutonomyExecutionPreview[];
};

export function simulateTaskExecution(
  tasks: AutonomyTask[],
  validation: TaskChainValidation,
  options: AutonomySimulationOptions = {},
): AutonomySimulationResult {
  const invalidTaskIds = new Set([
    ...validation.invalidTasks.map((task) => task.taskId),
    ...validation.invalidChains.map((task) => task.taskId),
    ...validation.unsafeExecutionRequests.map((task) => task.taskId),
  ]);
  const completedTaskIds = new Set(options.completedTaskIds ?? []);
  const failedTaskIds = new Set(options.failedTaskIds ?? []);
  const stalledTaskIds = new Set(options.stalledTaskIds ?? []);
  const blockedTaskIds = new Set<string>();
  const logs: AutonomyLogEvent[] = [];
  const previewByTaskId = new Map<string, AutonomyExecutionPreview>();

  const previews = tasks.map((task) => {
    const dependencyBlocked = task.dependsOn.some((dependencyId) => {
      const dependencyPreview = previewByTaskId.get(dependencyId);
      return (
        blockedTaskIds.has(dependencyId) ||
        dependencyPreview?.simulatedStatus === "failed" ||
        dependencyPreview?.simulatedStatus === "rolled_back"
      );
    });
    const blocked = invalidTaskIds.has(task.id) || dependencyBlocked;

    if (blocked) {
      blockedTaskIds.add(task.id);
      logs.push(
        createAutonomyLogEvent({
          event: "validation_blocked",
          message: "Task blocked in observer simulation.",
          metadata: { dependencyBlocked },
          taskId: task.id,
        }),
      );
    } else {
      logs.push(
        createAutonomyLogEvent({
          event: "task_started",
          message: "Task simulation started.",
          metadata: { action: task.action, observerMode: true },
          taskId: task.id,
        }),
      );
    }

    const preview: AutonomyExecutionPreview = {
      taskId: task.id,
      taskTitle: task.title,
      simulatedStatus: blocked
        ? "blocked"
        : failedTaskIds.has(task.id)
          ? "failed"
          : completedTaskIds.has(task.id)
            ? "completed"
            : stalledTaskIds.has(task.id)
              ? "stalled"
              : "would_run",
      preview: blocked
        ? "This task would be blocked until the preview chain is corrected."
        : `Would simulate ${task.action} and produce: ${task.expectedOutput}`,
      mutationRisk: "none",
      rollbackPreview: blocked || failedTaskIds.has(task.id)
        ? "Observer mode would discard simulated output and keep production state unchanged."
        : "No rollback required for this read-only preview.",
    };

    if (preview.simulatedStatus === "failed") {
      logs.push(
        createAutonomyLogEvent({
          event: "task_failed",
          message: "Task simulation failed; output is isolated from later tasks.",
          metadata: { rollbackPreview: preview.rollbackPreview },
          taskId: task.id,
        }),
      );
    }

    if (preview.simulatedStatus === "completed") {
      logs.push(
        createAutonomyLogEvent({
          event: "task_completed",
          message: "Task simulation completed.",
          metadata: { observerMode: true },
          taskId: task.id,
        }),
      );
    }

    previewByTaskId.set(task.id, preview);
    return preview;
  });

  return { logs, previews };
}
