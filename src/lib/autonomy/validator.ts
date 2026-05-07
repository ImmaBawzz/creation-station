import type { AutonomyTask } from "@/lib/autonomy/orchestrator";

export type TaskValidationIssue = {
  taskId: string;
  reason: string;
};

type ValidatableTask = Partial<Omit<AutonomyTask, "action" | "dependsOn" | "mutatesProduction">> & {
  action?: string;
  dependsOn?: unknown;
  executionAttemptKey?: string;
  executionRequest?: string;
  mutatesProduction?: boolean;
  prompt?: string;
};

export type TaskChainValidation = {
  isValid: boolean;
  duplicateTasks: TaskValidationIssue[];
  duplicateExecutionAttempts: TaskValidationIssue[];
  invalidTasks: TaskValidationIssue[];
  invalidChains: TaskValidationIssue[];
  unsafeExecutionRequests: TaskValidationIssue[];
  warnings: TaskValidationIssue[];
};

const unsafeExecutionPattern =
  /\b(execute|mutate|write|delete|drop|approve|archive|force push|schema|external api|integration|production)\b/i;
const malformedPromptPattern =
  /\b(ignore previous|bypass review|disable safety|override guard|real execution)\b/i;

function normalizedTaskSignature(task: ValidatableTask): string {
  return `${task.title ?? ""} ${task.description ?? ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dependencyIds(task: ValidatableTask): string[] {
  return Array.isArray(task.dependsOn)
    ? task.dependsOn.filter((dependency): dependency is string => typeof dependency === "string")
    : [];
}

function detectCircularReferences(tasks: ValidatableTask[]): TaskValidationIssue[] {
  const taskById = new Map(
    tasks
      .filter((task): task is ValidatableTask & { id: string } => typeof task.id === "string")
      .map((task) => [task.id, task]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const circularReferences: TaskValidationIssue[] = [];

  function visit(taskId: string, path: string[]): void {
    if (visiting.has(taskId)) {
      circularReferences.push({
        taskId,
        reason: `Circular dependency detected: ${[...path, taskId].join(" -> ")}.`,
      });
      return;
    }

    if (visited.has(taskId)) {
      return;
    }

    const task = taskById.get(taskId);
    if (!task) {
      return;
    }

    visiting.add(taskId);
    for (const dependencyId of dependencyIds(task)) {
      visit(dependencyId, [...path, taskId]);
    }
    visiting.delete(taskId);
    visited.add(taskId);
  }

  for (const taskId of taskById.keys()) {
    visit(taskId, []);
  }

  return circularReferences;
}

export function validateTaskChain(tasks: ValidatableTask[]): TaskChainValidation {
  const taskIds = new Set(tasks.map((task) => task.id).filter(Boolean));
  const taskOrderById = new Map(tasks.map((task) => [task.id, task.order]));
  const seenTaskIds = new Set<string>();
  const seenSignatures = new Map<string, string>();
  const seenExecutionAttempts = new Map<string, string>();
  const duplicateTasks: TaskValidationIssue[] = [];
  const duplicateExecutionAttempts: TaskValidationIssue[] = [];
  const invalidTasks: TaskValidationIssue[] = [];
  const invalidChains: TaskValidationIssue[] = [];
  const unsafeExecutionRequests: TaskValidationIssue[] = [];
  const warnings: TaskValidationIssue[] = [];

  for (const task of tasks) {
    const taskId = task.id ?? "missing-task-id";
    const signature = normalizedTaskSignature(task);
    const firstTaskId = seenSignatures.get(signature);

    if (signature && firstTaskId) {
      duplicateTasks.push({
        taskId,
        reason: `Duplicates ${firstTaskId}.`,
      });
    } else if (signature) {
      seenSignatures.set(signature, taskId);
    }

    if (!task.id || typeof task.id !== "string") {
      invalidTasks.push({ taskId, reason: "Task id is required." });
    } else if (seenTaskIds.has(task.id)) {
      invalidTasks.push({ taskId, reason: "Task id must be unique." });
    } else {
      seenTaskIds.add(task.id);
    }

    if (!Number.isInteger(task.order) || Number(task.order) < 1) {
      invalidTasks.push({ taskId, reason: "Task order must be a positive integer." });
    }

    if (!Array.isArray(task.dependsOn)) {
      invalidTasks.push({ taskId, reason: "Task dependencies must be an array." });
    }

    if (task.mutatesProduction) {
      invalidTasks.push({
        taskId,
        reason: "Observer-mode tasks must not mutate production state.",
      });
    }

    if (!task.title?.trim() || !task.expectedOutput?.trim()) {
      invalidTasks.push({
        taskId,
        reason: "Task title and expected output are required.",
      });
    }

    if (task.executionAttemptKey) {
      const firstAttemptTaskId = seenExecutionAttempts.get(task.executionAttemptKey);

      if (firstAttemptTaskId) {
        duplicateExecutionAttempts.push({
          taskId,
          reason: `Repeats execution attempt ${task.executionAttemptKey} from ${firstAttemptTaskId}.`,
        });
      } else {
        seenExecutionAttempts.set(task.executionAttemptKey, taskId);
      }
    }

    const executionRequest = `${task.executionRequest ?? ""} ${task.description ?? ""}`;
    if (unsafeExecutionPattern.test(executionRequest) || task.action === "execute") {
      unsafeExecutionRequests.push({
        taskId,
        reason: "Unsafe or non-observer execution request detected.",
      });
    }

    if (task.prompt !== undefined) {
      if (!task.prompt.trim()) {
        warnings.push({ taskId, reason: "Prompt is empty or whitespace only." });
      }

      if (malformedPromptPattern.test(task.prompt)) {
        warnings.push({ taskId, reason: "Prompt attempts to bypass observer-mode safety." });
      }
    }

    for (const dependencyId of dependencyIds(task)) {
      const dependencyOrder = taskOrderById.get(dependencyId);

      if (!taskIds.has(dependencyId) || dependencyOrder === undefined) {
        invalidChains.push({
          taskId,
          reason: `Missing dependency ${dependencyId}.`,
        });
        continue;
      }

      const taskOrder = typeof task.order === "number" ? task.order : Number.POSITIVE_INFINITY;

      if (dependencyOrder >= taskOrder) {
        invalidChains.push({
          taskId,
          reason: `Dependency ${dependencyId} does not run before this task.`,
        });
      }
    }
  }

  const circularReferences = detectCircularReferences(tasks);
  const allInvalidChains = [...invalidChains, ...circularReferences];

  return {
    isValid:
      duplicateTasks.length === 0 &&
      duplicateExecutionAttempts.length === 0 &&
      invalidTasks.length === 0 &&
      allInvalidChains.length === 0 &&
      unsafeExecutionRequests.length === 0,
    duplicateTasks,
    duplicateExecutionAttempts,
    invalidTasks,
    invalidChains: allInvalidChains,
    unsafeExecutionRequests,
    warnings,
  };
}
