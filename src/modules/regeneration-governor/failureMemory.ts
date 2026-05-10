import type {
  ProjectFailureSummary,
  RegenerationAttempt,
  RegenerationFailureKind,
  SceneFailureRecord,
} from "@/modules/regeneration-governor/types";
import type { QualityIssue } from "@/modules/quality-director/types";

// ── Evaluator → FailureKind mapping ────────────────────────────────────────

const EVALUATOR_TO_KIND: Record<string, RegenerationFailureKind> = {
  "emotional-arc": "emotional-arc-issue",
  "lyric-sync": "lyric-sync-issue",
  "pacing": "pacing-issue",
  "repetition": "repetition-issue",
  "transition": "transition-issue",
  "visual-consistency": "visual-consistency-issue",
};

function issueToFailureKind(issue: QualityIssue): RegenerationFailureKind {
  return EVALUATOR_TO_KIND[issue.evaluator] ?? "quality-check-failed";
}

function findRecurringKinds(attempts: RegenerationAttempt[]): RegenerationFailureKind[] {
  const kindCounts = new Map<RegenerationFailureKind, number>();

  for (const attempt of attempts) {
    kindCounts.set(attempt.failureKind, (kindCounts.get(attempt.failureKind) ?? 0) + 1);
  }

  return Array.from(kindCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([kind]) => kind);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a ProjectFailureSummary from a QualityReport's issues.
 * Treats each critical issue per scene as one regeneration attempt.
 */
export function buildFailureMemory(
  projectId: string,
  issues: QualityIssue[],
  existingMemory?: ProjectFailureSummary | null,
): ProjectFailureSummary {
  const now = new Date().toISOString();
  const existingRecords = new Map<string, SceneFailureRecord>(
    (existingMemory?.sceneRecords ?? []).map((record) => [record.sceneId, record]),
  );

  // Group critical/warning issues by sceneId
  const byScene = new Map<string, QualityIssue[]>();

  for (const issue of issues) {
    if (issue.severity === "info") {
      continue;
    }

    const key = issue.sceneId ?? "global";
    const existing = byScene.get(key) ?? [];
    existing.push(issue);
    byScene.set(key, existing);
  }

  const updatedRecords: SceneFailureRecord[] = [];
  let totalProjectAttempts = existingMemory?.totalProjectAttempts ?? 0;

  for (const [sceneId, sceneIssues] of byScene) {
    const existing = existingRecords.get(sceneId);
    const prevAttempts = existing?.attempts ?? [];
    const attemptNumber = prevAttempts.length + 1;
    const providersTried = existing?.providersTried ?? [];

    const newAttempt: RegenerationAttempt = {
      attemptNumber,
      failureKind: issueToFailureKind(sceneIssues[0]),
      issueSummary: sceneIssues.map((i) => i.message).join("; ").slice(0, 200),
      timestamp: now,
    };

    const allAttempts = [...prevAttempts, newAttempt];
    totalProjectAttempts += 1;

    updatedRecords.push({
      attempts: allAttempts,
      firstFailedAt: existing?.firstFailedAt ?? now,
      lastFailedAt: now,
      providersTried,
      providersTriedCount: providersTried.length,
      recurringIssueKinds: findRecurringKinds(allAttempts),
      sceneId,
      totalAttempts: allAttempts.length,
    });
  }

  // Preserve records for scenes not in this batch
  for (const [sceneId, record] of existingRecords) {
    if (!byScene.has(sceneId)) {
      updatedRecords.push(record);
    }
  }

  return {
    firstAttemptAt: existingMemory?.firstAttemptAt ?? now,
    lastAttemptAt: now,
    projectId,
    sceneRecords: updatedRecords,
    totalProjectAttempts,
  };
}

/**
 * Record that a specific provider was tried for a scene.
 */
export function recordProviderAttempt(
  memory: ProjectFailureSummary,
  sceneId: string,
  provider: string,
): ProjectFailureSummary {
  const updatedRecords = memory.sceneRecords.map((record) => {
    if (record.sceneId !== sceneId) {
      return record;
    }

    const providersTried = record.providersTried.includes(provider)
      ? record.providersTried
      : [...record.providersTried, provider];

    return {
      ...record,
      providersTried,
      providersTriedCount: providersTried.length,
    };
  });

  return { ...memory, sceneRecords: updatedRecords };
}

/**
 * Get failure record for a specific scene (null if scene has no failures).
 */
export function getSceneFailureRecord(
  memory: ProjectFailureSummary,
  sceneId: string,
): SceneFailureRecord | null {
  return memory.sceneRecords.find((record) => record.sceneId === sceneId) ?? null;
}
