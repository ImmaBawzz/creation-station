import type { ProviderProfile, TimelineProviderInput } from "@/modules/video-generation/governance/types";

export function scoreProviderCapabilities(
  provider: ProviderProfile,
  input: ReturnType<typeof import("@/modules/video-generation/governance/providerPolicies").deriveScenePolicySignals>,
  scene: TimelineProviderInput,
) {
  const durationFit = scene.adjustedDuration <= provider.maxDuration
    ? 1
    : Math.max(0, 1 - (scene.adjustedDuration - provider.maxDuration) / Math.max(provider.maxDuration, 1));

  return {
    camera: provider.cameraScore * input.cameraComplexity,
    duration: durationFit,
    environment: provider.environmentComplexitySupport * input.environmentComplexity,
    facial: provider.portraitSupport * input.facialImportance,
    motion: provider.motionScore * input.motionComplexity,
    realism: provider.realismScore * input.realismRequirement,
    stylization: (1 - Math.abs(provider.realismScore - input.stylizationLevel)) * 0.6,
  };
}