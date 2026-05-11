import type { ScenePlan } from "@/modules/scene-planner";
import type { TimelinePlan } from "@/modules/timeline-director/types";
import type { PayoffEvaluation } from "@/modules/creative-strategy/types";

/**
 * Evaluates the structural payoff of the video (buildup vs. peak).
 */
export function evaluatePayoff(scenePlan: ScenePlan, timelinePlan: TimelinePlan): PayoffEvaluation {
  let buildupDuration = 0;
  let payoffDuration = 0;
  let strongestPayoffSceneId = "";
  let weakestPayoffSceneId = "";
  let maxStrength = -1;
  let minStrength = 101;

  for (const climax of timelinePlan.climaxMap) {
    if (climax.strength > maxStrength) {
      maxStrength = climax.strength;
      strongestPayoffSceneId = climax.sceneId;
    }
    if (climax.strength < minStrength) {
      minStrength = climax.strength;
      weakestPayoffSceneId = climax.sceneId;
    }
  }

  // Calculate durations
  for (const item of timelinePlan.sceneSequencing) {
    if (item.sectionKind === "build") {
      buildupDuration += item.originalDuration;
    } else if (item.sectionKind === "drop" || item.sectionKind === "emotional-peak") {
      payoffDuration += item.originalDuration;
    }
  }

  // Fallback if sectionKind is not cleanly mapped
  if (buildupDuration === 0 || payoffDuration === 0) {
    for (const item of timelinePlan.sceneSequencing) {
      const planScene = scenePlan.scenes.find(s => s.id === item.sceneId);
      if (planScene) {
        if (planScene.generationType === "intro" || planScene.generationType === "lyric") {
          buildupDuration += item.originalDuration;
        } else if (planScene.generationType === "peak" || planScene.generationType === "chorus") {
          payoffDuration += item.originalDuration;
        }
      }
    }
  }

  const buildUpToPayoffRatio = payoffDuration > 0 ? buildupDuration / payoffDuration : 0;
  
  // Ideal ratio is roughly 2:1 or 3:1 (Buildup is longer than payoff)
  // If it's too high (e.g. 10:1), payoff is too short.
  // If it's too low (e.g. 0.5:1), there's too much payoff, reducing impact.
  let satisfactionScore = 50;

  if (buildUpToPayoffRatio >= 1.5 && buildUpToPayoffRatio <= 4) {
    satisfactionScore = 100; // Perfect tension/release ratio
  } else if (buildUpToPayoffRatio > 4 && buildUpToPayoffRatio <= 7) {
    satisfactionScore = 75; // A bit too much buildup
  } else if (buildUpToPayoffRatio > 0 && buildUpToPayoffRatio < 1.5) {
    satisfactionScore = 60; // Too much payoff, exhausting
  } else {
    satisfactionScore = 30; // Highly unbalanced
  }

  // Adjust score based on climax map
  if (maxStrength >= 80) {
    satisfactionScore = Math.min(100, satisfactionScore + 10);
  }

  if (timelinePlan.sceneSequencing.length === 0) {
    satisfactionScore = 0;
    weakestPayoffSceneId = "";
    strongestPayoffSceneId = "";
  }

  // Fallbacks if empty
  if (!strongestPayoffSceneId && timelinePlan.sceneSequencing.length > 0) {
    strongestPayoffSceneId = timelinePlan.sceneSequencing[timelinePlan.sceneSequencing.length - 1].sceneId;
  }
  if (!weakestPayoffSceneId && timelinePlan.sceneSequencing.length > 0) {
    weakestPayoffSceneId = timelinePlan.sceneSequencing[0].sceneId;
  }

  return {
    buildUpToPayoffRatio: Number(buildUpToPayoffRatio.toFixed(2)),
    satisfactionScore,
    strongestPayoffSceneId,
    weakestPayoffSceneId,
  };
}
