import type { QualityIssue, QualityReport, RetryAction } from "@/modules/quality-director/types";

// Re-export for convenience within this module
export type { QualityIssue, QualityReport, RetryAction };

// ─── Failure Tracking ────────────────────────────────────────────────────────

export type RegenerationFailureKind =
  | "quality-check-failed"
  | "provider-error"
  | "transition-issue"
  | "pacing-issue"
  | "repetition-issue"
  | "lyric-sync-issue"
  | "visual-consistency-issue"
  | "emotional-arc-issue";

export type RegenerationAttempt = {
  attemptNumber: number;
  failureKind: RegenerationFailureKind;
  issueSummary: string;
  provider?: string;
  qualityScore?: number;
  timestamp: string;
};

export type SceneFailureRecord = {
  attempts: RegenerationAttempt[];
  firstFailedAt: string;
  lastFailedAt: string;
  providersTriedCount: number;
  providersTried: string[];
  recurringIssueKinds: RegenerationFailureKind[];
  sceneId: string;
  totalAttempts: number;
};

export type ProjectFailureSummary = {
  firstAttemptAt: string;
  lastAttemptAt: string;
  projectId: string;
  sceneRecords: SceneFailureRecord[];
  totalProjectAttempts: number;
};

// ─── Limits ──────────────────────────────────────────────────────────────────

export type RetryLimitStatus = {
  allowRetry: boolean;
  attemptsUsed: number;
  hardLimitReached: boolean;
  maxAttempts: number;
  remainingAttempts: number;
  sceneId: string;
};

export type ProjectBudgetStatus = {
  allowFurtherRetries: boolean;
  maxProjectAttempts: number;
  projectId: string;
  totalAttemptsUsed: number;
};

// ─── Cost ─────────────────────────────────────────────────────────────────────

export type CostProtectorStatus = {
  budgetExceeded: boolean;
  estimatedCostUnits: number;
  maxBudgetUnits: number;
  projectId: string;
  remainingBudgetUnits: number;
  sceneCounts: {
    awaitingRetry: number;
    failed: number;
    succeeded: number;
    total: number;
  };
};

// ─── Escalation ───────────────────────────────────────────────────────────────

export type EscalationLevel =
  | "none"
  | "retry-same"
  | "swap-provider"
  | "flag-human-review"
  | "hard-stop";

export type EscalationDecision = {
  escalationLevel: EscalationLevel;
  reason: string;
  sceneId: string;
  suggestedNextProvider?: string;
};

// ─── Strategy ─────────────────────────────────────────────────────────────────

export type RegenerationAction =
  | "retry-scene"
  | "swap-provider-and-retry"
  | "accept-fallback"
  | "skip-scene"
  | "flag-for-human-review"
  | "halt-pipeline";

export type SceneRegenerationStrategy = {
  action: RegenerationAction;
  estimatedCostUnits: number;
  reason: string;
  sceneId: string;
  suggestedProvider?: string;
};

// ─── Fallback ─────────────────────────────────────────────────────────────────

export type FallbackOutcome =
  | "use-static-image"
  | "use-previous-successful-attempt"
  | "use-adjacent-scene"
  | "omit-scene"
  | "escalate";

export type FallbackDecision = {
  fallbackOutcome: FallbackOutcome;
  reason: string;
  sceneId: string;
};

// ─── Report ───────────────────────────────────────────────────────────────────

export type RegenerationVerdict =
  | "clean"
  | "retries-consumed"
  | "budget-exceeded"
  | "human-review-required"
  | "pipeline-halted";

export type RegenerationReport = {
  budgetStatus: CostProtectorStatus;
  createdAt: string;
  escalations: EscalationDecision[];
  fallbackDecisions: FallbackDecision[];
  manualOverrideApplied?: boolean;
  projectId: string;
  sceneStrategies: SceneRegenerationStrategy[];
  summary: {
    scenesEscalated: number;
    scenesFlagged: number;
    scenesHalted: number;
    scenesRetryAllowed: number;
    totalScenes: number;
  };
  verdict: RegenerationVerdict;
};
