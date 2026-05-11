import type { ScenePlan } from "@/modules/scene-planner";
import type { TimelinePlan } from "@/modules/timeline-director/types";
import type { EmotionalPeakPlan } from "@/modules/creative-strategy/types";

/**
 * Plans emotional peaks by analyzing climax mappings and high-priority scenes.
 * Recommends visual tones to maximize the impact of the buildup and drop.
 */
export function planEmotionalPeaks(scenePlan: ScenePlan, timelinePlan: TimelinePlan): EmotionalPeakPlan[] {
  const peaks: EmotionalPeakPlan[] = [];

  // Use climax map from timeline director
  for (const climax of timelinePlan.climaxMap) {
    const sceneItem = timelinePlan.sceneSequencing.find(s => s.sceneId === climax.sceneId);
    if (!sceneItem) continue;

    // Find the buildup (scenes right before the climax)
    const buildupScenes = timelinePlan.sceneSequencing.filter(
      s => s.endTime <= sceneItem.startTime && s.endTime >= sceneItem.startTime - 5
    );
    
    const buildupStartTime = buildupScenes.length > 0 ? buildupScenes[0].startTime : sceneItem.startTime - 2;

    // Find original scene from scene plan for visual description context
    const planScene = scenePlan.scenes.find(s => s.id === climax.sceneId);
    let recommendedVisualTone = planScene?.emotionalTone ?? "intense";
    
    // Provide strategic visual tone recommendations based on climax strength
    if (climax.strength >= 80) {
      recommendedVisualTone = "Explosive, high-contrast, kinetic energy";
    } else if (climax.strength >= 60) {
      recommendedVisualTone = "Sweeping, anthemic, elevated emotional scale";
    }

    peaks.push({
      buildupStartTime,
      intensity: climax.strength,
      peakEndTime: sceneItem.endTime,
      peakStartTime: sceneItem.startTime,
      recommendedVisualTone,
      relatedSceneIds: [sceneItem.sceneId, ...buildupScenes.map(s => s.sceneId)],
    });
  }

  // If no climax map, infer from scene plan generationType === "peak"
  if (peaks.length === 0) {
    const peakScenes = scenePlan.scenes.filter(s => s.generationType === "peak");
    for (const peak of peakScenes) {
      peaks.push({
        buildupStartTime: Math.max(0, peak.startTime - 3),
        intensity: 85, // Default high intensity for inferred peaks
        peakEndTime: peak.endTime,
        peakStartTime: peak.startTime,
        recommendedVisualTone: "High intensity, climactic visuals",
        relatedSceneIds: [peak.id],
      });
    }
  }

  return peaks.sort((a, b) => b.intensity - a.intensity);
}
