import {
  daysSince,
  getTaskWaitingState,
  nextWorkTaskStatuses,
} from "@/lib/intelligence/validator";

export type IntelligencePlan = {
  id: string;
  status: string;
  title: string;
  idea: {
    status: string;
    title: string;
  };
};

export type IntelligenceTask = {
  id: string;
  blockers?: Array<{
    blockerTaskId: string;
  }>;
  labels?: string | null;
  priority: string;
  status: string;
  title: string;
  updatedAt: Date | string;
  plan: {
    id?: string;
    title: string;
    idea: {
      category: string;
      id?: string;
      tags: string;
      title: string;
    };
  };
};

export type TaskMomentumContext = {
  activeTaskCount: number;
  blockerImpactByTaskId: Map<string, number>;
  latestActiveDays: number;
  planActiveCounts: Map<string, number>;
  planLatestActiveDays: Map<string, number>;
};

export function planContextKey(task: IntelligenceTask): string {
  return task.plan.id ?? task.plan.title;
}

export function buildTaskMomentumContext(
  tasks: IntelligenceTask[],
  now: Date,
): TaskMomentumContext {
  const planActiveCounts = new Map<string, number>();
  const planLatestActiveDays = new Map<string, number>();
  const blockerImpactByTaskId = new Map<string, number>();
  let activeTaskCount = 0;
  let latestActiveDays = Number.POSITIVE_INFINITY;

  for (const task of tasks) {
    if (nextWorkTaskStatuses.has(task.status)) {
      const contextKey = planContextKey(task);
      const taskAge = daysSince(task.updatedAt, now);

      activeTaskCount += 1;
      latestActiveDays = Math.min(latestActiveDays, taskAge);
      planActiveCounts.set(contextKey, (planActiveCounts.get(contextKey) ?? 0) + 1);
      planLatestActiveDays.set(
        contextKey,
        Math.min(planLatestActiveDays.get(contextKey) ?? Number.POSITIVE_INFINITY, taskAge),
      );
    }
  }

  for (const task of tasks) {
    const waitingState = getTaskWaitingState(task, tasks);

    if (!waitingState.isWaiting) {
      continue;
    }

    for (const blockerId of waitingState.blockerIds) {
      blockerImpactByTaskId.set(
        blockerId,
        (blockerImpactByTaskId.get(blockerId) ?? 0) + 1,
      );
    }
  }

  return {
    activeTaskCount,
    blockerImpactByTaskId,
    latestActiveDays:
      latestActiveDays === Number.POSITIVE_INFINITY ? 0 : latestActiveDays,
    planActiveCounts,
    planLatestActiveDays,
  };
}
