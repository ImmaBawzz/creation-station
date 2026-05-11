import type {
  EscalationDecision,
  FallbackDecision,
  FallbackOutcome,
  ProjectFailureSummary,
  SceneRegenerationStrategy,
} from "@/modules/regeneration-governor/types";

/**
 * Determine the final fallback outcome for a scene when all retry attempts
 * are exhausted or pipeline halted. This is the last resort decision.
 */
export function decideFallback(
  sceneId: string,
  strategy: SceneRegenerationStrategy,
  escalation: EscalationDecision,
  memory: ProjectFailureSummary,
): FallbackDecision {
  const record = memory.sceneRecords.find((r) => r.sceneId === sceneId);

  // If strategy says halt, escalate at the report level
  if (strategy.action === "halt-pipeline") {
    return {
      fallbackOutcome: "escalate",
      reason: strategy.reason,
      sceneId,
    };
  }

  // Human review required — escalate
  if (
    strategy.action === "flag-for-human-review" ||
    escalation.escalationLevel === "flag-human-review" ||
    escalation.escalationLevel === "hard-stop"
  ) {
    return {
      fallbackOutcome: "escalate",
      reason: `${sceneId} requires human review before proceeding.`,
      sceneId,
    };
  }

  // If strategy is accept-fallback, use static image
  if (strategy.action === "accept-fallback") {
    return {
      fallbackOutcome: "use-static-image",
      reason: `Using static image fallback for ${sceneId} after ${record?.totalAttempts ?? 0} failed attempts.`,
      sceneId,
    };
  }

  // Multiple attempts with same issues — try adjacent scene as cover
  if (record && record.totalAttempts >= 2 && record.recurringIssueKinds.length > 0) {
    return {
      fallbackOutcome: "use-adjacent-scene",
      reason: `Recurring "${record.recurringIssueKinds[0]}" failures on ${sceneId}. Using adjacent scene as visual cover.`,
      sceneId,
    };
  }

  // First attempt — fall back gracefully to static image
  return {
    fallbackOutcome: "use-static-image",
    reason: `First failure on ${sceneId}. Using source image as placeholder while retry is attempted.`,
    sceneId,
  };
}

/**
 * Generate fallback decisions for all scenes with strategies.
 */
export function buildAllFallbacks(
  strategies: SceneRegenerationStrategy[],
  escalations: EscalationDecision[],
  memory: ProjectFailureSummary,
): FallbackDecision[] {
  const escalationByScene = new Map(escalations.map((e) => [e.sceneId, e]));

  return strategies.map((strategy) => {
    const escalation = escalationByScene.get(strategy.sceneId);

    if (!escalation) {
      const outcome: FallbackOutcome = "use-static-image";
      return {
        fallbackOutcome: outcome,
        reason: "No escalation data — defaulting to static image.",
        sceneId: strategy.sceneId,
      };
    }

    return decideFallback(strategy.sceneId, strategy, escalation, memory);
  });
}
