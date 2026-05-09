import type { ScenePlanScene } from "@/modules/scene-planner";
import type {
  LoopSuitability,
  MotionIntensityLabel,
  MotionTemplateKey,
  ProviderCompatibilityTag,
} from "@/modules/motion-director/types";

type MotionIntensityPlan = {
  loopSuitability: LoopSuitability;
  motionIntensity: MotionIntensityLabel;
  pacingScore: number;
};

export function resolveMotionIntensity(scene: ScenePlanScene, templateKey: MotionTemplateKey): MotionIntensityPlan {
  let pacingScore = 5;

  if (templateKey === "high-energy") {
    pacingScore = 9;
  } else if (templateKey === "reveal" || templateKey === "performance") {
    pacingScore = 7;
  } else if (templateKey === "atmospheric" || templateKey === "dreamlike") {
    pacingScore = 4;
  } else if (templateKey === "emotional") {
    pacingScore = 3;
  }

  if (scene.generationType === "peak") {
    pacingScore = Math.max(pacingScore, 10);
  }

  const motionIntensity: MotionIntensityLabel = pacingScore >= 10
    ? "extreme"
    : pacingScore >= 7
    ? "high"
    : pacingScore >= 4
    ? "medium"
    : "low";

  const loopSuitability: LoopSuitability = pacingScore >= 8
    ? "low"
    : scene.generationType === "transition" || templateKey === "atmospheric" || templateKey === "dreamlike"
    ? "high"
    : "medium";

  return {
    loopSuitability,
    motionIntensity,
    pacingScore,
  };
}

export function buildProviderCompatibilityTags(
  templateKey: MotionTemplateKey,
  intensity: MotionIntensityPlan,
): ProviderCompatibilityTag[] {
  const tags = new Set<ProviderCompatibilityTag>(["universal-static-anchor"]);

  if (intensity.motionIntensity === "low" || intensity.motionIntensity === "medium") {
    tags.add("wan-safe-drift");
    tags.add("ltx-loop-safe");
  }

  if (templateKey === "reveal" || templateKey === "atmospheric" || templateKey === "dreamlike") {
    tags.add("ltx-parallax-ready");
  }

  if (templateKey === "emotional") {
    tags.add("kling-emotive-closeup");
  }

  if (templateKey === "performance" || templateKey === "high-energy" || templateKey === "battle") {
    tags.add("kling-performance-ready");
  }

  if (intensity.motionIntensity === "high" || intensity.motionIntensity === "extreme") {
    tags.add("wan-impact-cut");
  }

  return [...tags];
}