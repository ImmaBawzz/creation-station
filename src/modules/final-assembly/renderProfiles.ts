import type { FinalAssemblyRenderProfile } from "@/modules/final-assembly/types";

export const FINAL_ASSEMBLY_RENDER_PROFILES: FinalAssemblyRenderProfile[] = [
  {
    height: 1080,
    id: "youtube-16-9",
    label: "YouTube 16:9",
    lyricOnly: false,
    subtitleMode: "karaoke",
    width: 1920,
  },
  {
    height: 1920,
    id: "tiktok-9-16",
    label: "TikTok 9:16",
    lyricOnly: false,
    subtitleMode: "lyric-highlight",
    width: 1080,
  },
  {
    height: 1920,
    id: "instagram-reels",
    label: "Instagram Reels",
    lyricOnly: false,
    subtitleMode: "cinematic",
    width: 1080,
  },
  {
    height: 1080,
    id: "lyric-only",
    label: "Lyric Only",
    lyricOnly: true,
    subtitleMode: "lyric-highlight",
    width: 1920,
  },
  {
    clipDurationLimit: 30,
    height: 1080,
    id: "teaser-trailer",
    label: "Teaser Trailer",
    lyricOnly: false,
    subtitleMode: "cinematic",
    width: 1920,
  },
];

export function getFinalAssemblyRenderProfiles() {
  return FINAL_ASSEMBLY_RENDER_PROFILES;
}