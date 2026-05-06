import "server-only";

import { detectIdeaRoute } from "@/lib/intelligence";
import { pipelineDefinitionForKey } from "@/lib/pipelines";

export type FactoryPlannerIdeaInput = {
  title: string;
  rawText: string;
  category: string;
  tags: string;
  priority: string;
  potential: string;
  priorPlan?: {
    summary: string;
    concept: string;
    nextActions: string;
    revisionNotes: string;
  } | null;
  promptPresets?: {
    factory?: string;
    revision?: string;
  };
};

export type FactoryPlannerResult = {
  title: string;
  summary: string;
  concept: string;
  requiredAssets: string;
  risks: string;
  nextActions: string;
};

export function buildFactoryPrompt(idea: FactoryPlannerIdeaInput): string {
  const route = detectIdeaRoute(idea);
  const pipeline = pipelineDefinitionForKey(route.id);
  const lines = [
    "You are the Factory Planner for a creative project management app.",
    "Turn the user's raw idea into a simple, useful project plan.",
    "Return valid JSON only.",
    "Use exactly these string fields:",
    'title, summary, concept, requiredAssets, risks, nextActions',
    "For requiredAssets, risks, and nextActions, return newline-separated list items inside one string.",
    "Keep the writing clear, practical, and beginner-friendly.",
    "Do not add markdown code fences.",
    "",
    "Idea details:",
    `Title: ${idea.title}`,
    `Raw idea: ${idea.rawText}`,
    `Category: ${idea.category}`,
    `Tags: ${idea.tags || "None"}`,
    `Priority: ${idea.priority}`,
    `Potential: ${idea.potential}`,
    "",
    "Detected pipeline:",
    `${pipeline.pipelineName} (${route.confidence} confidence)`,
    pipeline.description,
    "",
    "Pipeline guidance:",
    ...pipeline.factoryGuidance,
    "",
    "Recommended plan sections to cover inside the existing JSON fields:",
    pipeline.recommendedSections.join(", "),
  ];

  if (idea.promptPresets?.factory) {
    lines.push(
      "",
      "User's saved Factory planning preference:",
      idea.promptPresets.factory,
    );
  }

  if (idea.priorPlan) {
    lines.push(
      "",
      "A previous plan was reviewed and a revision was requested.",
      "Use the feedback below to improve the new plan.",
      "Previous plan summary:",
      idea.priorPlan.summary,
      "Previous plan concept:",
      idea.priorPlan.concept,
      "Previous next actions:",
      idea.priorPlan.nextActions,
      "Revision feedback from the reviewer:",
      idea.priorPlan.revisionNotes || "No specific feedback given.",
      "",
      "Produce a meaningfully improved plan based on this feedback.",
    );

    if (idea.promptPresets?.revision) {
      lines.push(
        "",
        "User's saved revision preference:",
        idea.promptPresets.revision,
      );
    }
  }

  lines.push(
    "",
    "JSON response example:",
    JSON.stringify(
      {
        title: `Factory Plan: ${idea.title}`,
        summary: "Short overview of the best first version.",
        concept:
          "Explain the project clearly, including what it is, who it is for, and what the first version should prove.",
        requiredAssets: "Asset one\nAsset two\nAsset three",
        risks: "Risk one\nRisk two\nRisk three",
        nextActions: "Action one\nAction two\nAction three",
      },
      null,
      2,
    ),
  );

  return lines.join("\n");
}
