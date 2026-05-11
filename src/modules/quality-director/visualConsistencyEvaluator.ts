import type { QualityEvaluationInput, QualityEvaluatorResult, QualityIssue } from "@/modules/quality-director/types";

const EVALUATOR_NAME = "visual-consistency";
const FALLBACK_WARNING_THRESHOLD = 0.2;
const FALLBACK_CRITICAL_THRESHOLD = 0.5;
const JARRING_TONE_PAIRS = new Set([
  "intense→reflective",
  "reflective→intense",
  "anthemic→reflective",
  "steady→intense",
]);

export function evaluateVisualConsistency(input: QualityEvaluationInput): QualityEvaluatorResult {
  const issues: QualityIssue[] = [];
  const scenes = input.finalAssemblyState.scenes;
  const scenePlanScenes = input.scenePlan.scenes;

  if (scenes.length === 0) {
    return { issues: [], score: 100 };
  }

  // 1. Detect fallback image usage ratio
  const fallbackScenes = scenes.filter((scene) => scene.isFallback);
  const fallbackRatio = fallbackScenes.length / scenes.length;

  if (fallbackRatio >= FALLBACK_CRITICAL_THRESHOLD) {
    issues.push({
      evaluator: EVALUATOR_NAME,
      message: `${(fallbackRatio * 100).toFixed(0)}% of scenes use fallback images instead of generated video.`,
      recommendation: "Generate video clips for remaining scenes before final export.",
      severity: "critical",
    });
  } else if (fallbackRatio >= FALLBACK_WARNING_THRESHOLD) {
    issues.push({
      evaluator: EVALUATOR_NAME,
      message: `${(fallbackRatio * 100).toFixed(0)}% of scenes use fallback images. This degrades visual quality.`,
      recommendation: "Generate video clips for fallback scenes to improve consistency.",
      severity: "warning",
    });
  }

  // Flag individual fallback scenes
  for (const scene of fallbackScenes) {
    issues.push({
      evaluator: EVALUATOR_NAME,
      message: `${scene.sceneId} is using a fallback image instead of video${scene.fallbackReason ? ` (reason: ${scene.fallbackReason})` : ""}.`,
      recommendation: `Regenerate the video clip for ${scene.sceneId}.`,
      sceneId: scene.sceneId,
      severity: fallbackRatio >= FALLBACK_CRITICAL_THRESHOLD ? "critical" : "warning",
    });
  }

  // 2. Detect provider mix inconsistency
  const providerCounts = new Map<string, number>();

  for (const scene of scenes) {
    providerCounts.set(scene.providerId, (providerCounts.get(scene.providerId) ?? 0) + 1);
  }

  if (providerCounts.size > 1) {
    const providers = Array.from(providerCounts.entries())
      .map(([id, count]) => `${id}(${count})`)
      .join(", ");

    issues.push({
      evaluator: EVALUATOR_NAME,
      message: `Multiple video providers used across scenes: ${providers}. This may cause visual style inconsistency.`,
      recommendation: "Consider regenerating all scenes with a single provider for consistent visual style.",
      severity: "info",
    });
  }

  // 3. Detect jarring emotional tone shifts between consecutive scenes
  const scenePlanById = new Map(scenePlanScenes.map((scene) => [scene.id, scene]));
  const orderedScenePlanItems = scenes
    .map((scene) => scenePlanById.get(scene.sceneId))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  for (let i = 1; i < orderedScenePlanItems.length; i++) {
    const prevTone = orderedScenePlanItems[i - 1].emotionalTone;
    const currTone = orderedScenePlanItems[i].emotionalTone;
    const transitionKey = `${prevTone}→${currTone}`;

    if (JARRING_TONE_PAIRS.has(transitionKey)) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `Jarring emotional shift from "${prevTone}" (${orderedScenePlanItems[i - 1].id}) to "${currTone}" (${orderedScenePlanItems[i].id}).`,
        recommendation: `Add a transitional scene between ${orderedScenePlanItems[i - 1].id} and ${orderedScenePlanItems[i].id}, or adjust emotional tones.`,
        sceneId: orderedScenePlanItems[i].id,
        severity: "info",
      });
    }
  }

  // 4. Detect mixed source kinds (video vs fallback) within sequential runs
  let consecutiveMixCount = 0;

  for (let i = 1; i < scenes.length; i++) {
    if (scenes[i].sourceKind !== scenes[i - 1].sourceKind) {
      consecutiveMixCount += 1;
    }
  }

  if (consecutiveMixCount > scenes.length * 0.4 && scenes.length > 4) {
    issues.push({
      evaluator: EVALUATOR_NAME,
      message: "Frequent alternation between video clips and fallback images creates visual discontinuity.",
      recommendation: "Group fallback scenes together or regenerate them as video for smoother flow.",
      severity: "warning",
    });
  }

  // Calculate score
  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const infoCount = issues.filter((issue) => issue.severity === "info").length;
  const score = Math.max(0, Math.min(100, 100 - criticalCount * 20 - warningCount * 10 - infoCount * 3));

  return { issues, score };
}
