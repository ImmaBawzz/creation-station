import type { ProviderHealthState, ProviderProfile, VideoProviderId } from "@/modules/video-generation/governance/types";

export const PROVIDER_HEALTH: Record<VideoProviderId, ProviderHealthState> = {
  kling: { queueLoad: 0.42, status: "online" },
  "local-mock": { queueLoad: 0.08, status: "online" },
  ltx: { queueLoad: 0.61, status: "online" },
  pika: { queueLoad: 0.73, status: "overloaded" },
  runway: { queueLoad: 0.35, status: "maintenance", notes: "Simulated maintenance window for safety testing." },
  wan: { queueLoad: 0.55, status: "online" },
};

export function scoreProviderHealth(provider: ProviderProfile, state: ProviderHealthState): number {
  if (state.status === "offline" || state.status === "deprecated") {
    return 0;
  }

  if (state.status === "maintenance") {
    return 0.18;
  }

  if (state.status === "overloaded") {
    return Math.max(0.1, 0.45 - state.queueLoad * 0.2);
  }

  return Math.max(0.2, provider.queueStability * (1 - state.queueLoad * 0.4));
}