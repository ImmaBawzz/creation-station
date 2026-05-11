import type { ScenePlanScene } from "@/modules/scene-planner";
import type { MotionTemplate } from "@/modules/motion-director/types";

type CameraPlan = {
  cameraMovement: string;
  endFrameStrategy: string;
  startFrameStrategy: string;
};

export function buildCameraPlan(scene: ScenePlanScene, template: MotionTemplate): CameraPlan {
  const direction = scene.cameraDirection.toLowerCase();
  const visual = scene.visualDescription.toLowerCase();

  const cameraMovement = direction.includes("close")
    ? `${template.cameraMovement}; preserve close-up eye-line tension`
    : direction.includes("wide")
    ? `${template.cameraMovement}; hold wide environmental geography before motion`
    : direction.includes("pan") || direction.includes("orbit")
    ? `${template.cameraMovement}; honor the authored ${scene.cameraDirection.toLowerCase()}`
    : `${template.cameraMovement}; informed by ${scene.cameraDirection.toLowerCase()}`;

  const startFrameStrategy = visual.includes("silhouette")
    ? "Anchor on the silhouette read first, then release camera motion after composition locks."
    : scene.generationType === "chorus" || scene.generationType === "peak"
    ? "Start on the clearest impact pose and preserve readable subject separation before acceleration."
    : "Begin from the strongest still-image composition and introduce motion only after the focal subject is stable.";

  const endFrameStrategy = scene.generationType === "transition" || scene.generationType === "outro"
    ? "Land on a clean hold frame that can dissolve or loop without visible snapback."
    : visual.includes("reveal") || direction.includes("orbit")
    ? "Finish on the widest confident reveal frame with enough negative space for a cinematic fade."
    : "Resolve on a readable subject pose with motion easing into a stable end frame.";

  return {
    cameraMovement,
    endFrameStrategy,
    startFrameStrategy,
  };
}