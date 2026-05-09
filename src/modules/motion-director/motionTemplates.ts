import type { ScenePlanScene } from "@/modules/scene-planner";
import type { MotionTemplate, MotionTemplateKey } from "@/modules/motion-director/types";

export const MOTION_TEMPLATES: Record<MotionTemplateKey, MotionTemplate> = {
  atmospheric: {
    cameraMovement: "parallax glide with restrained depth drift",
    environmentalMovement: "ambient haze and slow particulate drift",
    key: "atmospheric",
    subjectMovement: "measured posture adjustment with minimal gesture",
  },
  battle: {
    cameraMovement: "aggressive lateral strafe with impact recoil",
    environmentalMovement: "debris streaks and pressure-wave particles",
    key: "battle",
    subjectMovement: "defensive bracing and sharp directional recoil",
  },
  dreamlike: {
    cameraMovement: "floating crane drift with soft orbital sway",
    environmentalMovement: "ethereal bloom pulses and drifting dust",
    key: "dreamlike",
    subjectMovement: "weightless reach with slowed secondary motion",
  },
  emotional: {
    cameraMovement: "slow dolly in with intimate framing pressure",
    environmentalMovement: "soft ambient particles and subtle fabric lift",
    key: "emotional",
    subjectMovement: "micro-expression focus with subtle cloth movement",
  },
  "high-energy": {
    cameraMovement: "fast push with controlled shake burst",
    environmentalMovement: "explosive particles and strobing atmosphere",
    key: "high-energy",
    subjectMovement: "decisive full-body accents with impact hits",
  },
  performance: {
    cameraMovement: "stage-tracking arc with hero spotlight framing",
    environmentalMovement: "light sweeps and audience shimmer motion",
    key: "performance",
    subjectMovement: "performance gesture accents synced to phrasing",
  },
  reveal: {
    cameraMovement: "orbit reveal with elegant scale expansion",
    environmentalMovement: "parallax environment peel and cinematic bloom",
    key: "reveal",
    subjectMovement: "measured silhouette turn with confidence rise",
  },
};

function hasSignal(source: string, terms: string[]): boolean {
  return terms.some((term) => source.includes(term));
}

export function selectMotionTemplate(scene: ScenePlanScene): MotionTemplateKey {
  const signal = `${scene.lyricSegment} ${scene.emotionalTone} ${scene.visualDescription} ${scene.cameraDirection}`.toLowerCase();

  if (hasSignal(signal, ["reveal", "emerge", "unveil", "silhouette", "orbit"])) {
    return "reveal";
  }

  if (scene.generationType === "peak" || scene.generationType === "chorus" || hasSignal(signal, ["drop", "impact", "burst", "explosion", "surge", "slam", "rush"])) {
    return "high-energy";
  }

  if (hasSignal(signal, ["heart", "tears", "alone", "ache", "grief", "love", "soft", "quiet", "broken", "tender"])) {
    return "emotional";
  }

  if (hasSignal(signal, ["dream", "float", "ethereal", "memory", "ghost", "sleep", "heaven"])) {
    return "dreamlike";
  }

  if (hasSignal(signal, ["battle", "fight", "clash", "war", "attack", "charge"])) {
    return "battle";
  }

  if (hasSignal(signal, ["stage", "performance", "spotlight", "crowd", "microphone", "singer", "performer"])) {
    return "performance";
  }

  return "atmospheric";
}

export function getMotionTemplate(key: MotionTemplateKey): MotionTemplate {
  return MOTION_TEMPLATES[key];
}