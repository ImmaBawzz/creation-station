import type {
  ProjectBudgetStatus,
  ProjectFailureSummary,
  RetryLimitStatus,
} from "@/modules/regeneration-governor/types";

export const DEFAULT_MAX_RETRIES_PER_SCENE = 3;
export const DEFAULT_MAX_RETRIES_PER_PROJECT = 15;

/**
 * Check whether a specific scene is still allowed to retry.
 */
export function checkSceneRetryLimit(
  memory: ProjectFailureSummary,
  sceneId: string,
  maxAttemptsPerScene = DEFAULT_MAX_RETRIES_PER_SCENE,
): RetryLimitStatus {
  const record = memory.sceneRecords.find((r) => r.sceneId === sceneId);
  const attemptsUsed = record?.totalAttempts ?? 0;
  const remainingAttempts = Math.max(0, maxAttemptsPerScene - attemptsUsed);
  const hardLimitReached = attemptsUsed >= maxAttemptsPerScene;

  return {
    allowRetry: !hardLimitReached,
    attemptsUsed,
    hardLimitReached,
    maxAttempts: maxAttemptsPerScene,
    remainingAttempts,
    sceneId,
  };
}

/**
 * Check whether the project has hit its global retry ceiling.
 */
export function checkProjectRetryBudget(
  memory: ProjectFailureSummary,
  maxProjectAttempts = DEFAULT_MAX_RETRIES_PER_PROJECT,
): ProjectBudgetStatus {
  const totalAttemptsUsed = memory.totalProjectAttempts;
  const allowFurtherRetries = totalAttemptsUsed < maxProjectAttempts;

  return {
    allowFurtherRetries,
    maxProjectAttempts,
    projectId: memory.projectId,
    totalAttemptsUsed,
  };
}

/**
 * Return limit statuses for every scene that has at least one failure record.
 */
export function getAllSceneLimits(
  memory: ProjectFailureSummary,
  maxAttemptsPerScene = DEFAULT_MAX_RETRIES_PER_SCENE,
): RetryLimitStatus[] {
  return memory.sceneRecords.map((record) =>
    checkSceneRetryLimit(memory, record.sceneId, maxAttemptsPerScene),
  );
}
