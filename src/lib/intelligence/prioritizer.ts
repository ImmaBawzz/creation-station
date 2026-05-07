import {
  buildTaskMomentumContext,
  planContextKey,
  type IntelligenceTask,
  type TaskMomentumContext,
} from "@/lib/intelligence/planner";
import {
  daysSince,
  getTaskStaleness,
  getTaskWaitingState,
  nextWorkTaskStatuses,
} from "@/lib/intelligence/validator";

const priorityScore: Record<string, number> = {
  CRITICAL: 45,
  HIGH: 30,
  LOW: 5,
  MEDIUM: 15,
};
const statusScore: Record<string, number> = {
  BLOCKED: -20,
  DOING: 30,
  TODO: 20,
};

function scoreNextTask(
  task: IntelligenceTask,
  allTasks: IntelligenceTask[],
  taskContext: TaskMomentumContext,
  scoreNow: Date,
): number {
  const taskAge = daysSince(task.updatedAt, scoreNow);
  const stale = getTaskStaleness(task, scoreNow);
  const contextKey = planContextKey(task);
  const planActiveCount = taskContext.planActiveCounts.get(contextKey) ?? 0;
  const planLatestAge = taskContext.planLatestActiveDays.get(contextKey) ?? taskAge;
  const blockerImpact = taskContext.blockerImpactByTaskId.get(task.id) ?? 0;
  const ageScore = Math.min(taskAge, 21) * (task.status === "DOING" ? 1.25 : 0.8);
  const momentumScore =
    Math.min(planActiveCount, 4) * 4 + Math.max(0, 10 - planLatestAge);
  const blockerUrgencyScore = Math.min(blockerImpact * 14, 42);
  const stalePenalty = stale ? (stale.severity === "high" ? 55 : 30) : 0;

  return (
    (priorityScore[task.priority] ?? 10) +
    (statusScore[task.status] ?? 0) +
    ageScore +
    momentumScore +
    blockerUrgencyScore -
    stalePenalty +
    Math.min(allTasks.length, 20) * 0.1
  );
}

export function recommendNextTasks(
  tasks: IntelligenceTask[],
  limit = 3,
  now = new Date(),
): IntelligenceTask[] {
  const context = buildTaskMomentumContext(tasks, now);

  const rankedTasks = tasks
    .filter((task) => nextWorkTaskStatuses.has(task.status))
    .filter((task) => !getTaskWaitingState(task, tasks).isWaiting || task.status === "DOING")
    .map((task) => ({
      contextKey: planContextKey(task),
      score: scoreNextTask(task, tasks, context, now),
      task,
    }))
    .sort((a, b) => b.score - a.score);
  const selectedTasks: IntelligenceTask[] = [];
  const usedContexts = new Set<string>();

  for (const rankedTask of rankedTasks) {
    if (usedContexts.has(rankedTask.contextKey) && selectedTasks.length < limit - 1) {
      continue;
    }

    selectedTasks.push(rankedTask.task);
    usedContexts.add(rankedTask.contextKey);

    if (selectedTasks.length >= limit) {
      break;
    }
  }

  return selectedTasks;
}
