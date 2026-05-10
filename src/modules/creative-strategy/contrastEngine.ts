import type { ScenePlan } from "@/modules/scene-planner";
import type { TimelinePlan } from "@/modules/timeline-director/types";
import type { ContrastRecommendation } from "@/modules/creative-strategy/types";

/**
 * Creates visual contrast recommendations between adjacent scenes to prevent visual fatigue.
 */
export function generateContrastRecommendations(scenePlan: ScenePlan, timelinePlan: TimelinePlan): ContrastRecommendation[] {
  const recommendations: ContrastRecommendation[] = [];

  for (let i = 1; i < timelinePlan.sceneSequencing.length; i++) {
    const prev = timelinePlan.sceneSequencing[i - 1];
    const curr = timelinePlan.sceneSequencing[i];

    const prevPlan = scenePlan.scenes.find(s => s.id === prev.sceneId);
    const currPlan = scenePlan.scenes.find(s => s.id === curr.sceneId);

    if (!prevPlan || !currPlan) continue;

    // Transitioning into a peak/chorus
    if ((currPlan.generationType === "peak" || currPlan.generationType === "chorus") && 
        prevPlan.generationType !== "peak" && prevPlan.generationType !== "chorus") {
      
      // Recommend scale contrast
      recommendations.push({
        contrastType: "scale",
        description: "Shift from a wide establishing shot to an extreme close-up, or vice versa, to emphasize the structural change.",
        fromSceneId: prev.sceneId,
        reason: "Entering a high-energy section requires a dramatic visual shift to match the audio dynamics.",
        toSceneId: curr.sceneId,
      });
      
      // Recommend brightness/color contrast
      recommendations.push({
        contrastType: "brightness",
        description: "Introduce a sudden burst of brightness, saturation, or a distinct color palette shift.",
        fromSceneId: prev.sceneId,
        reason: "Visual impact maximizes the emotional payoff of the drop.",
        toSceneId: curr.sceneId,
      });
    }

    // Detecting potential monotony (same camera movement and intensity)
    if (prev.cameraMovement === curr.cameraMovement && prev.motionIntensity === curr.motionIntensity) {
      if (curr.originalDuration > 2) { // Only matters if they linger
        recommendations.push({
          contrastType: "motion",
          description: "Change the camera direction (e.g., if previous was panning left, pan right or push in).",
          fromSceneId: prev.sceneId,
          reason: "Back-to-back scenes with identical motion create visual fatigue.",
          toSceneId: curr.sceneId,
        });
      }
    }
  }

  // Limit to top 5 recommendations to avoid overwhelming the planner
  return recommendations.slice(0, 5);
}
