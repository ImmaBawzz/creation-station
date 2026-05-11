import type { TimelineProviderInput, VideoProviderId } from "@/modules/video-generation/governance/types";

export function deriveScenePolicySignals(scene: TimelineProviderInput) {
  const signal = `${scene.cameraMovement} ${scene.transitionStyle} ${scene.motionIntensity}`.toLowerCase();

  return {
    cameraComplexity: /orbit|whip|shake|push|drift|dolly|parallax|tracking/.test(signal) ? 0.9 : 0.45,
    environmentComplexity: /environment|particle|crowd|explosion|parallax|atmosphere/.test(signal) ? 0.82 : 0.5,
    facialImportance: scene.climaxAssigned || /portrait|close|face|emotional/.test(signal) ? 0.88 : 0.42,
    motionComplexity: scene.motionIntensity === "extreme"
      ? 1
      : scene.motionIntensity === "high"
      ? 0.84
      : scene.motionIntensity === "medium"
      ? 0.58
      : 0.32,
    realismRequirement: scene.climaxAssigned || /emotional|portrait|soft|real/.test(signal) ? 0.86 : 0.46,
    stylizationLevel: /fantasy|stylized|dream|surreal|parallax/.test(signal) ? 0.83 : 0.38,
  };
}

export function buildPolicyNotes(scene: TimelineProviderInput, providerId: VideoProviderId): string[] {
  const notes: string[] = [];

  if (scene.motionIntensity === "high" || scene.motionIntensity === "extreme") {
    notes.push("High motion scene requires strong camera and motion handling.");
  }

  if (scene.climaxAssigned) {
    notes.push("Climax scene prefers higher-quality or more stable providers.");
  }

  if (providerId === "local-mock") {
    notes.push("Local mock remains the cheap offline simulation fallback.");
  }

  return notes;
}