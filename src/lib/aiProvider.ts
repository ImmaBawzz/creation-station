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

export type AiProviderStatus = {
  provider: string;
  supported: boolean;
  baseUrl: string;
  model: string;
  hasModel: boolean;
  hasBaseUrl: boolean;
  environmentReady: boolean;
  message: string;
};

export type AiConnectionTestResult = {
  ok: boolean;
  message: string;
};

function shortenTestText(value: string, maxLength = 48): string {
  const compact = value.replace(/\s+/g, " ").trim();

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 3).trimEnd()}...`;
}

function buildTestFactoryPlan(
  idea: FactoryPlannerIdeaInput,
): FactoryPlannerResult {
  const title = idea.priorPlan
    ? `Revised Factory Plan: ${idea.title}`
    : `Factory Plan: ${idea.title}`;
  const revisionFocus = idea.priorPlan?.revisionNotes
    ? shortenTestText(idea.priorPlan.revisionNotes)
    : "No revision notes were provided.";
  const summary = idea.priorPlan
    ? `Revised test plan for ${idea.title}. Revision focus: ${revisionFocus}`
    : `Initial test plan for ${idea.title}.`;
  const concept = idea.priorPlan
    ? `Updated concept for ${idea.title} using revision guidance: ${revisionFocus}`
    : `Initial concept for ${idea.title} built from the submitted idea.`;
  const requiredAssets = [
    `Creative brief for ${idea.title}`,
    `Reference assets tagged ${idea.tags || "workflow"}`,
    `Approval checklist for ${idea.category}`,
  ].join("\n");
  const nextActions = idea.priorPlan
    ? [
        `Apply revision notes for ${idea.title}`,
        `Refresh concept brief for ${idea.title}`,
        `Approve revised execution checklist for ${idea.title}`,
      ].join("\n")
    : [
        `Draft creative brief for ${idea.title}`,
        `Collect reference assets for ${idea.title}`,
        `Schedule review for ${idea.title}`,
      ].join("\n");

  return {
    title,
    summary,
    concept,
    requiredAssets,
    risks: "Low risk in test provider mode.",
    nextActions,
  };
}

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

  if (provider === "test") {
    return {
      baseUrl: "test://local-provider",
      model: "deterministic-test-model",
      provider,
    };
  }

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

export function getAiProviderStatus(): AiProviderStatus {
  const provider = process.env.AI_PROVIDER ?? "ollama";

  if (provider === "test") {
    return {
      provider,
      supported: true,
      baseUrl: "test://local-provider",
      model: "deterministic-test-model",
      hasModel: true,
      hasBaseUrl: true,
      environmentReady: true,
      message: "AI Factory test provider is enabled for deterministic local runs.",
    };
  }

  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL?.trim() ?? "";
  const supported = provider === "ollama";
  const hasBaseUrl = Boolean(baseUrl.trim());
  const hasModel = Boolean(model);
  const environmentReady = supported && hasBaseUrl && hasModel;

  let message = "AI Factory is configured for local Ollama.";

  if (!supported) {
    message = `Unsupported AI provider "${provider}". Set AI_PROVIDER=ollama in .env.local.`;
  } else if (!hasModel) {
    message = "Missing OLLAMA_MODEL. Add OLLAMA_MODEL to .env.local before using the Factory Planner.";
  } else if (!hasBaseUrl) {
    message = "Missing OLLAMA_BASE_URL. Set it to the local Ollama server root.";
  }

  return {
    provider,
    supported,
    baseUrl,
    model: model || "Not set",
    hasModel,
    hasBaseUrl,
    environmentReady,
    message,
  };
}

export async function testAiProviderConnection(): Promise<AiConnectionTestResult> {
  const status = getAiProviderStatus();

  if (status.provider === "test") {
    return {
      ok: true,
      message: "Test provider is ready for deterministic local planning.",
    };
  }

  if (!status.environmentReady) {
    return {
      ok: false,
      message: status.message,
    };
  }

  try {
    const response = await fetch(`${status.baseUrl}/api/tags`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = (await response.text()).trim();

      return {
        ok: false,
        message: explainHttpFailure(
          response.status,
          errorText,
          status.model,
          status.baseUrl,
        ),
      };
    }

    const payload = (await response.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };
    const models = payload.models ?? [];
    const modelExists = models.some(
      (model) => model.name === status.model || model.model === status.model,
    );

    if (!modelExists) {
      return {
        ok: false,
        message: modelMissingMessage(status.model),
      };
    }

    return {
      ok: true,
      message: `Ollama is reachable and model "${status.model}" is installed.`,
    };
  } catch {
    return {
      ok: false,
      message: `Could not reach Ollama at ${status.baseUrl}. Start Ollama, then confirm OLLAMA_BASE_URL in .env.local points to the server root.`,
    };
  }
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
  const { baseUrl, model, provider } = getOllamaConfig();

  if (provider === "test") {
    return buildTestFactoryPlan(idea);
  }

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
