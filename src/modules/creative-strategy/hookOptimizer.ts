import type { ScenePlan } from "@/modules/scene-planner";
import type { TimelinePlan } from "@/modules/timeline-director/types";
import type { HookOptimization } from "@/modules/creative-strategy/types";

/**
 * Optimizes the hook (first 3-10 seconds) to maximize viewer retention.
 * Provides concrete recommendations for visual or structural changes.
 */
export function optimizeHook(scenePlan: ScenePlan, timelinePlan: TimelinePlan): HookOptimization[] {
  const optimizations: HookOptimization[] = [];
  
  // Find scenes in the first 10 seconds
  const hookScenes = timelinePlan.sceneSequencing.filter(s => s.startTime < 10);
  
  if (hookScenes.length === 0) return optimizations;

  // Optimize the very first scene (First 3 seconds are critical)
  const firstScene = hookScenes[0];
  const planScene = scenePlan.scenes.find(s => s.id === firstScene.sceneId);
  
  if (planScene) {
    let improvedDescription = "";
    let reason = "";

    if (planScene.generationType === "intro" && firstScene.originalDuration > 3) {
      improvedDescription = "Introduce a strong central subject immediately or use a rapid zoom/push-in camera movement.";
      reason = "Slow, empty intros lose viewers in the first 3 seconds.";
    } else if (planScene.emotionalTone === "steady" || planScene.emotionalTone === "reflective") {
      improvedDescription = "Add a striking visual contrast, unexpected element, or text overlay to create an immediate question.";
      reason = "Steady or reflective openings lack the pattern interrupt needed to stop scrolling.";
    }

    if (improvedDescription) {
      optimizations.push({
        improvedHookDescription: improvedDescription,
        originalSceneId: firstScene.sceneId,
        reason,
        targetAudienceSegment: "Short-form scrollers (TikTok/Shorts)",
        timeWindow: [firstScene.startTime, Math.min(firstScene.endTime, 3)],
      });
    }
  }

  // Optimize the transition within the hook window (e.g. at 3-5 seconds)
  if (hookScenes.length > 1) {
    const secondScene = hookScenes[1];
    if (secondScene.startTime >= 3 && secondScene.startTime <= 6) {
      optimizations.push({
        improvedHookDescription: "Ensure the cut to this scene represents a significant visual shift (change in scale, color, or subject).",
        originalSceneId: secondScene.sceneId,
        reason: "A strong visual change around 3-5 seconds re-engages fading attention.",
        targetAudienceSegment: "General audience",
        timeWindow: [secondScene.startTime, secondScene.endTime],
      });
    }
  }

  return optimizations;
}
