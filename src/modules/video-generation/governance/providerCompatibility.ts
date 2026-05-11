import type { ProviderProfile, TimelineProviderInput, VideoProviderId } from "@/modules/video-generation/governance/types";

export function buildProviderCompatibilityReasons(provider: ProviderProfile, scene: TimelineProviderInput): string[] {
  const reasons: string[] = [];
  const signal = `${scene.cameraMovement} ${scene.transitionStyle}`.toLowerCase();

  if ((scene.motionIntensity === "high" || scene.motionIntensity === "extreme") && provider.motionScore > 0.8) {
    reasons.push("Strong motion score fits high-energy scene movement.");
  }

  if ((scene.climaxAssigned || /emotional|portrait/.test(signal)) && provider.portraitSupport > 0.85) {
    reasons.push("High portrait strength matches emotional or facially important scenes.");
  }

  if (/parallax|fantasy|orbit/.test(signal) && provider.id === "wan") {
    reasons.push("Stylized camera and fantasy cues align with WAN strengths.");
  }

  if (provider.id === "local-mock") {
    reasons.push("Offline local mock provides the cheap simulation fallback.");
  }

  if (reasons.length === 0) {
    reasons.push("Balanced capability fit for the scene profile.");
  }

  return reasons;
}

export function filterCompatibleProviders(
  providers: ProviderProfile[],
  scene: TimelineProviderInput,
): ProviderProfile[] {
  return providers.filter((provider) => scene.adjustedDuration <= provider.maxDuration || provider.id === "local-mock");
}

export function recommendedPrimaryByExample(scene: TimelineProviderInput): VideoProviderId[] {
  const signal = `${scene.cameraMovement} ${scene.transitionStyle}`.toLowerCase();

  if (scene.climaxAssigned && scene.motionIntensity === "low") {
    return ["kling", "runway"];
  }

  if (scene.motionIntensity === "high" || scene.motionIntensity === "extreme" || /whip|shake|push/.test(signal)) {
    return ["ltx", "wan"];
  }

  if (/fantasy|dream|surreal|parallax/.test(signal)) {
    return ["wan", "pika"];
  }

  return ["runway", "local-mock"];
}