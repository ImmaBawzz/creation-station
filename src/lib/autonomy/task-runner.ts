import type {
  AutonomyExecutionPreview,
  AutonomyTask,
} from "@/lib/autonomy/orchestrator";
import type { TaskChainValidation } from "@/lib/autonomy/validator";

export function simulateTaskExecution(
  tasks: AutonomyTask[],
  validation: TaskChainValidation,
): AutonomyExecutionPreview[] {
  const invalidTaskIds = new Set(validation.invalidTasks.map((task) => task.taskId));

  return tasks.map((task) => ({
    taskId: task.id,
    taskTitle: task.title,
    simulatedStatus: invalidTaskIds.has(task.id) ? "blocked" : "would_run",
    preview: invalidTaskIds.has(task.id)
      ? "This task would be blocked until the preview chain is corrected."
      : `Would simulate ${task.action} and produce: ${task.expectedOutput}`,
    mutationRisk: "none",
  }));
}
