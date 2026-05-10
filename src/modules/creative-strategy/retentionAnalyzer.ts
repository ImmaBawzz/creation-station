import type { ScenePlan } from "@/modules/scene-planner";
import type { TimelinePlan, TimelineSceneSequenceItem } from "@/modules/timeline-director/types";
import type { RetentionAnalysis, RetentionWarning } from "@/modules/creative-strategy/types";

/**
 * Analyzes the timeline and scene plan to evaluate audience retention.
 * Focuses on the first 10 seconds (the hook window) and repetitive pacing patterns.
 */
export function analyzeRetention(scenePlan: ScenePlan, timelinePlan: TimelinePlan): RetentionAnalysis {
  let firstTenSecondsScore = 100;
  let overallRetentionScore = 100;
  let weakOpeningsDetected = false;
  const pacingRepetitionWarnings: RetentionWarning[] = [];

  // Analyze first 10 seconds (Hook window)
  const introScenes = timelinePlan.sceneSequencing.filter(s => s.startTime < 10);
  
  if (introScenes.length === 0) {
    firstTenSecondsScore -= 50;
    weakOpeningsDetected = true;
  } else if (introScenes.length === 1 && introScenes[0].originalDuration > 5) {
    // A single scene lingering for more than 5 seconds at the start can kill retention
    firstTenSecondsScore -= 30;
    weakOpeningsDetected = true;
    pacingRepetitionWarnings.push({
      reason: `Opening scene ${introScenes[0].sceneId} is too slow (${introScenes[0].originalDuration}s) for optimal retention.`,
      recommendedAction: "Split the intro into multiple shorter cuts or increase motion intensity.",
      sceneId: introScenes[0].sceneId,
      severity: "high",
      timeWindow: [0, introScenes[0].endTime],
    });
  } else {
    // Check if motion intensity is high enough in the intro
    const hasHighMotion = introScenes.some(s => s.motionIntensity === "high" || s.motionIntensity === "extreme");
    if (!hasHighMotion) {
      firstTenSecondsScore -= 15;
    }
  }

  // Detect repetitive pacing (scenes with same duration back-to-back)
  let consecutiveSimilarDurations = 0;
  for (let i = 1; i < timelinePlan.sceneSequencing.length; i++) {
    const prev = timelinePlan.sceneSequencing[i - 1];
    const curr = timelinePlan.sceneSequencing[i];

    // If duration is within 10%
    const durationDiff = Math.abs(curr.originalDuration - prev.originalDuration);
    const percentDiff = durationDiff / prev.originalDuration;

    if (percentDiff < 0.1) {
      consecutiveSimilarDurations++;
      if (consecutiveSimilarDurations >= 3) {
        overallRetentionScore -= 10;
        pacingRepetitionWarnings.push({
          reason: `Scenes ${timelinePlan.sceneSequencing[i - 2].sceneId} to ${curr.sceneId} have nearly identical durations, causing pacing fatigue.`,
          recommendedAction: "Vary cut durations to break predictable rhythm. Consider jump cuts or extending a hero shot.",
          sceneId: curr.sceneId,
          severity: "medium",
          timeWindow: [timelinePlan.sceneSequencing[i - 2].startTime, curr.endTime],
        });
        consecutiveSimilarDurations = 0; // reset
      }
    } else {
      consecutiveSimilarDurations = 0;
    }
  }

  overallRetentionScore = Math.max(0, Math.min(100, overallRetentionScore - (weakOpeningsDetected ? 10 : 0)));
  firstTenSecondsScore = Math.max(0, Math.min(100, firstTenSecondsScore));

  return {
    firstTenSecondsScore,
    overallRetentionScore,
    pacingRepetitionWarnings,
    weakOpeningsDetected,
  };
}
