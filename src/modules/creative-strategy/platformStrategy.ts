import type { PlatformStrategy, PlatformVariant } from "@/modules/creative-strategy/types";

/**
 * Generates platform-specific optimization strategies based on total runtime and structure.
 */
export function generatePlatformStrategies(totalRuntime: number): PlatformStrategy[] {
  const strategies: PlatformStrategy[] = [];

  // TikTok / Shorts / Reels (Short-form vertical)
  if (totalRuntime < 60) {
    strategies.push({
      bestPerformingAspectRatio: "9:16",
      callToActionTiming: Math.max(0, totalRuntime - 5), // Last 5 seconds
      idealLength: 15, // Sweet spot for short form
      pacingMultiplier: 1.2, // Faster pacing
      platform: "tiktok",
      recommendedTextOverlays: ["Hook in first 3s", "Engaging captions throughout", "Strong CTA at end"],
    });
    
    strategies.push({
      bestPerformingAspectRatio: "9:16",
      callToActionTiming: Math.max(0, totalRuntime - 3), 
      idealLength: 30, 
      pacingMultiplier: 1.1,
      platform: "shorts",
      recommendedTextOverlays: ["High contrast subtitles", "Visual arrows/pointers"],
    });
  }

  // YouTube / Lyric Videos (Long-form horizontal)
  if (totalRuntime >= 60) {
    strategies.push({
      bestPerformingAspectRatio: "16:9",
      callToActionTiming: totalRuntime - 15, // Last 15 seconds for end cards
      idealLength: totalRuntime, 
      pacingMultiplier: 1.0, // Normal pacing
      platform: "youtube-longform",
      recommendedTextOverlays: ["Lower thirds", "Subtle watermark", "End screen elements"],
    });

    strategies.push({
      bestPerformingAspectRatio: "16:9",
      callToActionTiming: totalRuntime - 10,
      idealLength: totalRuntime,
      pacingMultiplier: 0.9, // Slightly slower pacing to let lyrics breathe
      platform: "lyric-video",
      recommendedTextOverlays: ["Stylized kinetic typography", "Audio visualizer elements"],
    });
  }

  return strategies;
}
