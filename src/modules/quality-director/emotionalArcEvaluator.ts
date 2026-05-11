import type { QualityEvaluationInput, QualityEvaluatorResult, QualityIssue } from "@/modules/quality-director/types";
import type { TimelineSectionKind } from "@/modules/timeline-director/types";

const EVALUATOR_NAME = "emotional-arc";

const EXPECTED_ARC_ORDER: TimelineSectionKind[] = [
  "slow",
  "build",
  "drop",
  "emotional-peak",
  "cooldown",
];

const SECTION_ENERGY: Record<TimelineSectionKind, number> = {
  "slow": 1,
  "build": 2,
  "drop": 4,
  "emotional-peak": 5,
  "cooldown": 1,
};

export function evaluateEmotionalArc(input: QualityEvaluationInput): QualityEvaluatorResult {
  const issues: QualityIssue[] = [];
  const sequencing = input.timelinePlan.sceneSequencing;
  const climaxMap = input.timelinePlan.climaxMap;

  if (sequencing.length === 0) {
    return { issues: [], score: 100 };
  }

  const sectionKinds = sequencing.map((s) => s.sectionKind);
  const uniqueKinds = new Set(sectionKinds);

  // 1. Detect missing emotional arc segments
  for (const expectedKind of EXPECTED_ARC_ORDER) {
    if (!uniqueKinds.has(expectedKind)) {
      const label = expectedKind.replace("-", " ");
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `No "${label}" section found in the emotional arc.`,
        recommendation: `Consider adding a "${label}" section for a more complete storytelling arc.`,
        severity: expectedKind === "emotional-peak" || expectedKind === "build" ? "warning" : "info",
      });
    }
  }

  // 2. Detect anti-climax patterns (consecutive peaks)
  for (let i = 1; i < sectionKinds.length; i++) {
    if (sectionKinds[i] === "emotional-peak" && sectionKinds[i - 1] === "emotional-peak") {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `Consecutive emotional peaks at ${sequencing[i - 1].sceneId} and ${sequencing[i].sceneId} dilute impact.`,
        recommendation: `Insert a build or cooldown section between peaks for greater contrast.`,
        sceneId: sequencing[i].sceneId,
        severity: "warning",
      });
    }
  }

  // 3. Detect drop immediately after slow without build
  for (let i = 1; i < sectionKinds.length; i++) {
    if (sectionKinds[i] === "drop" && sectionKinds[i - 1] === "slow") {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `${sequencing[i].sceneId} jumps from "slow" directly to "drop" without a build-up.`,
        recommendation: "Add a build section before the drop for better emotional impact.",
        sceneId: sequencing[i].sceneId,
        severity: "info",
      });
    }
  }

  // 4. Detect flat energy arc (all scenes have similar pacing scores)
  const pacingScores = sequencing.map((s) => s.pacingScore);

  if (pacingScores.length > 3) {
    const minPacing = Math.min(...pacingScores);
    const maxPacing = Math.max(...pacingScores);
    const range = maxPacing - minPacing;

    if (range < 0.2 && maxPacing > 0) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `Pacing scores are very flat (range: ${range.toFixed(2)}). The video lacks dynamic energy shifts.`,
        recommendation: "Create more contrast between high-energy and low-energy sections.",
        severity: "warning",
      });
    }
  }

  // 5. Detect climax map misalignment
  if (climaxMap.length === 0 && sequencing.length >= 4) {
    issues.push({
      evaluator: EVALUATOR_NAME,
      message: "No climax points assigned in the timeline. The video lacks a clear emotional peak.",
      recommendation: "Assign at least one climax point to create a narrative focal point.",
      severity: "warning",
    });
  }

  // 6. Check if climax scenes are actually high-energy in the sequence
  for (const climax of climaxMap) {
    const seqItem = sequencing.find((s) => s.sceneId === climax.sceneId);

    if (seqItem) {
      const energy = SECTION_ENERGY[seqItem.sectionKind] ?? 2;

      if (energy <= 2) {
        issues.push({
          evaluator: EVALUATOR_NAME,
          message: `Climax point ${climax.sceneId} is in a "${seqItem.sectionKind}" section (low energy), weakening its impact.`,
          recommendation: `Reassign the climax to a "drop" or "emotional-peak" section, or escalate this scene's energy.`,
          sceneId: climax.sceneId,
          severity: "warning",
        });
      }
    }
  }

  // 7. Detect no cooldown after final peak/drop
  if (sectionKinds.length >= 3) {
    const lastKind = sectionKinds[sectionKinds.length - 1];
    const secondLastKind = sectionKinds[sectionKinds.length - 2];

    if ((lastKind === "drop" || lastKind === "emotional-peak") && secondLastKind !== "cooldown") {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: "The video ends on a high-energy section without a cooldown. This can feel abrupt.",
        recommendation: "Add a cooldown or slow section at the end for a satisfying resolution.",
        sceneId: sequencing[sequencing.length - 1].sceneId,
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
