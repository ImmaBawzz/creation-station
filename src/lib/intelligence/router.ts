import {
  PIPELINE_DEFINITIONS,
  PIPELINE_KEYS,
  pipelineDefinitionForKey,
  type PipelineKey,
} from "@/lib/pipelines";

export type IdeaRoute = {
  confidence: "high" | "low" | "medium";
  id: PipelineKey;
  label: string;
  pipeline: string;
  reasons: string[];
};

export type IntelligenceIdea = {
  category: string;
  id: string;
  priority?: string;
  rawText: string;
  status: string;
  tags: string;
  title: string;
  updatedAt?: Date | string;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

function confidenceForScore(score: number): IdeaRoute["confidence"] {
  if (score >= 5) {
    return "high";
  }

  if (score >= 2) {
    return "medium";
  }

  return "low";
}

export function detectIdeaRoute(idea: {
  category: string;
  rawText: string;
  tags: string;
  title: string;
}): IdeaRoute {
  const category = normalize(idea.category);
  const tags = normalize(idea.tags);
  const title = normalize(idea.title);
  const body = normalize(idea.rawText);
  const searchableText = `${title} ${body} ${tags}`;

  const scoredRoutes = PIPELINE_KEYS.filter((key) => key !== "general").map((key) => {
    const pipeline = PIPELINE_DEFINITIONS[key];
    let score = 0;
    const reasons: string[] = [];

    if (pipeline.categoryAliases.includes(category)) {
      score += 3;
      reasons.push(`category: ${idea.category}`);
    }

    for (const keyword of pipeline.keywords) {
      if (tags.includes(keyword)) {
        score += 2;
        reasons.push(`tag: ${keyword}`);
      } else if (title.includes(keyword)) {
        score += 2;
        reasons.push(`title: ${keyword}`);
      } else if (searchableText.includes(keyword)) {
        score += 1;
      }
    }

    return {
      id: pipeline.key,
      label: pipeline.label,
      pipeline: pipeline.pipelineName,
      reasons: reasons.slice(0, 2),
      score,
    };
  });

  const bestRoute = scoredRoutes.sort((a, b) => b.score - a.score)[0];

  if (!bestRoute || bestRoute.score === 0) {
    const generalPipeline = pipelineDefinitionForKey("general");

    return {
      confidence: "low",
      id: generalPipeline.key,
      label: generalPipeline.label,
      pipeline: generalPipeline.pipelineName,
      reasons: [],
    };
  }

  return {
    confidence: confidenceForScore(bestRoute.score),
    id: bestRoute.id,
    label: bestRoute.label,
    pipeline: bestRoute.pipeline,
    reasons: bestRoute.reasons,
  };
}
