import type { FinalAssemblyScene, FinalAssemblyTransition } from "@/modules/final-assembly/types";

export function normalizeTransitionStyle(input: string): FinalAssemblyTransition {
  const signal = input.toLowerCase();

  if (/beat|sync|rhythm/.test(signal)) {
    return "beat-synced";
  }

  if (/flash/.test(signal)) {
    return "flash-cut";
  }

  if (/dissolve|atmospheric|dream/.test(signal)) {
    return "atmospheric-dissolve";
  }

  if (/fade|soft/.test(signal)) {
    return "cinematic-fade";
  }

  return "hard-cut";
}

export function buildClipFilter(scene: FinalAssemblyScene): string | null {
  const fadeStart = Math.max(0, scene.correctedDuration - 0.35).toFixed(2);

  switch (scene.transition) {
    case "cinematic-fade":
      return `fade=t=in:st=0:d=0.25,fade=t=out:st=${fadeStart}:d=0.35`;
    case "flash-cut":
      return `eq=brightness=0.15:contrast=1.18,fade=t=in:st=0:d=0.06`;
    case "beat-synced":
      return `fade=t=in:st=0:d=0.08,fade=t=out:st=${Math.max(0, scene.correctedDuration - 0.08).toFixed(2)}:d=0.08`;
    case "atmospheric-dissolve":
      return `fade=t=in:st=0:d=0.35,fade=t=out:st=${fadeStart}:d=0.35`;
    case "hard-cut":
    default:
      return null;
  }
}