import type { SceneMotionPlanItem } from "@/modules/motion-director/types";
import type { TimelineSceneSequenceItem } from "@/modules/timeline-director/types";

function diversifyCameraMovement(cameraMovement: string, index: number): string {
  return index % 2 === 0
    ? `${cameraMovement}; favor counter-motion framing on exit`
    : `${cameraMovement}; bias into lens-height reset before transition`;
}

export function buildSceneSequence(
  pacingMap: Array<{ duration: number; pacingScore: number; sceneId: string; sectionKind: TimelineSceneSequenceItem["sectionKind"] }>,
  motionItems: SceneMotionPlanItem[],
): TimelineSceneSequenceItem[] {
  const motionBySceneId = new Map(motionItems.map((item) => [item.sceneId, item]));
  const sequence: TimelineSceneSequenceItem[] = [];
  let currentTime = 0;
  let lastCameraSeed = "";

  for (let index = 0; index < pacingMap.length; index += 1) {
    const pacing = pacingMap[index];
    const motion = motionBySceneId.get(pacing.sceneId);

    if (!motion) {
      continue;
    }

    let cameraMovement = motion.cameraMovement;

    if (cameraMovement === lastCameraSeed) {
      cameraMovement = diversifyCameraMovement(cameraMovement, index);
    }

    lastCameraSeed = cameraMovement;

    sequence.push({
      adjustedDuration: Number(pacing.duration.toFixed(2)),
      cameraMovement,
      climaxAssigned: false,
      endTime: Number((currentTime + pacing.duration).toFixed(2)),
      motionIntensity: motion.motionIntensity,
      originalDuration: motion.duration,
      pacingScore: pacing.pacingScore,
      sceneId: pacing.sceneId,
      sectionKind: pacing.sectionKind,
      sourceImage: motion.sourceImage,
      startTime: Number(currentTime.toFixed(2)),
      transitionStyle: motion.transitionType,
    });

    currentTime += pacing.duration;
  }

  return sequence;
}

export function balanceRuntime(
  sequence: TimelineSceneSequenceItem[],
  songDuration: number,
): {
  runtimeBalanceStrategy: "compressed-lower-priority" | "extended-strongest-scenes" | "balanced";
  sequence: TimelineSceneSequenceItem[];
  totalRuntime: number;
} {
  const totalRuntime = Number(sequence.reduce((sum, item) => sum + item.adjustedDuration, 0).toFixed(2));

  if (sequence.length === 0) {
    return {
      runtimeBalanceStrategy: "balanced",
      sequence,
      totalRuntime,
    };
  }

  if (totalRuntime > songDuration) {
    let remainingReduction = Number((totalRuntime - songDuration).toFixed(2));
    const nextSequence = [...sequence].map((item) => ({ ...item }));

    for (let index = nextSequence.length - 1; index >= 0 && remainingReduction > 0; index -= 1) {
      const item = nextSequence[index];

      if (!item || item.sectionKind === "drop" || item.sectionKind === "emotional-peak") {
        continue;
      }

      const maxReduction = Math.max(0, item.adjustedDuration - Math.max(0.75, item.originalDuration * 0.7));
      const reduction = Math.min(maxReduction, remainingReduction);

      item.adjustedDuration = Number((item.adjustedDuration - reduction).toFixed(2));
      remainingReduction = Number((remainingReduction - reduction).toFixed(2));
    }

    return {
      runtimeBalanceStrategy: "compressed-lower-priority",
      sequence: recomputeSequenceTimes(nextSequence),
      totalRuntime: Number(nextSequence.reduce((sum, item) => sum + item.adjustedDuration, 0).toFixed(2)),
    };
  }

  if (totalRuntime < songDuration) {
    const nextSequence = [...sequence].map((item) => ({ ...item }));
    let remainingExtension = Number((songDuration - totalRuntime).toFixed(2));
    const strongestScenes = nextSequence
      .filter((item) => item.sectionKind === "drop" || item.sectionKind === "emotional-peak" || item.sectionKind === "build")
      .sort((left, right) => right.pacingScore - left.pacingScore);

    for (const item of strongestScenes) {
      if (remainingExtension <= 0) {
        break;
      }

      const extension = Math.min(0.8, remainingExtension);
      item.adjustedDuration = Number((item.adjustedDuration + extension).toFixed(2));
      remainingExtension = Number((remainingExtension - extension).toFixed(2));
    }

    return {
      runtimeBalanceStrategy: "extended-strongest-scenes",
      sequence: recomputeSequenceTimes(nextSequence),
      totalRuntime: Number(nextSequence.reduce((sum, item) => sum + item.adjustedDuration, 0).toFixed(2)),
    };
  }

  return {
    runtimeBalanceStrategy: "balanced",
    sequence: recomputeSequenceTimes(sequence.map((item) => ({ ...item }))),
    totalRuntime,
  };
}

function recomputeSequenceTimes(sequence: TimelineSceneSequenceItem[]): TimelineSceneSequenceItem[] {
  let currentTime = 0;

  return sequence.map((item) => {
    const nextItem = {
      ...item,
      endTime: Number((currentTime + item.adjustedDuration).toFixed(2)),
      startTime: Number(currentTime.toFixed(2)),
    };

    currentTime += item.adjustedDuration;
    return nextItem;
  });
}
