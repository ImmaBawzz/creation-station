import type { AutonomyTask } from "@/lib/autonomy/orchestrator";

export type TaskValidationIssue = {
  taskId: string;
  reason: string;
};

export type TaskChainValidation = {
  isValid: boolean;
  duplicateTasks: TaskValidationIssue[];
  invalidTasks: TaskValidationIssue[];
  invalidChains: TaskValidationIssue[];
};

function normalizedTaskSignature(task: AutonomyTask): string {
  return `${task.title} ${task.description}`.toLowerCase().replace(/\s+/g, " ").trim();
}

export function validateTaskChain(tasks: AutonomyTask[]): TaskChainValidation {
  const taskIds = new Set(tasks.map((task) => task.id));
  const taskOrderById = new Map(tasks.map((task) => [task.id, task.order]));
  const seenSignatures = new Map<string, string>();
  const duplicateTasks: TaskValidationIssue[] = [];
  const invalidTasks: TaskValidationIssue[] = [];
  const invalidChains: TaskValidationIssue[] = [];

  for (const task of tasks) {
    const signature = normalizedTaskSignature(task);
    const firstTaskId = seenSignatures.get(signature);

    if (firstTaskId) {
      duplicateTasks.push({
        taskId: task.id,
        reason: `Duplicates ${firstTaskId}.`,
      });
    } else {
      seenSignatures.set(signature, task.id);
    }

    if (task.mutatesProduction) {
      invalidTasks.push({
        taskId: task.id,
        reason: "Observer-mode tasks must not mutate production state.",
      });
    }

    if (!task.title.trim() || !task.expectedOutput.trim()) {
      invalidTasks.push({
        taskId: task.id,
        reason: "Task title and expected output are required.",
      });
    }

    for (const dependencyId of task.dependsOn) {
      const dependencyOrder = taskOrderById.get(dependencyId);

      if (!taskIds.has(dependencyId) || dependencyOrder === undefined) {
        invalidChains.push({
          taskId: task.id,
          reason: `Missing dependency ${dependencyId}.`,
        });
        continue;
      }

      if (dependencyOrder >= task.order) {
        invalidChains.push({
          taskId: task.id,
          reason: `Dependency ${dependencyId} does not run before this task.`,
        });
      }
    }
  }

  return {
    isValid:
      duplicateTasks.length === 0 &&
      invalidTasks.length === 0 &&
      invalidChains.length === 0,
    duplicateTasks,
    invalidTasks,
    invalidChains,
  };
}
