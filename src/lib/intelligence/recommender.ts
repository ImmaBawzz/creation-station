import {
  buildTaskMomentumContext,
  planContextKey,
  type IntelligencePlan,
  type IntelligenceTask,
} from "@/lib/intelligence/planner";
import { recommendNextTasks } from "@/lib/intelligence/prioritizer";
import {
  detectIdeaRoute,
  type IntelligenceIdea,
} from "@/lib/intelligence/router";
import {
  getTaskStaleness,
  getTaskWaitingState,
  taskBlockerReferenceIds,
} from "@/lib/intelligence/validator";

export type IntelligenceRecommendation = {
  body: string;
  href: string;
  id: string;
  title: string;
  tone: "attention" | "blocked" | "priority" | "route" | "stale";
};

type ScoredRecommendation = IntelligenceRecommendation & {
  contextKey: string;
  score: number;
};

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
