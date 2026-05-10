import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  FailurePatternCategory,
  FailurePatternEntry,
  GlobalPatternMemory,
  ProjectFailureSummary,
  RegenerationFailureKind,
} from "@/modules/regeneration-governor/types";
import { VISUAL_WORKSPACE_PATH } from "@/modules/visual-engine/paths";

const GLOBAL_QUALITY_DIR = path.join(VISUAL_WORKSPACE_PATH, "quality");
const PATTERN_MEMORY_FILE = "patternMemory.json";

function getGlobalPatternPath(): string {
  return path.join(GLOBAL_QUALITY_DIR, PATTERN_MEMORY_FILE);
}

function createEmptyPatternMemory(): GlobalPatternMemory {
  const now = new Date().toISOString();

  return {
    createdAt: now,
    failurePatterns: [],
    promptFailures: [],
    providerScores: [],
    updatedAt: now,
    version: 1,
    visualFailures: [],
  };
}

const KIND_TO_CATEGORY: Record<RegenerationFailureKind, FailurePatternCategory> = {
  "emotional-arc-issue": "quality",
  "lyric-sync-issue": "timeline",
  "pacing-issue": "workflow",
  "provider-error": "provider",
  "quality-check-failed": "quality",
  "repetition-issue": "visual",
  "transition-issue": "workflow",
  "visual-consistency-issue": "visual",
};

function severityFromAttempts(attempts: number): FailurePatternEntry["severity"] {
  if (attempts >= 5) return "critical";
  if (attempts >= 3) return "high";
  if (attempts >= 2) return "medium";
  return "low";
}

/**
 * Read the global pattern memory from disk. Returns empty state if not found.
 */
export async function readGlobalPatternMemory(): Promise<GlobalPatternMemory> {
  try {
    const source = await readFile(getGlobalPatternPath(), "utf8");
    const payload = JSON.parse(source) as GlobalPatternMemory;

    if (!payload || typeof payload !== "object" || !payload.version) {
      return createEmptyPatternMemory();
    }

    return payload;
  } catch {
    return createEmptyPatternMemory();
  }
}

/**
 * Write the global pattern memory to disk.
 */
export async function writeGlobalPatternMemory(memory: GlobalPatternMemory): Promise<void> {
  await mkdir(GLOBAL_QUALITY_DIR, { recursive: true });
  await writeFile(getGlobalPatternPath(), `${JSON.stringify(memory, null, 2)}\n`, "utf8");
}

/**
 * Contribute a project's failure data to the global pattern memory.
 * Called after each regeneration governor run.
 */
export async function contributeToGlobalPatterns(
  projectMemory: ProjectFailureSummary,
): Promise<GlobalPatternMemory> {
  const global = await readGlobalPatternMemory();
  const now = new Date().toISOString();
  const projectId = projectMemory.projectId;

  // Build a map of existing patterns by key for efficient merging
  const patternMap = new Map<string, FailurePatternEntry>(
    global.failurePatterns.map((p) => [`${p.category}:${p.pattern}`, p]),
  );

  for (const record of projectMemory.sceneRecords) {
    for (const attempt of record.attempts) {
      const category = KIND_TO_CATEGORY[attempt.failureKind];
      const patternKey = `${category}:${attempt.failureKind}`;
      const existing = patternMap.get(patternKey);

      if (existing) {
        existing.frequency += 1;
        existing.lastSeenAt = now;
        existing.totalCostUnits += 1;

        if (!existing.projectIds.includes(projectId)) {
          existing.projectIds.push(projectId);
        }

        existing.severity = severityFromAttempts(existing.frequency);
      } else {
        patternMap.set(patternKey, {
          category,
          firstSeenAt: now,
          frequency: 1,
          lastSeenAt: now,
          pattern: attempt.failureKind,
          projectIds: [projectId],
          recoveryRate: 0,
          severity: "low",
          totalCostUnits: 1,
        });
      }
    }
  }

  const updated: GlobalPatternMemory = {
    ...global,
    failurePatterns: Array.from(patternMap.values()),
    updatedAt: now,
  };

  await writeGlobalPatternMemory(updated);

  return updated;
}

/**
 * Get the most frequent failure patterns from global memory.
 */
export function getTopPatterns(
  memory: GlobalPatternMemory,
  limit = 10,
): FailurePatternEntry[] {
  return [...memory.failurePatterns]
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit);
}

/**
 * Check if a given failure kind is a known recurring pattern globally.
 */
export function isKnownRecurringPattern(
  memory: GlobalPatternMemory,
  failureKind: RegenerationFailureKind,
  minFrequency = 3,
): boolean {
  return memory.failurePatterns.some(
    (p) => p.pattern === failureKind && p.frequency >= minFrequency,
  );
}
