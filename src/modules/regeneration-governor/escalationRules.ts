import type {
  EscalationDecision,
  EscalationLevel,
  ProjectFailureSummary,
  SceneFailureRecord,
} from "@/modules/regeneration-governor/types";
import { DEFAULT_MAX_RETRIES_PER_SCENE } from "@/modules/regeneration-governor/retryLimiter";

const RECURRING_ISSUE_SWAP_THRESHOLD = 2;
const PROVIDERS_TRIED_SWAP_THRESHOLD = 1;

// Available fallback providers to try in sequence when swapping
const PROVIDER_SWAP_SEQUENCE = ["mock-hq", "mock-alt", "local-mock"];

function chooseNextProvider(providersTried: string[]): string | undefined {
  return PROVIDER_SWAP_SEQUENCE.find((provider) => !providersTried.includes(provider));
}

function determineEscalationLevel(
  record: SceneFailureRecord,
  maxAttemptsPerScene: number,
): { level: EscalationLevel; reason: string; nextProvider?: string } {
  const { totalAttempts, recurringIssueKinds, providersTried, providersTriedCount } = record;
  const humanReviewThreshold = maxAttemptsPerScene - 1;

  // Hard stop: exceeded per-scene max
  if (totalAttempts >= maxAttemptsPerScene) {
    return {
      level: "hard-stop",
      reason: `Reached hard limit of ${maxAttemptsPerScene} attempts for ${record.sceneId}.`,
    };
  }

  // Swap provider: recurring issue or provider already tried — check this BEFORE human review
  // so we always try swapping before escalating
  if (
    recurringIssueKinds.length >= RECURRING_ISSUE_SWAP_THRESHOLD ||
    providersTriedCount >= PROVIDERS_TRIED_SWAP_THRESHOLD
  ) {
    const nextProvider = chooseNextProvider(providersTried);

    if (nextProvider) {
      return {
        level: "swap-provider",
        nextProvider,
        reason: `Recurring "${recurringIssueKinds[0] ?? "quality"}" failure on ${record.sceneId} — swapping provider from current to ${nextProvider}.`,
      };
    }

    // No more providers to try — escalate to human review
    return {
      level: "flag-human-review",
      reason: `All known providers exhausted for ${record.sceneId} (tried: ${providersTried.join(", ")}). Human review required.`,
    };
  }

  // Human review: many attempts with recurring failures and no swap options left
  if (totalAttempts >= humanReviewThreshold && recurringIssueKinds.length > 0) {
    return {
      level: "flag-human-review",
      reason: `${record.sceneId} has ${totalAttempts} attempts with recurring "${recurringIssueKinds[0]}" failures — needs human review.`,
    };
  }

  // Minor issue: just retry
  if (totalAttempts < humanReviewThreshold) {
    return {
      level: "retry-same",
      reason: `${record.sceneId} has ${totalAttempts} attempt(s). Retrying with same configuration.`,
    };
  }

  return {
    level: "none",
    reason: `${record.sceneId} has no escalation triggers.`,
  };
}

/**
 * Generate escalation decisions for all scenes that have failure records.
 */
export function evaluateEscalations(
  memory: ProjectFailureSummary,
  maxAttemptsPerScene = DEFAULT_MAX_RETRIES_PER_SCENE,
): EscalationDecision[] {
  return memory.sceneRecords.map((record) => {
    const { level, reason, nextProvider } = determineEscalationLevel(record, maxAttemptsPerScene);

    return {
      escalationLevel: level,
      reason,
      sceneId: record.sceneId,
      suggestedNextProvider: nextProvider,
    };
  });
}

/**
 * Check if any scene requires immediate human review or pipeline halt.
 */
export function hasBlockingEscalation(escalations: EscalationDecision[]): boolean {
  return escalations.some(
    (e) => e.escalationLevel === "flag-human-review" || e.escalationLevel === "hard-stop",
  );
}
