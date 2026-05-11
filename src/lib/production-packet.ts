import {
  contentFormatLabels,
  publishingPlatformLabels,
} from "@/lib/content-pipeline";
import type { TaskLabel } from "@/lib/task-labels";

export const PRODUCTION_PACKET_DRAFT_TITLE = "Production Packet";
export const PRODUCTION_PACKET_FEATURE_ID = "creator_run_production_packet";
export const CREATOR_RUN_TAG = "creator-run-v0.1";
export const CREATOR_RUN_CONTENT_TAG_PREFIX = "content-item:";

export type ProductionPacketContentItem = {
  audience: string;
  coreIdea: string;
  format: string;
  id?: string;
  primaryPlatform: string;
  tags: string;
  title: string;
};

export type ProductionPacketBrief = {
  angle: string;
  cta: string;
  keywords: string;
  notes: string;
  objective: string;
  outline: string;
  promise: string;
} | null;

export type ProductionTaskDefinition = {
  description: string;
  label: TaskLabel;
  title: string;
};

export const PRODUCTION_TASK_DEFINITIONS: readonly ProductionTaskDefinition[] = [
  {
    description: "Confirm the core idea, audience, platform, format, hook, and main message.",
    label: "Planning",
    title: "Finalize concept",
  },
  {
    description: "Turn the packet script or narration section into the final spoken or on-screen script.",
    label: "Planning",
    title: "Finalize script",
  },
  {
    description: "Convert the packet music brief into a prompt or selection criteria for manual music creation.",
    label: "Assets Needed",
    title: "Prepare music prompt",
  },
  {
    description: "Create, license, or select music manually. Do not call external media providers from the app.",
    label: "Assets Needed",
    title: "Create/select music manually",
  },
  {
    description: "Use the packet image prompt section to prepare final prompts or image search criteria.",
    label: "Assets Needed",
    title: "Prepare image prompts",
  },
  {
    description: "Create, license, or select images manually. Do not run autonomous image generation from the app.",
    label: "Assets Needed",
    title: "Create/select images manually",
  },
  {
    description: "Assemble the video manually using the scene list, script, music, images, and editing checklist.",
    label: "Build",
    title: "Assemble video manually",
  },
  {
    description: "Review the finished video for clarity, pacing, audio balance, visual consistency, and platform fit.",
    label: "Validation",
    title: "Review final video",
  },
  {
    description: "Finalize the caption, hashtags, description, and publishing checklist.",
    label: "Release Prep",
    title: "Prepare caption/hashtags",
  },
  {
    description: "Publish manually on the target platform and record the URL/date in the content workflow.",
    label: "Release Prep",
    title: "Publish manually",
  },
  {
    description: "After publishing, enter a manual performance snapshot in the content metrics form.",
    label: "Validation",
    title: "Record metrics snapshot",
  },
];

const durationByFormat: Record<string, string> = {
  ARTICLE: "900-1,200 words",
  EMAIL: "400-700 words",
  LONG_VIDEO: "6-10 minutes",
  NEWSLETTER: "600-900 words",
  OTHER: "Creator-defined",
  PODCAST: "15-30 minutes",
  SHORT_VIDEO: "30-60 seconds",
  SOCIAL_POST: "1 post",
  THREAD: "6-10 posts",
};

function clean(value: string | null | undefined, fallback: string): string {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized || fallback;
}

function labelFor<T extends string>(labels: Record<T, string>, value: string): string {
  return labels[value as T] ?? value.replaceAll("_", " ").toLowerCase();
}

function cleanMultiline(value: string | null | undefined): string {
  return value
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n") ?? "";
}

