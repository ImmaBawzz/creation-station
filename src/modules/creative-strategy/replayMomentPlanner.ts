import type { ScenePlan } from "@/modules/scene-planner";
import type { TimelinePlan } from "@/modules/timeline-director/types";
import type { ReplayMoment } from "@/modules/creative-strategy/types";

/**
 * Identifies moments in the timeline that have high viral potential and replay value.
 * Recommends inserting visually arresting or complex moments that reward repeated viewing.
 */
export function planReplayMoments(scenePlan: ScenePlan, timelinePlan: TimelinePlan): ReplayMoment[] {
  const replayMoments: ReplayMoment[] = [];

  // Look for fast cuts, high motion intensity, or specific emotional tones
  for (const item of timelinePlan.sceneSequencing) {
    let viralScore = 50;
    const reasons: string[] = [];

    // Fast cuts (< 1.5s) are highly replayable
    if (item.adjustedDuration < 1.5) {
      viralScore += 20;
      reasons.push("Rapid cut creates visual intrigue.");
    }

    // High motion intensity
    if (item.motionIntensity === "extreme" || item.motionIntensity === "high") {
      viralScore += 15;
      reasons.push("High motion intensity draws the eye.");
    }

    const planScene = scenePlan.scenes.find(s => s.id === item.sceneId);
    if (planScene) {
      // Chorus or peak generation types
      if (planScene.generationType === "chorus" || planScene.generationType === "peak") {
        viralScore += 15;
        reasons.push(`${planScene.generationType} section inherently drives engagement.`);
      }

      // Strong emotive or intense tones
      if (planScene.emotionalTone === "intense" || planScene.emotionalTone === "anthemic") {
        viralScore += 10;
        reasons.push("Strong emotional tone encourages sharing.");
      }
    }

    // If score is high enough, flag as a replay moment
    if (viralScore >= 75) {
      replayMoments.push({
        description: `Optimize scene ${item.sceneId} with high-density visual details or a hidden element to reward rewatching.`,
        endTime: item.endTime,
        reason: reasons.join(" "),
        sceneId: item.sceneId,
        startTime: item.startTime,
        viralPotentialScore: Math.min(100, viralScore),
      });
    }
  }

  return replayMoments.sort((a, b) => b.viralPotentialScore - a.viralPotentialScore).slice(0, 3); // Top 3
}
