import type { TaskLabel } from "@/lib/task-labels";

export type PipelineKey = "automation" | "game" | "general" | "music" | "visual";

export type PipelineDefinition = {
  categoryAliases: string[];
  defaultTaskLabels: TaskLabel[];
  description: string;
  factoryGuidance: string[];
  key: PipelineKey;
  keywords: string[];
  label: string;
  pipelineName: string;
  recommendedSections: string[];
  releaseChecklist: string[];
};

export const PIPELINE_DEFINITIONS: Record<PipelineKey, PipelineDefinition> = {
  music: {
    categoryAliases: ["music"],
    defaultTaskLabels: ["Planning", "Build", "Release Prep"],
    description: "Song ideation, prompt generation, production tracking, and release preparation.",
    factoryGuidance: [
      "Shape the plan around song concept, lyrics or theme, prompt generation, production pass, and release preparation.",
      "Use requiredAssets for references, lyrics, cover concepts, stems, prompt packs, or production notes.",
      "Make nextActions move from ideation to prompt pack, production review, and release readiness.",
    ],
    key: "music",
    keywords: [
      "album",
      "audio",
      "beat",
      "hook",
      "lyrics",
      "melody",
      "music",
      "song",
      "suno",
      "track",
      "udio",
      "vocal",
    ],
    label: "Music",
    pipelineName: "Music pipeline",
    recommendedSections: [
      "Song concept",
      "Lyrics / theme",
      "Prompt pack",
      "Production pass",
      "Release prep",
    ],
    releaseChecklist: [
      "Song concept is clear.",
      "Prompt pack is usable.",
      "Production notes are captured.",
      "Release assets are listed.",
    ],
  },
  visual: {
    categoryAliases: ["film", "video", "visual art"],
    defaultTaskLabels: ["Assets Needed", "Build", "Validation"],
    description: "Image generation, video generation, asset tracking, and render workflows.",
    factoryGuidance: [
      "Shape the plan around image prompts, video prompts, required assets, render workflow, and review/export.",
      "Use requiredAssets for references, style frames, source media, shot lists, prompt variants, or render settings.",
      "Make nextActions move from visual direction to generation, render pass, review, and export readiness.",
    ],
    key: "visual",
    keywords: [
      "art",
      "image",
      "lighting",
      "midjourney",
      "render",
      "runway",
      "shot",
      "storyboard",
      "thumbnail",
      "video",
      "visual",
    ],
    label: "Visual",
    pipelineName: "Visual engine",
    recommendedSections: [
      "Image prompt",
      "Video prompt",
      "Required assets",
      "Render workflow",
      "Review / export",
    ],
    releaseChecklist: [
      "Visual direction is clear.",
      "Required assets are listed.",
      "Render workflow is testable.",
      "Export target is defined.",
    ],
  },
  game: {
    categoryAliases: ["games"],
    defaultTaskLabels: ["Planning", "Build", "Validation"],
    description: "UEFN and Unreal workflows, design docs, implementation tracking, and testing.",
    factoryGuidance: [
      "Shape the plan around design brief, UEFN or Unreal setup, implementation tasks, testing pass, and release notes.",
      "Use requiredAssets for maps, mechanics, references, devices, blueprints, test cases, or design documents.",
      "Make nextActions move from design doc to implementation, playtest, fixes, and release notes.",
    ],
    key: "game",
    keywords: [
      "fortnite",
      "game",
      "level",
      "mechanic",
      "npc",
      "player",
      "quest",
      "survival",
      "uefn",
      "unreal",
    ],
    label: "Game",
    pipelineName: "UEFN pipeline",
    recommendedSections: [
      "Design brief",
      "UEFN / Unreal setup",
      "Implementation",
      "Testing pass",
      "Release notes",
    ],
    releaseChecklist: [
      "Design doc is clear.",
      "Implementation tasks are scoped.",
      "Test pass is defined.",
      "Release notes are captured.",
    ],
  },
  automation: {
    categoryAliases: ["ai systems", "knowledge", "product ideas"],
    defaultTaskLabels: ["Planning", "Build", "Validation"],
    description:
      "Local scripts, API-backed automations, infrastructure projects, and AI tooling tracked as normal project work.",
    factoryGuidance: [
      "First identify the automation subtype: local automation, API automation, infrastructure automation, or AI tooling automation.",
      "For local automation, prefer files, folders, CLI commands, fixtures, and repeatable local validation. Do not assume credentials or cloud services.",
      "For API automation, list integration boundaries and placeholder credential needs only when the idea explicitly mentions an external API.",
      "For infrastructure automation, separate provisioning notes, operational risks, rollback checks, and local dry-run validation.",
      "For AI tooling automation, track prompts, eval fixtures, input/output contracts, and human review checkpoints without adding agents or runners.",
      "Use requiredAssets for scripts, prompts, config files, docs, sample inputs, test fixtures, or explicitly named API credentials.",
      "Make nextActions move from subtype and scope to implementation, validation, documentation, and handoff readiness.",
    ],
    key: "automation",
    keywords: [
      "agent",
      "api",
      "automation",
      "cli",
      "cloud",
      "dashboard",
      "database",
      "generator",
      "infrastructure",
      "local",
      "operating system",
      "pipeline",
      "process",
      "prompt",
      "script",
      "system",
      "tool",
      "workflow",
    ],
    label: "Automation",
    pipelineName: "Automation pipeline",
    recommendedSections: [
      "Tool goal",
      "Inputs / outputs",
      "Implementation",
      "Validation",
      "Infrastructure notes",
    ],
    releaseChecklist: [
      "Inputs and outputs are clear.",
      "Implementation path is scoped.",
      "Validation is defined.",
      "Operational notes are captured.",
    ],
  },
  general: {
    categoryAliases: [],
    defaultTaskLabels: ["Planning", "Build", "Validation"],
    description: "General planning for ideas that do not clearly match a modular pipeline.",
    factoryGuidance: [
      "Shape the plan around a clear concept, required assets, risks, and practical next actions.",
      "Keep the first version small enough to approve into tasks.",
    ],
    key: "general",
    keywords: [],
    label: "General",
    pipelineName: "General planning",
    recommendedSections: ["Concept", "Assets", "Risks", "Next actions"],
    releaseChecklist: [
      "Concept is clear.",
      "Required assets are listed.",
      "Next actions are practical.",
    ],
  },
};

export const PIPELINE_KEYS = ["music", "visual", "game", "automation", "general"] as const;

export const PIPELINE_FILTERS = ["ALL", ...PIPELINE_KEYS] as const;

export type PipelineFilter = (typeof PIPELINE_FILTERS)[number];

export function pipelineDefinitionForKey(key: PipelineKey): PipelineDefinition {
  return PIPELINE_DEFINITIONS[key];
}