function splitLines(value: string | null | undefined): string[] {
  return cleanMultiline(value)
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

function markdownList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function numberedList(items: readonly string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function tableCell(value: string): string {
  return value.replaceAll("|", "/").replace(/\s+/g, " ").trim();
}

function tagsToHashtags(tags: string, keywords: string): string {
  const values = `${tags},${keywords}`
    .split(/[,#\n]/)
    .map((tag) => tag.trim().toLowerCase().replace(/[^a-z0-9]+/g, ""))
    .filter(Boolean);
  const uniqueValues = Array.from(new Set(values)).slice(0, 8);

  if (uniqueValues.length === 0) {
    return "#creator #content";
  }

  return uniqueValues.map((tag) => `#${tag}`).join(" ");
}

function inferHook(item: ProductionPacketContentItem, brief: ProductionPacketBrief): string {
  if (brief?.angle.trim()) {
    return `Open with this angle: ${brief.angle.trim()}`;
  }

  if (brief?.promise.trim()) {
    return `Lead with the promise: ${brief.promise.trim()}`;
  }

  return `Open with the clearest transformation in the idea: ${item.coreIdea.trim()}`;
}

function inferMainMessage(
  item: ProductionPacketContentItem,
  brief: ProductionPacketBrief,
): string {
  if (brief?.promise.trim()) {
    return brief.promise.trim();
  }

  if (brief?.objective.trim()) {
    return brief.objective.trim();
  }

  return item.coreIdea.trim();
}

function sceneSeeds(item: ProductionPacketContentItem, brief: ProductionPacketBrief): string[] {
  const outlineLines = splitLines(brief?.outline);

  if (outlineLines.length > 0) {
    return outlineLines.slice(0, 6);
  }

  return [
    "Hook and visual premise",
    "Problem or opportunity",
    "Core idea explanation",
    "Practical proof or example",
    "Outcome and next action",
  ];
}

function buildScriptSection(
  item: ProductionPacketContentItem,
  brief: ProductionPacketBrief,
): string {
  const hook = inferHook(item, brief);
  const mainMessage = inferMainMessage(item, brief);
  const cta = clean(brief?.cta, "Ask the viewer to take the next manual step.");
  const outline = sceneSeeds(item, brief);

  return [
    `Opening: ${hook}`,
    `Main message: ${mainMessage}`,
    "Body beats:",
    numberedList(outline.map((line) => `${line} - explain with one concrete example.`)),
    `Close: ${cta}`,
  ].join("\n\n");
}

function buildImagePrompts(
  item: ProductionPacketContentItem,
  brief: ProductionPacketBrief,
): string[] {
  const audience = clean(item.audience, "the target audience");
  const style = clean(brief?.angle, "clear creator education style");
  const platform = labelFor(publishingPlatformLabels, item.primaryPlatform);

  return sceneSeeds(item, brief).slice(0, 5).map(
    (scene, index) =>
      `${index + 1}. ${scene}: ${item.title}, for ${audience}, ${style}, ${platform} composition, readable subject, clean background, no logos unless supplied manually.`,
  );
}

function buildSceneTable(
  item: ProductionPacketContentItem,
  brief: ProductionPacketBrief,
): string {
  const scenes = sceneSeeds(item, brief);

  return [
    "| Scene | Purpose | Visual Direction | Audio / Narration |",
    "| --- | --- | --- | --- |",
    ...scenes.map((scene, index) => {
      const purpose =
        index === 0
          ? "Hook attention"
          : index === scenes.length - 1
            ? "Drive the next action"
            : "Develop the main message";

      return `| ${index + 1} | ${tableCell(purpose)} | ${tableCell(scene)} | ${tableCell(`Narrate how this supports ${item.title}.`)} |`;
    }),
  ].join("\n");
}

function productionTaskLines(): string {
  return PRODUCTION_TASK_DEFINITIONS.map((task) => `- ${task.title}`).join("\n");
}

export function buildProductionPacket({
  brief,
  item,
}: {
  brief?: ProductionPacketBrief;
  item: ProductionPacketContentItem;
}): string {
  const normalizedBrief = brief ?? null;
  const format = labelFor(contentFormatLabels, item.format);
  const platform = labelFor(publishingPlatformLabels, item.primaryPlatform);
  const duration = durationByFormat[item.format] ?? durationByFormat.OTHER;
  const audience = clean(item.audience, "Unspecified audience");
  const hook = inferHook(item, normalizedBrief);
  const mainMessage = inferMainMessage(item, normalizedBrief);
  const caption = `${hook} ${clean(normalizedBrief?.cta, "Save this and use it for your next creator run.")}`;
  const hashtags = tagsToHashtags(item.tags, normalizedBrief?.keywords ?? "");

  return [
    `# Production Packet: ${item.title}`,
    "",
    "## Snapshot",
    markdownList([
      `Core idea: ${clean(item.coreIdea, "Not specified")}`,
      `Audience: ${audience}`,
      `Platform: ${platform}`,
      `Format: ${format}`,
      `Duration: ${duration}`,
      `Hook: ${hook}`,
      `Main message: ${mainMessage}`,
    ]),
    "",
    "## Script Or Narration",
    buildScriptSection(item, normalizedBrief),
    "",
    "## Music Brief",
    markdownList([
      `Purpose: support the hook and keep momentum through ${duration}.`,
      `Mood: ${clean(normalizedBrief?.angle, "focused, clear, energetic, creator-led")}.`,
      "Structure: short intro, steady middle bed, clean ending for CTA.",
      "Manual creation note: create, license, or select music outside the app.",
      `Prompt starter: instrumental bed for ${item.title}; ${audience}; ${platform}; clear pacing; no vocals unless manually approved.`,
    ]),
    "",
    "## Image Prompts",
    numberedList(buildImagePrompts(item, normalizedBrief)),
    "",
    "## Scene List",
    buildSceneTable(item, normalizedBrief),
    "",
    "## Video Assembly Plan",
    markdownList([
      `Build for ${platform} as ${format}.`,
      `Target length: ${duration}.`,
      "Place the hook in the first visible moment.",
      "Match each scene to one image, clip, screen capture, or manual visual asset.",
      "Use the music bed as pacing support; keep narration intelligible.",
      "Keep all asset creation and selection manual for this build.",
    ]),
    "",
    "## Editing Checklist",
    markdownList([
      "Script matches the brief and main message.",
      "Opening frame makes the topic obvious without extra explanation.",
      "Music is licensed or created manually and mixed below narration.",
      "Images or clips are selected manually and match the scene list.",
      "Captions/subtitles are readable on mobile.",
      "CTA appears in the final section.",
      "Final export is reviewed before publishing.",
    ]),
    "",
    "## Caption",
    caption,
    "",
    "## Hashtags",
    hashtags,
    "",
    "## Publishing Checklist",
    markdownList([
      "Confirm platform, title, caption, hashtags, and thumbnail/cover.",
      "Run one final playback check.",
      "Publish manually on the target platform.",
      "Record the published URL and date in Creation Station.",
    ]),
    "",
    "## Monetization Note",
    clean(
      normalizedBrief?.notes,
      "Add offer, sponsor, product, service, or revenue notes manually only if they apply.",
    ),
    "",
    "## Metrics Reminder",
    "After publishing, manually record views, likes, comments, shares, saves, clicks, and notes as a content metric snapshot.",
    "",
    "## Production Tasks",
    productionTaskLines(),
  ].join("\n");
}

export function productionPacketFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${slug || "production-packet"}-production-packet.md`;
}
