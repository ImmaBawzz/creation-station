import type { ProviderCostTier, ProviderProfile, TimelineProviderInput } from "@/modules/video-generation/governance/types";

const COST_MULTIPLIER: Record<ProviderCostTier, number> = {
  high: 1.9,
  low: 0.45,
  medium: 1.1,
  premium: 2.6,
};

export function estimateSceneCost(provider: ProviderProfile, scene: TimelineProviderInput): number {
  const base = scene.adjustedDuration * COST_MULTIPLIER[provider.costTier];
  const intensityMultiplier = scene.motionIntensity === "extreme"
    ? 1.45
    : scene.motionIntensity === "high"
    ? 1.25
    : scene.motionIntensity === "medium"
    ? 1.05
    : 0.9;

  return Number((base * intensityMultiplier).toFixed(2));
}

export function scoreCost(provider: ProviderProfile): number {
  return provider.costTier === "low"
    ? 1
    : provider.costTier === "medium"
    ? 0.72
    : provider.costTier === "high"
    ? 0.48
    : 0.32;
}