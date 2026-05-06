import {
  PIPELINE_DEFINITIONS,
  PIPELINE_KEYS,
  pipelineDefinitionForKey,
  type PipelineKey,
} from "@/lib/pipelines";
import { taskBlockerIds } from "@/lib/task-labels";

export type IdeaRoute = {
  confidence: "high" | "low" | "medium";
  id: PipelineKey;
  label: string;
  pipeline: string;
  reasons: string[];
};

export type IntelligenceIdea = {
  category: string;
  id: string;
  priority?: string;
  rawText: string;
  status: string;
  tags: string;
  title: string;
  updatedAt?: Date | string;
};

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

export type TaskWaitingState = {
  blockerIds: string[];
  blockerNames: string[];
  isWaiting: boolean;
  label: string;
  missingBlockerIds: string[];
  unresolvedBlockerNames: string[];
};

export type TaskStaleness = {
  action: string;
  daysStale: number;
  label: string;
  severity: "high" | "medium";
};

export type IntelligenceRecommendation = {
  body: string;
  href: string;
  id: string;
  title: string;
  tone: "attention" | "blocked" | "priority" | "route" | "stale";
};

const closedTaskStatuses = new Set(["ARCHIVED", "DONE"]);
const nextWorkTaskStatuses = new Set(["DOING", "TODO"]);

type TaskMomentumContext = {
  activeTaskCount: number;
  blockerImpactByTaskId: Map<string, number>;
  latestActiveDays: number;
  planActiveCounts: Map<string, number>;
  planLatestActiveDays: Map<string, number>;
};

type ScoredRecommendation = IntelligenceRecommendation & {
  contextKey: string;
  score: number;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

function daysSince(value: Date | string, now: Date): number {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / millisecondsPerDay),
  );
}

function planContextKey(task: IntelligenceTask): string {
  return task.plan.id ?? task.plan.title;
}

function taskBlockerReferenceIds(task: {
  blockers?: Array<{ blockerTaskId: string }>;
  labels?: string | null;
}): string[] {
  const persistedBlockerIds =
    task.blockers?.map((blocker) => blocker.blockerTaskId).filter(Boolean) ?? [];

  return persistedBlockerIds.length > 0 ? persistedBlockerIds : taskBlockerIds(task);
}

