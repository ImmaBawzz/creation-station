import type { FinalAssemblyScene, QualityEvaluationInput, QualityEvaluatorResult, QualityIssue } from "@/modules/quality-director/types";

const EVALUATOR_NAME = "lyric-sync";
const OVERLAP_TOLERANCE = 0.15;
const DEAD_ZONE_THRESHOLD = 3.0;

function findSceneForTime(scenes: FinalAssemblyScene[], time: number): FinalAssemblyScene | undefined {
  let cumulativeStart = 0;

  for (const scene of scenes) {
    const sceneEnd = cumulativeStart + scene.correctedDuration;

    if (time >= cumulativeStart - OVERLAP_TOLERANCE && time <= sceneEnd + OVERLAP_TOLERANCE) {
      return scene;
    }

    cumulativeStart = sceneEnd;
  }

  return undefined;
}

function getSceneBounds(scenes: FinalAssemblyScene[]): Array<{ end: number; sceneId: string; start: number }> {
  const bounds: Array<{ end: number; sceneId: string; start: number }> = [];
  let cursor = 0;

  for (const scene of scenes) {
    bounds.push({
      end: cursor + scene.correctedDuration,
      sceneId: scene.sceneId,
      start: cursor,
    });
    cursor += scene.correctedDuration;
  }

  return bounds;
}

export function evaluateLyricSync(input: QualityEvaluationInput): QualityEvaluatorResult {
  const issues: QualityIssue[] = [];
  const scenes = input.finalAssemblyState.scenes;
  const cues = input.subtitleCues;

  if (cues.length === 0 || scenes.length === 0) {
    return { issues: [], score: 100 };
  }

  const sceneBounds = getSceneBounds(scenes);

  // 1. Detect subtitle cues that span across scene boundaries
  for (const cue of cues) {
    const startScene = findSceneForTime(scenes, cue.start);
    const endScene = findSceneForTime(scenes, cue.end);

    if (startScene && endScene && startScene.sceneId !== endScene.sceneId) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `Lyric "${truncate(cue.text, 40)}" spans across scene boundary (${startScene.sceneId} → ${endScene.sceneId}).`,
        recommendation: `Adjust scene timing so the lyric line falls within a single scene, or split the lyric cue.`,
        sceneId: startScene.sceneId,
        severity: "warning",
      });
    }
  }

  // 2. Detect scenes with no lyric coverage (dead zones)
  for (const bound of sceneBounds) {
    if (bound.end - bound.start < DEAD_ZONE_THRESHOLD) {
      continue;
    }

    const hasCoverage = cues.some(
      (cue) => cue.start < bound.end - OVERLAP_TOLERANCE && cue.end > bound.start + OVERLAP_TOLERANCE,
    );

    if (!hasCoverage) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `${bound.sceneId} has no lyric coverage (${(bound.end - bound.start).toFixed(1)}s dead zone).`,
        recommendation: `This may be intentional for instrumental sections. If not, check lyric timing alignment.`,
        sceneId: bound.sceneId,
        severity: "info",
      });
    }
  }

  // 3. Detect cues that start or end significantly outside any scene window
  const totalDuration = sceneBounds.length > 0
    ? sceneBounds[sceneBounds.length - 1].end
    : 0;

  for (const cue of cues) {
    if (cue.start > totalDuration + OVERLAP_TOLERANCE) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `Lyric "${truncate(cue.text, 40)}" starts at ${cue.start.toFixed(1)}s, after all scenes end at ${totalDuration.toFixed(1)}s.`,
        recommendation: "Extend the timeline or remove orphaned lyric cues.",
        severity: "critical",
      });
    }

    if (cue.end < -OVERLAP_TOLERANCE) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `Lyric "${truncate(cue.text, 40)}" has a negative end time (${cue.end.toFixed(1)}s).`,
        recommendation: "Fix lyric timing data — end time should be positive.",
        severity: "critical",
      });
    }
  }

  // 4. Detect cue ordering issues
  for (let i = 1; i < cues.length; i++) {
    if (cues[i].start < cues[i - 1].end - OVERLAP_TOLERANCE) {
      issues.push({
        evaluator: EVALUATOR_NAME,
        message: `Lyric cues overlap: "${truncate(cues[i - 1].text, 25)}" ends at ${cues[i - 1].end.toFixed(1)}s but "${truncate(cues[i].text, 25)}" starts at ${cues[i].start.toFixed(1)}s.`,
        recommendation: "Fix overlapping lyric timing to avoid subtitle collisions.",
        severity: "warning",
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

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
