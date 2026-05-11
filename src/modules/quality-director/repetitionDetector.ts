import type { QualityEvaluationInput, QualityEvaluatorResult, QualityIssue } from "@/modules/quality-director/types";

const EVALUATOR_NAME = "repetition";
const DESCRIPTION_SIMILARITY_THRESHOLD = 0.65;
const CONSECUTIVE_SAME_INTENSITY_LIMIT = 3;
const CONSECUTIVE_SAME_CAMERA_LIMIT = 3;

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function wordSet(text: string): Set<string> {
  return new Set(normalizeText(text).split(" ").filter(Boolean));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }

  let intersection = 0;

  for (const word of a) {
    if (b.has(word)) {
      intersection += 1;
    }
  }

  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function detectRepetition(input: QualityEvaluationInput): QualityEvaluatorResult {
  const issues: QualityIssue[] = [];
  const scenePlanScenes = input.scenePlan.scenes;
  const motionScenes = input.sceneMotionPlan.scenes;
  const assemblyScenes = input.finalAssemblyState.scenes;

  // 1. Detect near-duplicate visual descriptions
  const descriptionSets = scenePlanScenes.map((scene) => ({
    id: scene.id,
    words: wordSet(scene.visualDescription),
  }));

  for (let i = 0; i < descriptionSets.length; i++) {
    for (let j = i + 1; j < descriptionSets.length; j++) {
      const similarity = jaccardSimilarity(descriptionSets[i].words, descriptionSets[j].words);

      if (similarity >= DESCRIPTION_SIMILARITY_THRESHOLD) {
        issues.push({
          evaluator: EVALUATOR_NAME,
          message: `${descriptionSets[i].id} and ${descriptionSets[j].id} have very similar visual descriptions (${(similarity * 100).toFixed(0)}% overlap).`,
          recommendation: `Differentiate the visual concept for ${descriptionSets[j].id} to avoid repetitive imagery.`,
          sceneId: descriptionSets[j].id,
          severity: similarity >= 0.85 ? "critical" : "warning",
        });
      }
    }
  }

  // 2. Detect consecutive identical camera movements
  for (let i = 0; i < motionScenes.length - CONSECUTIVE_SAME_CAMERA_LIMIT + 1; i++) {
    const window = motionScenes.slice(i, i + CONSECUTIVE_SAME_CAMERA_LIMIT);
    const normalizedMovements = window.map((s) => normalizeText(s.cameraMovement));
    const allSame = normalizedMovements.every((m) => m === normalizedMovements[0]);

    if (allSame && normalizedMovements[0].length > 0) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `${CONSECUTIVE_SAME_CAMERA_LIMIT} consecutive scenes (${window.map((s) => s.sceneId).join(", ")}) use the same camera movement.`,
        recommendation: `Vary camera movements to maintain visual interest. Consider alternating push-in, tracking, and static shots.`,
        sceneId: window[1].sceneId,
        severity: "warning",
      });
      break;
    }
  }

  // 3. Detect consecutive identical motion intensity
  for (let i = 0; i < motionScenes.length - CONSECUTIVE_SAME_INTENSITY_LIMIT + 1; i++) {
    const window = motionScenes.slice(i, i + CONSECUTIVE_SAME_INTENSITY_LIMIT);
    const intensities = window.map((s) => s.motionIntensity);
    const allSame = intensities.every((intensity) => intensity === intensities[0]);

    if (allSame) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `${CONSECUTIVE_SAME_INTENSITY_LIMIT} consecutive scenes maintain "${intensities[0]}" motion intensity, creating visual flatness.`,
        recommendation: "Alternate motion intensity levels to create dynamic rhythm.",
        sceneId: window[1].sceneId,
        severity: "info",
      });
      break;
    }
  }

  // 4. Detect consecutive identical motion templates
  for (let i = 0; i < motionScenes.length - 2; i++) {
    if (
      motionScenes[i].templateKey === motionScenes[i + 1].templateKey &&
      motionScenes[i + 1].templateKey === motionScenes[i + 2].templateKey
    ) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `3 consecutive scenes use the "${motionScenes[i].templateKey}" motion template (${motionScenes[i].sceneId}, ${motionScenes[i + 1].sceneId}, ${motionScenes[i + 2].sceneId}).`,
        recommendation: "Vary motion templates across consecutive scenes for visual diversity.",
        sceneId: motionScenes[i + 1].sceneId,
        severity: "info",
      });
      break;
    }
  }

  // 5. Detect source image reuse across assembly scenes
  const imageUsage = new Map<string, string[]>();

  for (const scene of assemblyScenes) {
    if (scene.sourcePath) {
      const existing = imageUsage.get(scene.sourcePath) ?? [];
      existing.push(scene.sceneId);
      imageUsage.set(scene.sourcePath, existing);
    }
  }

  for (const [sourcePath, sceneIds] of imageUsage) {
    if (sceneIds.length > 1) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `Source "${sourcePath.split("/").pop() ?? sourcePath}" is reused across ${sceneIds.length} scenes (${sceneIds.join(", ")}).`,
        recommendation: `Regenerate unique images for ${sceneIds.slice(1).join(", ")} to avoid visual repetition.`,
        sceneId: sceneIds[1],
        severity: sceneIds.length > 2 ? "critical" : "warning",
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
