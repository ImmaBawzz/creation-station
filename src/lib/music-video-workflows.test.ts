import { describe, expect, it } from "vitest";

import {
  FULL_MUSIC_VIDEO_WORKFLOW_PRESET_ID,
  getMusicVideoWorkflowPreset,
  hydrateWorkflowPrompt,
  MUSIC_VIDEO_WORKFLOW_PRESETS,
} from "@/lib/music-video-workflows";

describe("music video workflow presets", () => {
  it("includes one complete lyric-to-release workflow as the default preset", () => {
    const preset = MUSIC_VIDEO_WORKFLOW_PRESETS[0];

    expect(preset.id).toBe(FULL_MUSIC_VIDEO_WORKFLOW_PRESET_ID);
    expect(preset.stages).toEqual([
      "Song brief",
      "Prompt pack",
      "Audio upload",
      "ComfyUI visual render",
      "FFmpeg merge",
      "Release package",
    ]);
    expect(Object.keys(preset.workflow)).toHaveLength(6);
  });

  it("hydrates the selected visual prompt without mutating the preset template", () => {
    const preset = getMusicVideoWorkflowPreset(FULL_MUSIC_VIDEO_WORKFLOW_PRESET_ID);

    if (!preset) {
      throw new Error("Full music video workflow preset is missing.");
    }

    const hydrated = hydrateWorkflowPrompt(
      preset.workflow,
      "Neon chorus performance with rain-lit streets.",
    );

    expect(JSON.stringify(hydrated)).toContain("Neon chorus performance");
    expect(JSON.stringify(preset.workflow)).toContain("{{visualPrompt}}");
  });
});
