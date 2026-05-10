import type {
  CostProtectorStatus,
  EscalationDecision,
  ProjectFailureSummary,
  RegenerationAction,
  RetryLimitStatus,
  SceneRegenerationStrategy,
} from "@/modules/regeneration-governor/types";

/**
 * Determine the concrete regeneration action for a single scene
 * based on its retry limit, escalation decision, and cost status.
 */
export function buildSceneStrategy(
  sceneId: string,
  limitStatus: RetryLimitStatus,
  escalation: EscalationDecision,
  costStatus: CostProtectorStatus,
  memory: ProjectFailureSummary,
): SceneRegenerationStrategy {
  const record = memory.sceneRecords.find((r) => r.sceneId === sceneId);

  // 1. Hard limit reached on scene
  if (limitStatus.hardLimitReached) {
    return {
      action: "flag-for-human-review",
      estimatedCostUnits: limitStatus.attemptsUsed,
      reason: `Scene ${sceneId} has reached its max retry limit (${limitStatus.maxAttempts} attempts).`,
      sceneId,
    };
  }

  // 2. Global project budget exceeded
  if (costStatus.budgetExceeded) {
    return {
      action: "halt-pipeline",
      estimatedCostUnits: costStatus.estimatedCostUnits,
      reason: `Project budget of ${costStatus.maxBudgetUnits} cost units exceeded. Halting further regeneration.`,
      sceneId,
    };
  }

  // 3. Escalation hard-stop
  if (escalation.escalationLevel === "hard-stop") {
    return {
      action: "flag-for-human-review",
      estimatedCostUnits: limitStatus.attemptsUsed,
      reason: escalation.reason,
      sceneId,
    };
  }

  // 4. Human review flagged
  if (escalation.escalationLevel === "flag-human-review") {
    return {
      action: "flag-for-human-review",
      estimatedCostUnits: limitStatus.attemptsUsed,
      reason: escalation.reason,
      sceneId,
    };
  }

  // 5. Provider swap recommended
  if (escalation.escalationLevel === "swap-provider" && escalation.suggestedNextProvider) {
    return {
      action: "swap-provider-and-retry",
      estimatedCostUnits: limitStatus.attemptsUsed + 2,
      reason: escalation.reason,
      sceneId,
      suggestedProvider: escalation.suggestedNextProvider,
    };
  }

  // 6. Scene has fallback image available (was using fallback)
  if (record && record.totalAttempts >= 2 && !escalation.suggestedNextProvider) {
    return {
      action: "accept-fallback",
      estimatedCostUnits: limitStatus.attemptsUsed,
      reason: `${sceneId} has ${record.totalAttempts} attempts. Accepting static image fallback to preserve pipeline flow.`,
      sceneId,
    };
  }

  // 7. Default: retry same
  return {
    action: "retry-scene",
    estimatedCostUnits: limitStatus.attemptsUsed + 1,
    reason: escalation.reason,
    sceneId,
  };
}

/**
 * Build strategies for all scenes with failures.
 */
export function buildAllStrategies(
  memory: ProjectFailureSummary,
  limitStatuses: RetryLimitStatus[],
  escalations: EscalationDecision[],
  costStatus: CostProtectorStatus,
): SceneRegenerationStrategy[] {
  const limitByScene = new Map(limitStatuses.map((l) => [l.sceneId, l]));
  const escalationByScene = new Map(escalations.map((e) => [e.sceneId, e]));

  return memory.sceneRecords.map((record) => {
    const limit = limitByScene.get(record.sceneId);
    const escalation = escalationByScene.get(record.sceneId);

    if (!limit || !escalation) {
      return {
        action: "retry-scene" as RegenerationAction,
        estimatedCostUnits: record.totalAttempts,
        reason: "No limit or escalation data — defaulting to retry.",
        sceneId: record.sceneId,
      };
    }

    return buildSceneStrategy(record.sceneId, limit, escalation, costStatus, memory);
  });
}
