import type { VideoProviderId } from "@/modules/video-generation/governance/types";

export const PROVIDER_FALLBACK_MATRIX: Record<VideoProviderId, VideoProviderId[]> = {
  kling: ["runway", "local-mock"],
  "local-mock": [],
  ltx: ["wan", "local-mock"],
  pika: ["wan", "local-mock"],
  runway: ["kling", "local-mock"],
  wan: ["ltx", "local-mock"],
};

export function getFallbackProviders(providerId: VideoProviderId): VideoProviderId[] {
  return PROVIDER_FALLBACK_MATRIX[providerId] ?? [];
}