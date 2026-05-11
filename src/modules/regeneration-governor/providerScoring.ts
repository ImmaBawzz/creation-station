import type {
  GlobalPatternMemory,
  ProjectFailureSummary,
  ProviderReliabilityRecord,
} from "@/modules/regeneration-governor/types";

/**
 * Calculate provider reliability scores from the global pattern memory
 * and a project's failure summary.
 */
export function calculateProviderScores(
  globalMemory: GlobalPatternMemory,
  projectMemory?: ProjectFailureSummary,
): ProviderReliabilityRecord[] {
  const now = new Date().toISOString();

  // Start from global scores if available
  const scoreMap = new Map<string, ProviderReliabilityRecord>(
    globalMemory.providerScores.map((s) => [s.provider, { ...s }]),
  );

  // Incorporate project-level data if provided
  if (projectMemory) {
    for (const record of projectMemory.sceneRecords) {
      for (const provider of record.providersTried) {
        const existing = scoreMap.get(provider) ?? {
          failureCount: 0,
          lastUpdatedAt: now,
          provider,
          reliabilityScore: 100,
          successCount: 0,
          totalAttempts: 0,
          workflowScores: {},
        };

        existing.totalAttempts += record.totalAttempts;
        existing.lastUpdatedAt = now;

        // If scene has recurring issues, count as failure for this provider
        if (record.recurringIssueKinds.length > 0) {
          existing.failureCount += record.totalAttempts;
        } else {
          existing.successCount += 1;
        }

        scoreMap.set(provider, existing);
      }
    }
  }

  // Recalculate reliability scores
  for (const record of scoreMap.values()) {
    if (record.totalAttempts > 0) {
      record.reliabilityScore = Math.round(
        Math.max(0, Math.min(100,
          ((record.totalAttempts - record.failureCount) / record.totalAttempts) * 100,
        )),
      );
    }
  }

  return Array.from(scoreMap.values()).sort(
    (a, b) => b.reliabilityScore - a.reliabilityScore,
  );
}

/**
 * Get the best provider for a given task, based on reliability scores.
 * Returns undefined if no provider data is available.
 */
export function getBestProvider(
  scores: ProviderReliabilityRecord[],
  excludeProviders: string[] = [],
): ProviderReliabilityRecord | undefined {
  return scores.find(
    (s) => s.reliabilityScore >= 50 && !excludeProviders.includes(s.provider),
  );
}

/**
 * Get providers that should be avoided (reliability below threshold).
 */
export function getUnreliableProviders(
  scores: ProviderReliabilityRecord[],
  threshold = 50,
): ProviderReliabilityRecord[] {
  return scores.filter((s) => s.reliabilityScore < threshold && s.totalAttempts >= 2);
}

/**
 * Update global pattern memory with the latest provider scores.
 */
export function mergeProviderScores(
  globalMemory: GlobalPatternMemory,
  newScores: ProviderReliabilityRecord[],
): GlobalPatternMemory {
  return {
    ...globalMemory,
    providerScores: newScores,
    updatedAt: new Date().toISOString(),
  };
}
