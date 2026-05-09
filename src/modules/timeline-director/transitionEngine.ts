import type { SceneMotionPlanItem } from "@/modules/motion-director/types";
import type { TimelineSceneSequenceItem, TimelineTransition } from "@/modules/timeline-director/types";

function baseTransitionStyle(fromScene: TimelineSceneSequenceItem, toScene: TimelineSceneSequenceItem): string {
  if (fromScene.sectionKind === "build" && toScene.sectionKind === "drop") {
    return "ramp smash cut";
  }

  if (fromScene.sectionKind === "drop" || toScene.sectionKind === "drop") {
    return "impact cut";
  }

  if (fromScene.sectionKind === "emotional-peak" || toScene.sectionKind === "emotional-peak") {
    return "soft dissolve";
  }

  if (fromScene.sectionKind === "cooldown" || toScene.sectionKind === "cooldown") {
    return "long fade";
  }

  return "cinematic dissolve";
}

export function buildTransitions(sequence: TimelineSceneSequenceItem[], motionItems: SceneMotionPlanItem[]): TimelineTransition[] {
  const motionBySceneId = new Map(motionItems.map((item) => [item.sceneId, item]));
  const transitions: TimelineTransition[] = [];
  let previousStyle = "";

  for (let index = 0; index < sequence.length - 1; index += 1) {
    const fromScene = sequence[index];
    const toScene = sequence[index + 1];

    if (!fromScene || !toScene) {
      continue;
    }

    const fromMotion = motionBySceneId.get(fromScene.sceneId);
    const toMotion = motionBySceneId.get(toScene.sceneId);
    let transitionStyle = baseTransitionStyle(fromScene, toScene);

    if (transitionStyle === previousStyle) {
      transitionStyle = transitionStyle.includes("fade")
        ? "rhythmic crossfade"
        : transitionStyle.includes("cut")
        ? "angle-change cut"
        : "parallax dissolve";
    }

    previousStyle = transitionStyle;

    const intensityAnchor = Math.max(fromScene.pacingScore, toScene.pacingScore);
    const fadeTiming = transitionStyle.includes("fade") || transitionStyle.includes("dissolve")
      ? Number((0.18 + (10 - intensityAnchor) * 0.04).toFixed(2))
      : 0;
    const cutTiming = transitionStyle.includes("cut")
      ? Number(Math.max(0.04, 0.16 - intensityAnchor * 0.01).toFixed(2))
      : 0;
    const overlapTiming = fromMotion?.loopSuitability === "high" || toMotion?.loopSuitability === "high"
      ? Number((0.2 + fadeTiming).toFixed(2))
      : Number((fadeTiming * 0.5).toFixed(2));

    transitions.push({
      cutTiming,
      fadeTiming,
      fromSceneId: fromScene.sceneId,
      overlapTiming,
      toSceneId: toScene.sceneId,
      transitionStyle,
    });
  }

  return transitions;
}