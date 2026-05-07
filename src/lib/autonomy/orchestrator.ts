import { enforceStopPolicy, type AutonomyPolicy } from "@/lib/autonomy/stop-engine";
import { simulateTaskExecution } from "@/lib/autonomy/task-runner";
import { validateTaskChain } from "@/lib/autonomy/validator";

export type AutonomyTaskAction =
  | "goal_review"
  | "context_scan"
  | "plan_draft"
  | "safety_validation"
  | "human_checkpoint";

export type AutonomyTask = {
  id: string;
  order: number;
  title: string;
  description: string;
  action: AutonomyTaskAction;
  dependsOn: string[];
  expectedOutput: string;
  mutatesProduction: false;
};

export type AutonomyExecutionPreview = {
  taskId: string;
  taskTitle: string;
  simulatedStatus: "would_run" | "blocked";
  preview: string;
  mutationRisk: "none";
};

export type AutonomyPlan = {
  goal: string;
  mode: "observer";
  tasks: AutonomyTask[];
  executionOrder: string[];
  validation: ReturnType<typeof validateTaskChain>;
  executionPreview: AutonomyExecutionPreview[];
  stopPolicy: ReturnType<typeof enforceStopPolicy>;
  approvalRequired: true;
  summary: string;
};

export type OrchestratorInput = {
  goal: string;
  revision?: string;
  policy?: Partial<AutonomyPolicy>;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function slugTaskId(index: number, title: string): string {
  return `preview-${index + 1}-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 36)}`;
}

function buildGoalSummary(goal: string, revision?: string): string {
  const cleanGoal = normalizeText(goal);
  const cleanRevision = normalizeText(revision ?? "");

  if (!cleanRevision) {
    return cleanGoal;
  }

  return `${cleanGoal} Revision request: ${cleanRevision}`;
}

function buildObserverTasks(goalSummary: string): AutonomyTask[] {
  const taskDrafts = [
    {
      title: "Review Goal",
      description: `Confirm the requested outcome and observer-mode boundary for: ${goalSummary}`,
      action: "goal_review" as const,
      dependsOn: [],
      expectedOutput: "A concise goal summary with explicit non-execution constraints.",
    },
    {
      title: "Scan Local Context",
      description:
        "Identify relevant ideas, plans, tasks, blockers, and recommendations that could inform a plan.",
      action: "context_scan" as const,
      dependsOn: ["Review Goal"],
      expectedOutput: "A read-only context checklist for the proposed autonomy run.",
    },
    {
      title: "Draft Execution Plan",
      description:
        "Break the goal into the smallest safe ordered steps without invoking tools or changing records.",
      action: "plan_draft" as const,
      dependsOn: ["Scan Local Context"],
      expectedOutput: "An ordered preview plan with expected outputs for each task.",
    },
    {
      title: "Validate Preview",
      description:
        "Check for duplicate tasks, invalid dependencies, unsafe actions, and out-of-policy chains.",
      action: "safety_validation" as const,
      dependsOn: ["Draft Execution Plan"],
      expectedOutput: "A validation result explaining whether the preview is safe to show.",
    },
    {
      title: "Request Human Decision",
      description:
        "Ask the user to approve, reject, or revise the preview before any future execution work.",
      action: "human_checkpoint" as const,
      dependsOn: ["Validate Preview"],
      expectedOutput: "A human approval checkpoint with no automatic execution.",
    },
  ];

  const titleToId = new Map(
    taskDrafts.map((task, index) => [task.title, slugTaskId(index, task.title)]),
  );

  return taskDrafts.map((task, index) => ({
    ...task,
    id: titleToId.get(task.title) ?? slugTaskId(index, task.title),
    order: index + 1,
    dependsOn: task.dependsOn.map((title) => titleToId.get(title) ?? title),
    mutatesProduction: false,
  }));
}

export function orchestrateAutonomyGoal(input: OrchestratorInput): AutonomyPlan {
  const goalSummary = buildGoalSummary(input.goal, input.revision);
  const tasks = buildObserverTasks(goalSummary);
  const validation = validateTaskChain(tasks);
  const executionPreview = simulateTaskExecution(tasks, validation);
  const stopPolicy = enforceStopPolicy({
    policy: input.policy,
    runState: {
      elapsedMs: 0,
      iterationCount: tasks.length,
      retryCountByTaskId: new Map(tasks.map((task) => [task.id, 0])),
      visitedTaskIds: tasks.map((task) => task.id),
    },
  });

  return {
    goal: goalSummary,
    mode: "observer",
    tasks,
    executionOrder: tasks.map((task) => task.id),
    validation,
    executionPreview,
    stopPolicy,
    approvalRequired: true,
    summary:
      "Observer mode prepared a read-only execution preview. No tasks were run and no production data was changed.",
  };
}
