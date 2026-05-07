export type MusicVideoWorkflowPreset = {
  description: string;
  id: string;
  label: string;
  stages: string[];
  workflow: Record<string, unknown>;
};

export const FULL_MUSIC_VIDEO_WORKFLOW_PRESET_ID = "lyric-to-release";

const fullWorkflowStages = [
  "Song brief",
  "Prompt pack",
  "Audio upload",
  "ComfyUI visual render",
  "FFmpeg merge",
  "Release package",
];

const baseWorkflow = {
  "1": {
    class_type: "CheckpointLoaderSimple",
    inputs: {
      ckpt_name: "music-video-base.safetensors",
    },
  },
  "2": {
    class_type: "CLIPTextEncode",
    inputs: {
      clip: ["1", 1],
      text: "{{visualPrompt}}",
    },
  },
  "3": {
    class_type: "EmptyLatentImage",
    inputs: {
      batch_size: 1,
      height: 768,
      width: 1360,
    },
  },
  "4": {
    class_type: "KSampler",
    inputs: {
      cfg: 7,
      latent_image: ["3", 0],
      model: ["1", 0],
      positive: ["2", 0],
      sampler_name: "euler",
      scheduler: "normal",
      seed: 42,
      steps: 24,
    },
  },
  "5": {
    class_type: "VAEDecode",
    inputs: {
      samples: ["4", 0],
      vae: ["1", 2],
    },
  },
  "6": {
    class_type: "SaveImage",
    inputs: {
      filename_prefix: "creation-station-music-video",
      images: ["5", 0],
    },
  },
};

export const MUSIC_VIDEO_WORKFLOW_PRESETS: MusicVideoWorkflowPreset[] = [
  {
    description: "Complete path from lyric or song idea through render, merge, and release package.",
    id: FULL_MUSIC_VIDEO_WORKFLOW_PRESET_ID,
    label: "Lyric To Release",
    stages: fullWorkflowStages,
    workflow: {
      ...baseWorkflow,
      "4": {
        ...(baseWorkflow["4"] as Record<string, unknown>),
        inputs: {
          cfg: 7.5,
          latent_image: ["3", 0],
          model: ["1", 0],
          positive: ["2", 0],
          sampler_name: "dpmpp_2m",
          scheduler: "karras",
          seed: 271828,
          steps: 26,
        },
      },
    },
  },
  {
    description: "Wide cinematic sequence with strong lighting and motion-ready framing.",
    id: "cinematic-performance",
    label: "Cinematic Performance",
    stages: ["Visual brief", "ComfyUI render", "FFmpeg merge", "Release package"],
    workflow: baseWorkflow,
  },
  {
    description: "Editorial color, clean subject continuity, and release-cover grade contrast.",
    id: "editorial-color",
    label: "Editorial Color",
    stages: ["Style frame", "Color render", "FFmpeg merge", "Release package"],
    workflow: {
      ...baseWorkflow,
      "4": {
        ...(baseWorkflow["4"] as Record<string, unknown>),
        inputs: {
          cfg: 8,
          latent_image: ["3", 0],
          model: ["1", 0],
          positive: ["2", 0],
          sampler_name: "dpmpp_2m",
          scheduler: "karras",
          seed: 314159,
          steps: 28,
        },
      },
    },
  },
  {
    description: "Lower step count for quick iteration before committing to a final render.",
    id: "draft-fast",
    label: "Draft Fast",
    stages: ["Draft prompt", "Fast render", "Review output", "Release package"],
    workflow: {
      ...baseWorkflow,
      "4": {
        ...(baseWorkflow["4"] as Record<string, unknown>),
        inputs: {
          cfg: 6,
          latent_image: ["3", 0],
          model: ["1", 0],
          positive: ["2", 0],
          sampler_name: "euler",
          scheduler: "normal",
          seed: 7,
          steps: 12,
        },
      },
    },
  },
];

export function getMusicVideoWorkflowPreset(
  presetId: string,
): MusicVideoWorkflowPreset | null {
  return MUSIC_VIDEO_WORKFLOW_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function hydrateWorkflowPrompt(
  workflow: Record<string, unknown>,
  visualPrompt: string,
): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(workflow).replaceAll("{{visualPrompt}}", visualPrompt),
  ) as Record<string, unknown>;
}