function buildTaskMomentumContext(
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

function confidenceForScore(score: number): IdeaRoute["confidence"] {
  if (score >= 5) {
    return "high";
  }

  if (score >= 2) {
    return "medium";
  }

  return "low";
}

export function detectIdeaRoute(idea: {
  category: string;
  rawText: string;
  tags: string;
  title: string;
}): IdeaRoute {
  const category = normalize(idea.category);
  const tags = normalize(idea.tags);
  const title = normalize(idea.title);
  const body = normalize(idea.rawText);
  const searchableText = `${title} ${body} ${tags}`;

  const scoredRoutes = PIPELINE_KEYS.filter((key) => key !== "general").map((key) => {
    const pipeline = PIPELINE_DEFINITIONS[key];
    let score = 0;
    const reasons: string[] = [];

    if (pipeline.categoryAliases.includes(category)) {
      score += 3;
      reasons.push(`category: ${idea.category}`);
    }

    for (const keyword of pipeline.keywords) {
      if (tags.includes(keyword)) {
        score += 2;
        reasons.push(`tag: ${keyword}`);
      } else if (title.includes(keyword)) {
        score += 2;
        reasons.push(`title: ${keyword}`);
      } else if (searchableText.includes(keyword)) {
        score += 1;
      }
    }

    return {
      id: pipeline.key,
      label: pipeline.label,
      pipeline: pipeline.pipelineName,
      reasons: reasons.slice(0, 2),
      score,
    };
  });

  const bestRoute = scoredRoutes.sort((a, b) => b.score - a.score)[0];

  if (!bestRoute || bestRoute.score === 0) {
    const generalPipeline = pipelineDefinitionForKey("general");

    return {
      confidence: "low",
      id: generalPipeline.key,
      label: generalPipeline.label,
      pipeline: generalPipeline.pipelineName,
      reasons: [],
    };
  }

  return {
    confidence: confidenceForScore(bestRoute.score),
    id: bestRoute.id,
    label: bestRoute.label,
    pipeline: bestRoute.pipeline,
    reasons: bestRoute.reasons,
  };
}

export function getTaskWaitingState(
  task: {
    blockers?: Array<{ blockerTaskId: string }>;
    id: string;
    labels?: string | null;
    status: string;
    title: string;
  },
  tasks: Array<{ id: string; status: string; title: string }>,
): TaskWaitingState {
  const blockerIds = taskBlockerReferenceIds(task);
  const taskById = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  const blockers = blockerIds
    .map((blockerId) => taskById.get(blockerId))
    .filter((blocker): blocker is { id: string; status: string; title: string } =>
      Boolean(blocker),
    );
  const blockerNames = blockers.map((blocker) => blocker.title);
  const unresolvedBlockerNames = blockers
    .filter((blocker) => !closedTaskStatuses.has(blocker.status))
    .map((blocker) => blocker.title);
  const missingBlockerIds = blockerIds.filter((blockerId) => !taskById.has(blockerId));
  const hasOpenBlockers =
    unresolvedBlockerNames.length > 0 || missingBlockerIds.length > 0;
  const isWaiting =
    hasOpenBlockers || (task.status === "BLOCKED" && blockerIds.length === 0);

  let label = "";

  if (unresolvedBlockerNames.length > 0) {
    label = `Waiting on ${unresolvedBlockerNames.join(", ")}`;
  } else if (missingBlockerIds.length > 0) {
    label = "Waiting on a missing task reference";
  } else if (blockerNames.length > 0) {
    label = "Blocker cleared";
  } else if (task.status === "BLOCKED") {
    label = "Waiting on blocker details";
  }

  return {
    blockerIds,
    blockerNames,
    isWaiting,
    label,
    missingBlockerIds,
    unresolvedBlockerNames,
  };
}

export function getTaskStaleness(
  task: Pick<IntelligenceTask, "priority" | "status" | "updatedAt">,
  now = new Date(),
): TaskStaleness | null {
  if (closedTaskStatuses.has(task.status)) {
    return null;
  }

  const staleAfterDaysByStatus: Record<string, number> = {
    BACKLOG: 30,
    BLOCKED: 10,
    DOING: 7,
    TODO: 14,
  };
  const priorityAdjustment: Record<string, number> = {
    CRITICAL: -5,
    HIGH: -3,
    LOW: 7,
    MEDIUM: 0,
  };
  const staleAfterDays = Math.max(
    3,
    (staleAfterDaysByStatus[task.status] ?? 14) +
      (priorityAdjustment[task.priority] ?? 0),
  );
  const daysStale = daysSince(task.updatedAt, now);

  if (daysStale < staleAfterDays) {
    return null;
  }

  const action =
    task.status === "BACKLOG"
      ? "Revive it if it matters now, or archive it if it no longer belongs in the active system."
      : "Move it forward, park it in backlog, or archive it if it is no longer useful.";

  return {
    action,
    daysStale,
    label: `${daysStale} days without movement`,
    severity: daysStale >= staleAfterDays + 14 ? "high" : "medium",
  };
}

export function recommendNextTasks(
  tasks: IntelligenceTask[],
  limit = 3,
  now = new Date(),
): IntelligenceTask[] {
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
}

export function buildIntelligenceRecommendations({
  ideas,
  limit = 5,
  now = new Date(),
  reviewPlans,
  tasks,
}: {
  ideas: IntelligenceIdea[];
  limit?: number;
  now?: Date;
  reviewPlans: IntelligencePlan[];
  tasks: IntelligenceTask[];
}): IntelligenceRecommendation[] {
  const recommendations: ScoredRecommendation[] = [];
  const taskContext = buildTaskMomentumContext(tasks, now);
  const pendingReviewPlan = reviewPlans.find((plan) => plan.status === "REVIEW_PENDING");

  if (pendingReviewPlan) {
    recommendations.push({
      body: `${pendingReviewPlan.title} is ready for approval or revision before more tasks are created.`,
      contextKey: pendingReviewPlan.id,
      href: "#review-inbox",
      id: `review-${pendingReviewPlan.id}`,
      score: 70,
      title: "Review the waiting plan",
      tone: "attention",
    });
  }

  const revisionIdea = ideas.find((idea) => idea.status === "NEEDS_REVISION");

  if (revisionIdea) {
    recommendations.push({
      body: `${revisionIdea.title} has revision feedback waiting. Re-plan it before starting parallel task work.`,
      contextKey: revisionIdea.id,
      href: "/factory",
      id: `revision-${revisionIdea.id}`,
      score: 85,
      title: "Finish the revision loop",
      tone: "attention",
    });
  }

  const blockedTaskWithoutReference = tasks.find(
    (task) =>
      task.status === "BLOCKED" && taskBlockerReferenceIds(task).length === 0,
  );

  if (blockedTaskWithoutReference) {
    const stale = getTaskStaleness(blockedTaskWithoutReference, now);

    recommendations.push({
      body: `${blockedTaskWithoutReference.title} is blocked but does not name what it is waiting on yet.`,
      contextKey: planContextKey(blockedTaskWithoutReference),
      href: "#task-board",
      id: `blocked-${blockedTaskWithoutReference.id}`,
      score: 90 + (stale ? 15 : 0),
      title: "Clarify a blocker",
      tone: "blocked",
    });
  }

  const clearedBlockedTask = tasks.find((task) => {
    const waitingState = getTaskWaitingState(task, tasks);

    return (
      task.status === "BLOCKED" &&
      taskBlockerReferenceIds(task).length > 0 &&
      !waitingState.isWaiting
    );
  });

  if (clearedBlockedTask) {
    recommendations.push({
      body: `${clearedBlockedTask.title} has no open blockers left. Move it active or archive it if the work is no longer useful.`,
      contextKey: planContextKey(clearedBlockedTask),
      href: "#task-board",
      id: `cleared-${clearedBlockedTask.id}`,
      score: 95,
      title: "Revive cleared work",
      tone: "blocked",
    });
  }

  const staleTask = tasks.find((task) => getTaskStaleness(task, now));

  if (staleTask) {
    const stale = getTaskStaleness(staleTask, now);

    if (stale) {
      recommendations.push({
        body: `${staleTask.title} has been idle for ${stale.daysStale} days. ${stale.action}`,
        contextKey: planContextKey(staleTask),
        href: "#task-board",
        id: `stale-${staleTask.id}`,
        score: stale.severity === "high" ? 80 : 62,
        title: "Resolve stale work",
        tone: "stale",
      });
    }
  }

  const nextTask = recommendNextTasks(tasks, 1, now)[0];

  if (nextTask) {
    const contextKey = planContextKey(nextTask);
    const planActiveCount = taskContext.planActiveCounts.get(contextKey) ?? 1;
    const blockerImpact = taskContext.blockerImpactByTaskId.get(nextTask.id) ?? 0;

    recommendations.push({
      body: `${nextTask.title} is the strongest active task based on priority, age, project momentum, and dependency impact.`,
      contextKey,
      href: "#task-board",
      id: `next-${nextTask.id}`,
      score: 72 + Math.min(planActiveCount * 3, 12) + Math.min(blockerImpact * 8, 24),
      title: "Work this next",
      tone: "priority",
    });
  }

  const rawRoutedIdea = ideas
    .filter((idea) => idea.status === "RAW")
    .map((idea) => ({
      idea,
      route: detectIdeaRoute(idea),
    }))
    .find(({ route }) => route.id !== "general");

  if (rawRoutedIdea) {
    recommendations.push({
      body: `${rawRoutedIdea.idea.title} looks like ${rawRoutedIdea.route.pipeline}. Send it to the Factory with that route in mind.`,
      contextKey: rawRoutedIdea.idea.id,
      href: "/factory",
      id: `route-${rawRoutedIdea.idea.id}`,
      score: 55,
      title: "Route the next idea",
      tone: "route",
    });
  }

  const selectedRecommendations: IntelligenceRecommendation[] = [];
  const usedContexts = new Set<string>();

  for (const recommendation of recommendations.sort((a, b) => b.score - a.score)) {
    if (
      usedContexts.has(recommendation.contextKey) &&
      selectedRecommendations.length < limit - 1
    ) {
      continue;
    }

    selectedRecommendations.push({
      body: recommendation.body,
      href: recommendation.href,
      id: recommendation.id,
      title: recommendation.title,
      tone: recommendation.tone,
    });
    usedContexts.add(recommendation.contextKey);

    if (selectedRecommendations.length >= limit) {
      break;
    }
  }

  return selectedRecommendations;
}
