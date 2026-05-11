import type { ScenePlanScene } from "@/modules/scene-planner";
import type { TimelineClimaxEntry, TimelineSceneSequenceItem } from "@/modules/timeline-director/types";

function scoreClimax(scene: ScenePlanScene, sequenceItem: TimelineSceneSequenceItem): number {
  let score = sequenceItem.pacingScore;
  const signal = `${scene.lyricSegment} ${scene.emotionalTone} ${scene.visualDescription}`.toLowerCase();

  if (scene.generationType === "peak" || scene.generationType === "chorus") {
    score += 4;
  }

  if (/drop|impact|burst|surge|heart|tears|broken|love/.test(signal)) {
    score += 3;
  }

  if (scene.priority === "high") {
    score += 1;
  }

  return score;
}

export function assignClimaxes(
  scenes: ScenePlanScene[],
  sequence: TimelineSceneSequenceItem[],
): {
  climaxMap: TimelineClimaxEntry[];
  sequence: TimelineSceneSequenceItem[];
} {
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const scored = sequence
    .map((item) => {
      const scene = sceneById.get(item.sceneId);

      return scene
        ? {
            item,
            reason: item.sectionKind === "drop"
              ? "chorus/drop peak"
              : item.sectionKind === "emotional-peak"
              ? "emotional lyric peak"
              : "strong pacing anchor",
            strength: scoreClimax(scene, item),
          }
        : null;
    })
    .filter((entry): entry is { item: TimelineSceneSequenceItem; reason: string; strength: number } => entry !== null)
    .sort((left, right) => right.strength - left.strength)
    .slice(0, Math.min(3, sequence.length));

  const climaxIds = new Set(scored.map((entry) => entry.item.sceneId));

  return {
    climaxMap: scored.map((entry) => ({
      reason: entry.reason,
      sceneId: entry.item.sceneId,
      strength: entry.strength,
    })),
    sequence: sequence.map((item) => ({
      ...item,
      climaxAssigned: climaxIds.has(item.sceneId),
    })),
  };
}