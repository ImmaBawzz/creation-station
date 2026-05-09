import type { ScenePlanScene } from "@/modules/scene-planner";
import type { MotionTemplateKey } from "@/modules/motion-director/types";

export function resolveTransitionType(
  scene: ScenePlanScene,
  nextScene: ScenePlanScene | undefined,
  templateKey: MotionTemplateKey,
): string {
  if (templateKey === "high-energy" || templateKey === "battle") {
    return "aggressive cut transition";
  }

  if (templateKey === "reveal") {
    return "cinematic fade transition";
  }

  if (templateKey === "emotional") {
    return "soft fade transition";
  }

  if (templateKey === "dreamlike") {
    return "dream dissolve transition";
  }

  if (nextScene && nextScene.generationType !== scene.generationType) {
    return "rhythmic dissolve transition";
  }

  return "atmospheric blend transition";
}