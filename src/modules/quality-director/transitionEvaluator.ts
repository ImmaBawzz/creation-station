import type { FinalAssemblyTransition } from "@/modules/final-assembly/types";
import type { QualityEvaluationInput, QualityEvaluatorResult, QualityIssue } from "@/modules/quality-director/types";

const EVALUATOR_NAME = "transition";
const OVERUSE_THRESHOLD = 0.6;
const MIN_VARIETY_COUNT = 2;

const SLOW_SECTION_KINDS = new Set(["slow", "cooldown", "emotional-peak"]);
const FAST_SECTION_KINDS = new Set(["drop", "build"]);

const SOFT_TRANSITIONS: Set<FinalAssemblyTransition> = new Set([
  "cinematic-fade",
  "atmospheric-dissolve",
]);

const HARD_TRANSITIONS: Set<FinalAssemblyTransition> = new Set([
  "hard-cut",
  "flash-cut",
  "beat-synced",
]);

export function evaluateTransitions(input: QualityEvaluationInput): QualityEvaluatorResult {
  const issues: QualityIssue[] = [];
  const scenes = input.finalAssemblyState.scenes;

  if (scenes.length < 2) {
    return { issues: [], score: 100 };
  }

  // 1. Count transition type frequency
  const transitionCounts = new Map<FinalAssemblyTransition, number>();

  for (const scene of scenes) {
    transitionCounts.set(scene.transition, (transitionCounts.get(scene.transition) ?? 0) + 1);
  }

  // 2. Detect overuse of a single transition type
  for (const [transition, count] of transitionCounts) {
    const ratio = count / scenes.length;

    if (ratio > OVERUSE_THRESHOLD) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `"${transition}" is overused (${(ratio * 100).toFixed(0)}% of transitions).`,
        recommendation: `Mix in alternative transition types. Consider cinematic-fade or atmospheric-dissolve for slower moments.`,
        severity: ratio > 0.8 ? "critical" : "warning",
      });
    }
  }

  // 3. Detect lack of transition variety
  if (transitionCounts.size < MIN_VARIETY_COUNT && scenes.length >= 4) {
    issues.push({
      evaluator: EVALUATOR_NAME,
      message: `Only ${transitionCounts.size} transition type${transitionCounts.size === 1 ? "" : "s"} used across ${scenes.length} scenes.`,
      recommendation: "Use at least 2–3 different transition types for visual variety.",
      severity: "warning",
    });
  }

  // 4. Detect inappropriate transitions for section mood
  const sequencing = input.timelinePlan.sceneSequencing;
  const sequenceBySceneId = new Map(sequencing.map((s) => [s.sceneId, s]));

  for (const scene of scenes) {
    const sequenceItem = sequenceBySceneId.get(scene.sceneId);

    if (!sequenceItem) {
      continue;
    }

    const sectionKind = sequenceItem.sectionKind;

    if (SLOW_SECTION_KINDS.has(sectionKind) && HARD_TRANSITIONS.has(scene.transition)) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `${scene.sceneId} uses a harsh "${scene.transition}" in a "${sectionKind}" section.`,
        recommendation: `Use a softer transition like cinematic-fade or atmospheric-dissolve for ${scene.sceneId}.`,
        sceneId: scene.sceneId,
        severity: "info",
      });
    }

    if (FAST_SECTION_KINDS.has(sectionKind) && SOFT_TRANSITIONS.has(scene.transition)) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `${scene.sceneId} uses a slow "${scene.transition}" in a high-energy "${sectionKind}" section.`,
        recommendation: `Use a snappier transition like hard-cut or beat-synced for ${scene.sceneId}.`,
        sceneId: scene.sceneId,
        severity: "info",
      });
    }
  }

  // Calculate score
  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const infoCount = issues.filter((issue) => issue.severity === "info").length;
  const score = Math.max(0, Math.min(100, 100 - criticalCount * 20 - warningCount * 10 - infoCount * 3));

  return { issues, score };
}
