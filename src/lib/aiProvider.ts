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

function compactErrorText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function modelMissingMessage(model: string): string {
  return `Ollama could not find the model "${model}". Run "ollama pull ${model}" and try again.`;
}

function explainHttpFailure(
  status: number,
  errorText: string,
  model: string,
  baseUrl: string,
): string {
  const normalized = compactErrorText(errorText).toLowerCase();

  if (normalized.includes("model") && normalized.includes("not found")) {
    return modelMissingMessage(model);
  }

  if (status === 404) {
    return `Ollama did not respond from ${baseUrl}. Confirm Ollama is running and that OLLAMA_BASE_URL points to the server root.`;
  }

  if (status >= 500) {
    return `Ollama returned a server error (${status}). Restart Ollama, then try the plan again.`;
  }

  if (errorText) {
    return `Ollama rejected the plan request (${status}): ${compactErrorText(errorText)}`;
  }

  return `Ollama request failed with status ${status}. Confirm Ollama is running and the selected model is installed.`;
}

function explainPayloadError(error: string, model: string): string {
  const normalized = compactErrorText(error).toLowerCase();

  if (normalized.includes("model") && normalized.includes("not found")) {
    return modelMissingMessage(model);
  }

  return `Ollama could not finish the plan: ${compactErrorText(error)}`;
}

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
    throw new Error(
      "The AI returned text instead of the required planner JSON. Try again, and if it keeps happening switch to a model that follows JSON output reliably.",
    );
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
      `Could not reach Ollama at ${baseUrl}. Start Ollama, then confirm OLLAMA_BASE_URL in .env.local points to the server root.`,
    );
  }

  if (!response.ok) {
    const errorText = (await response.text()).trim();

    throw new Error(explainHttpFailure(response.status, errorText, model, baseUrl));
  }

  const payload = (await response.json()) as OllamaGenerateResponse;

  if (payload.error) {
    throw new Error(explainPayloadError(payload.error, model));
  }

  if (!payload.response?.trim()) {
    throw new Error("Ollama returned an empty response. Try again or change the model.");
  }

  return parseFactoryPlannerResult(payload.response);
}