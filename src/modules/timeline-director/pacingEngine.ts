import type { ScenePlanScene } from "@/modules/scene-planner";
import type { TimelinePacingEntry, TimelineSectionKind } from "@/modules/timeline-director/types";

type PacingSeed = {
  duration: number;
  pacingScore: number;
  sceneId: string;
  sectionKind: TimelineSectionKind;
};

function detectSectionKind(scene: ScenePlanScene): TimelineSectionKind {
  const signal = `${scene.lyricSegment} ${scene.emotionalTone} ${scene.visualDescription}`.toLowerCase();

  if (scene.generationType === "peak" || scene.generationType === "chorus" || /drop|burst|impact|surge|explode/.test(signal)) {
    return "drop";
  }

  if (/heart|tear|ache|broken|love|grief|tender|alone/.test(signal)) {
    return "emotional-peak";
  }

  if (scene.generationType === "transition" || scene.generationType === "outro") {
    return "cooldown";
  }

  if (scene.generationType === "intro" || /build|rise|lift|anticipat/.test(signal)) {
    return "build";
  }

  return "slow";
}

function resolveBasePacingScore(sectionKind: TimelineSectionKind): number {
  switch (sectionKind) {
    case "drop":
      return 10;
    case "build":
      return 7;
    case "emotional-peak":
      return 8;
    case "cooldown":
      return 3;
    default:
      return 4;
  }
}

export function buildPacingSeeds(scenes: ScenePlanScene[]): PacingSeed[] {
  return scenes.map((scene) => {
    const sectionKind = detectSectionKind(scene);

    return {
      duration: Number((scene.endTime - scene.startTime).toFixed(2)),
      pacingScore: resolveBasePacingScore(sectionKind),
      sceneId: scene.id,
      sectionKind,
    };
  });
}

export function buildPacingMap(seeds: PacingSeed[]): TimelinePacingEntry[] {
  let currentTime = 0;

  return seeds.map((seed) => {
    const entry: TimelinePacingEntry = {
      duration: Number(seed.duration.toFixed(2)),
      endTime: Number((currentTime + seed.duration).toFixed(2)),
      pacingScore: seed.pacingScore,
      sceneId: seed.sceneId,
      sectionKind: seed.sectionKind,
      startTime: Number(currentTime.toFixed(2)),
    };

    currentTime += seed.duration;
    return entry;
  });
}

export { detectSectionKind };