import "server-only";

import {
  buildFactoryPrompt,
  type FactoryPlannerIdeaInput,
  type FactoryPlannerResult,
} from "@/lib/factoryPrompt";

type OllamaGenerateResponse = {
  response?: string;
  done?: boolean;
  error?: string;
};

function getOllamaConfig() {
  const provider = process.env.AI_PROVIDER ?? "ollama";

  if (provider !== "ollama") {
    throw new Error(
      `Unsupported AI provider \"${provider}\". Set AI_PROVIDER=ollama in .env.local.`,
    );
  }

  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL?.trim();

  if (!model) {
    throw new Error(
      "Missing OLLAMA_MODEL. Add OLLAMA_MODEL to .env.local before using the Factory Planner.",
    );
  }

  return { baseUrl, model };
}

function requireText(value: unknown, field: keyof FactoryPlannerResult): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`The AI response is missing a usable ${field} value.`);
  }

  return value.trim();
}

function parseFactoryPlannerResult(payload: string): FactoryPlannerResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("The AI returned invalid JSON. Try again after checking the selected model.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("The AI returned an invalid planner result.");
  }

  const result = parsed as Record<string, unknown>;

  return {
    title: requireText(result.title, "title"),
    summary: requireText(result.summary, "summary"),
    concept: requireText(result.concept, "concept"),
    requiredAssets: requireText(result.requiredAssets, "requiredAssets"),
    risks: requireText(result.risks, "risks"),
    nextActions: requireText(result.nextActions, "nextActions"),
  };
}

export async function generateFactoryPlan(
  idea: FactoryPlannerIdeaInput,
): Promise<FactoryPlannerResult> {
  const { baseUrl, model } = getOllamaConfig();

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: buildFactoryPrompt(idea),
        stream: false,
        format: "json",
        options: {
          temperature: 0.2,
        },
      }),
    });
  } catch {
    throw new Error(
      "Could not reach Ollama. Start Ollama and confirm OLLAMA_BASE_URL is correct in .env.local.",
    );
  }

  if (!response.ok) {
    const errorText = (await response.text()).trim();

    if (response.status === 404) {
      throw new Error(
        `Ollama could not find the model \"${model}\". Run \"ollama pull ${model}\" and try again.`,
      );
    }

    throw new Error(
      errorText
        ? `Ollama request failed with status ${response.status}: ${errorText}`
        : `Ollama request failed with status ${response.status}. Confirm Ollama is running and the model is installed.`,
    );
  }

  const payload = (await response.json()) as OllamaGenerateResponse;

  if (payload.error) {
    throw new Error(`Ollama error: ${payload.error}`);
  }

  if (!payload.response?.trim()) {
    throw new Error("Ollama returned an empty response. Try again or change the model.");
  }

  return parseFactoryPlannerResult(payload.response);
}