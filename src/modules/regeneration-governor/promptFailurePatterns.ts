import type {
  GlobalPatternMemory,
  ProjectFailureSummary,
  PromptFailureEntry,
  RegenerationFailureKind,
} from "@/modules/regeneration-governor/types";

// Known problematic prompt phrases that tend to cause instability
const KNOWN_UNSTABLE_PHRASES: ReadonlyArray<{ keywords: string[]; phrase: string }> = [
  { keywords: ["extreme", "camera", "shake"], phrase: "extreme camera shake" },
  { keywords: ["hyper", "fast", "transition"], phrase: "hyper fast transitions" },
  { keywords: ["rapid", "face", "morph"], phrase: "rapid face morph" },
  { keywords: ["extreme", "motion", "blur"], phrase: "extreme motion blur" },
  { keywords: ["rapid", "zoom"], phrase: "rapid zoom" },
  { keywords: ["aggressive", "strobe"], phrase: "aggressive strobe effect" },
  { keywords: ["chaotic", "camera"], phrase: "chaotic camera movement" },
  { keywords: ["violent", "shake"], phrase: "violent shake" },
  { keywords: ["extreme", "close", "face"], phrase: "extreme facial close-up" },
  { keywords: ["whip", "pan"], phrase: "whip pan" },
];

function matchesPhrase(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.every((kw) => lower.includes(kw));
}

/**
 * Extract prompt failure patterns from a project's failure memory.
 * Scans issue summaries for known problematic prompt phrases.
 */
export function extractPromptFailures(
  projectMemory: ProjectFailureSummary,
): PromptFailureEntry[] {
  const now = new Date().toISOString();
  const detected = new Map<string, PromptFailureEntry>();

  for (const record of projectMemory.sceneRecords) {
    for (const attempt of record.attempts) {
      const summary = attempt.issueSummary;

      for (const known of KNOWN_UNSTABLE_PHRASES) {
        if (matchesPhrase(summary, known.keywords)) {
          const existing = detected.get(known.phrase);

          if (existing) {
            existing.failureCount += 1;
            existing.lastSeenAt = now;

            if (!existing.relatedFailureKinds.includes(attempt.failureKind)) {
              existing.relatedFailureKinds.push(attempt.failureKind);
            }
          } else {
            detected.set(known.phrase, {
              failureCount: 1,
              firstSeenAt: now,
              lastSeenAt: now,
              phrase: known.phrase,
              projectIds: [projectMemory.projectId],
              relatedFailureKinds: [attempt.failureKind],
              severity: "low",
            });
          }
        }
      }
    }
  }

  // Set severity based on frequency
  for (const entry of detected.values()) {
    entry.severity = entry.failureCount >= 3 ? "high" : entry.failureCount >= 2 ? "medium" : "low";
  }

  return Array.from(detected.values()).sort((a, b) => b.failureCount - a.failureCount);
}

/**
 * Merge newly detected prompt failures into the global pattern memory.
 */
export function mergePromptFailures(
  globalMemory: GlobalPatternMemory,
  newEntries: PromptFailureEntry[],
  projectId: string,
): GlobalPatternMemory {
  const existing = new Map<string, PromptFailureEntry>(
    globalMemory.promptFailures.map((e) => [e.phrase, { ...e }]),
  );

  for (const entry of newEntries) {
    const current = existing.get(entry.phrase);

    if (current) {
      current.failureCount += entry.failureCount;
      current.lastSeenAt = entry.lastSeenAt;

      if (!current.projectIds.includes(projectId)) {
        current.projectIds.push(projectId);
      }

      for (const kind of entry.relatedFailureKinds) {
        if (!current.relatedFailureKinds.includes(kind)) {
          current.relatedFailureKinds.push(kind);
        }
      }

      current.severity = current.failureCount >= 5 ? "high" : current.failureCount >= 3 ? "medium" : "low";
    } else {
      existing.set(entry.phrase, { ...entry, projectIds: [projectId] });
    }
  }

  return {
    ...globalMemory,
    promptFailures: Array.from(existing.values()).sort((a, b) => b.failureCount - a.failureCount),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Check if a prompt phrase is known to cause instability.
 */
export function isUnstablePromptPhrase(phrase: string): boolean {
  return KNOWN_UNSTABLE_PHRASES.some((known) => matchesPhrase(phrase, known.keywords));
}
