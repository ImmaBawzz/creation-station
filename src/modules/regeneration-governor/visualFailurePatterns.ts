import type {
  GlobalPatternMemory,
  ProjectFailureSummary,
  VisualFailureEntry,
} from "@/modules/regeneration-governor/types";

// Known visual instability patterns detected from issue summaries
const VISUAL_INSTABILITY_PATTERNS: ReadonlyArray<{ keywords: string[]; pattern: string }> = [
  { keywords: ["continuity", "drift"], pattern: "continuity drift" },
  { keywords: ["facial", "deformation"], pattern: "facial deformation" },
  { keywords: ["face", "distort"], pattern: "facial distortion" },
  { keywords: ["lyric", "desync"], pattern: "lyric desync" },
  { keywords: ["lyric", "sync", "mismatch"], pattern: "lyric sync mismatch" },
  { keywords: ["scene", "repetition"], pattern: "scene repetition" },
  { keywords: ["reused", "scene"], pattern: "scene repetition" },
  { keywords: ["similar", "visual"], pattern: "visual repetition" },
  { keywords: ["fallback", "image"], pattern: "fallback image degradation" },
  { keywords: ["style", "inconsisten"], pattern: "visual style inconsistency" },
  { keywords: ["provider", "mix"], pattern: "provider mix inconsistency" },
  { keywords: ["jarring", "emotional"], pattern: "jarring emotional shift" },
  { keywords: ["alternation", "video", "fallback"], pattern: "video-fallback alternation" },
];

function matchesPattern(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.every((kw) => lower.includes(kw));
}

/**
 * Extract visual failure patterns from a project's failure memory.
 */
export function extractVisualFailures(
  projectMemory: ProjectFailureSummary,
): VisualFailureEntry[] {
  const now = new Date().toISOString();
  const detected = new Map<string, VisualFailureEntry>();

  for (const record of projectMemory.sceneRecords) {
    for (const attempt of record.attempts) {
      const summary = attempt.issueSummary;

      for (const known of VISUAL_INSTABILITY_PATTERNS) {
        if (matchesPattern(summary, known.keywords)) {
          const existing = detected.get(known.pattern);

          if (existing) {
            existing.failureCount += 1;
            existing.affectedSceneCount += 1;
            existing.lastSeenAt = now;

            for (const provider of record.providersTried) {
              if (!existing.relatedProviders.includes(provider)) {
                existing.relatedProviders.push(provider);
              }
            }
          } else {
            detected.set(known.pattern, {
              affectedSceneCount: 1,
              failureCount: 1,
              firstSeenAt: now,
              lastSeenAt: now,
              pattern: known.pattern,
              projectIds: [projectMemory.projectId],
              relatedProviders: [...record.providersTried],
              severity: "low",
            });
          }
        }
      }
    }
  }

  // Set severity
  for (const entry of detected.values()) {
    entry.severity = entry.failureCount >= 3 ? "high" : entry.failureCount >= 2 ? "medium" : "low";
  }

  return Array.from(detected.values()).sort((a, b) => b.failureCount - a.failureCount);
}

/**
 * Merge newly detected visual failures into the global pattern memory.
 */
export function mergeVisualFailures(
  globalMemory: GlobalPatternMemory,
  newEntries: VisualFailureEntry[],
  projectId: string,
): GlobalPatternMemory {
  const existing = new Map<string, VisualFailureEntry>(
    globalMemory.visualFailures.map((e) => [e.pattern, { ...e }]),
  );

  for (const entry of newEntries) {
    const current = existing.get(entry.pattern);

    if (current) {
      current.failureCount += entry.failureCount;
      current.affectedSceneCount += entry.affectedSceneCount;
      current.lastSeenAt = entry.lastSeenAt;

      if (!current.projectIds.includes(projectId)) {
        current.projectIds.push(projectId);
      }

      for (const provider of entry.relatedProviders) {
        if (!current.relatedProviders.includes(provider)) {
          current.relatedProviders.push(provider);
        }
      }

      current.severity = current.failureCount >= 5 ? "high" : current.failureCount >= 3 ? "medium" : "low";
    } else {
      existing.set(entry.pattern, { ...entry, projectIds: [projectId] });
    }
  }

  return {
    ...globalMemory,
    updatedAt: new Date().toISOString(),
    visualFailures: Array.from(existing.values()).sort((a, b) => b.failureCount - a.failureCount),
  };
}
