import type { QualityEvaluationInput, QualityEvaluatorResult, QualityIssue } from "@/modules/quality-director/types";

const EVALUATOR_NAME = "pacing";
const DURATION_OUTLIER_FACTOR = 2.0;
const MONOTONY_VARIANCE_THRESHOLD = 0.15;
const MIN_SCENE_DURATION = 1.0;
const MAX_SCENE_DURATION_RATIO = 0.4;

function standardDeviation(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const squaredDiffs = values.map((value) => (value - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((sum, value) => sum + value, 0) / values.length);
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function evaluatePacing(input: QualityEvaluationInput): QualityEvaluatorResult {
  const issues: QualityIssue[] = [];
  const scenes = input.finalAssemblyState.scenes;

  if (scenes.length === 0) {
    return { issues: [], score: 100 };
  }

  const durations = scenes.map((scene) => scene.correctedDuration);
  const avgDuration = mean(durations);
  const stdDev = standardDeviation(durations);
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);

  // Detect duration outliers
  for (const scene of scenes) {
    const deviation = Math.abs(scene.correctedDuration - avgDuration);

    if (stdDev > 0 && deviation > DURATION_OUTLIER_FACTOR * stdDev) {
      const direction = scene.correctedDuration > avgDuration ? "longer" : "shorter";
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `${scene.sceneId} is significantly ${direction} than average (${scene.correctedDuration.toFixed(1)}s vs ${avgDuration.toFixed(1)}s avg).`,
        recommendation: direction === "longer"
          ? `Shorten ${scene.sceneId} or split it into multiple scenes.`
          : `Extend ${scene.sceneId} or merge it with an adjacent scene.`,
        sceneId: scene.sceneId,
        severity: deviation > DURATION_OUTLIER_FACTOR * 1.5 * stdDev ? "critical" : "warning",
      });
    }
  }

  // Detect very short scenes
  for (const scene of scenes) {
    if (scene.correctedDuration < MIN_SCENE_DURATION) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `${scene.sceneId} is too short (${scene.correctedDuration.toFixed(2)}s). Minimum recommended is ${MIN_SCENE_DURATION}s.`,
        recommendation: `Extend ${scene.sceneId} or merge it with the adjacent scene.`,
        sceneId: scene.sceneId,
        severity: "warning",
      });
    }
  }

  // Detect single scene dominating total duration
  for (const scene of scenes) {
    if (scenes.length > 2 && scene.correctedDuration / totalDuration > MAX_SCENE_DURATION_RATIO) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `${scene.sceneId} takes ${((scene.correctedDuration / totalDuration) * 100).toFixed(0)}% of total runtime.`,
        recommendation: `Split ${scene.sceneId} into shorter segments for better pacing.`,
        sceneId: scene.sceneId,
        severity: "warning",
      });
    }
  }

  // Detect monotonous pacing (low variance)
  if (scenes.length > 3 && avgDuration > 0) {
    const coefficientOfVariation = stdDev / avgDuration;

    if (coefficientOfVariation < MONOTONY_VARIANCE_THRESHOLD) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: "Scene durations are very uniform, creating monotonous pacing.",
        recommendation: "Vary scene durations to create rhythmic interest — shorter for energy, longer for emotional weight.",
        severity: "info",
      });
    }
  }

  // Detect section imbalance from timeline pacing map
  const pacingMap = input.timelinePlan.pacingMap;
  const sectionGroups = new Map<string, number[]>();

  for (const entry of pacingMap) {
    const existing = sectionGroups.get(entry.sectionKind) ?? [];
    existing.push(entry.duration);
    sectionGroups.set(entry.sectionKind, existing);
  }

  for (const [kind, sectionDurations] of sectionGroups) {
    const sectionTotal = sectionDurations.reduce((sum, d) => sum + d, 0);
    const sectionRatio = sectionTotal / totalDuration;

    if (kind === "cooldown" && sectionRatio < 0.05 && totalDuration > 30) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `Cooldown section is very brief (${(sectionRatio * 100).toFixed(0)}% of runtime). The video may end abruptly.`,
        recommendation: "Extend the cooldown/outro section for a more natural ending.",
        severity: "info",
      });
    }

    if (kind === "drop" && sectionRatio > 0.5) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `Drop sections dominate ${(sectionRatio * 100).toFixed(0)}% of runtime, leaving little breathing room.`,
        recommendation: "Balance drops with build-up and cooldown sections.",
        severity: "warning",
      });
    }
  }

  // Calculate score: start at 100, deduct for issues
  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const infoCount = issues.filter((issue) => issue.severity === "info").length;
  const score = Math.max(0, Math.min(100, 100 - criticalCount * 20 - warningCount * 10 - infoCount * 3));

  return { issues, score };
}
