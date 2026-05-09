type FetchLike = typeof fetch;

export type ComfyPromptRuntimeStatus = "queued" | "running" | "completed" | "failed";

export type ComfyOutputRef = {
  filename: string;
  subfolder: string;
  type: string;
  url: string;
};

export class ComfyError extends Error {
  code: string;
  details: string[];
  statusCode: number;

  constructor(message: string, options?: { code?: string; details?: string[]; statusCode?: number }) {
    super(message);
    this.name = "ComfyError";
    this.code = options?.code ?? "COMFY_ERROR";
    this.details = options?.details ?? [];
    this.statusCode = options?.statusCode ?? 500;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

export function resolveComfyTimeoutMs(): number {
  const rawValue = process.env.CREATION_STATION_COMFY_TIMEOUT_MS ?? process.env.CREATION_STATION_COMFYUI_TIMEOUT_MS;
  const parsedValue = rawValue ? Number(rawValue) : NaN;

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return 600_000;
}

export function resolveComfyPollIntervalMs(): number {
  const rawValue = process.env.CREATION_STATION_COMFY_POLL_INTERVAL_MS;
  const parsedValue = rawValue ? Number(rawValue) : NaN;

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return 1_000;
}

export class ComfyClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor({
    baseUrl = process.env.COMFY_API_URL ?? process.env.CREATION_STATION_COMFYUI_URL ?? "http://127.0.0.1:8188",
    fetchImpl = fetch,
  }: {
    baseUrl?: string;
    fetchImpl?: FetchLike;
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
  }

  get url(): string {
    return this.baseUrl;
  }

  async checkAvailability(): Promise<void> {
    await this.fetchObjectInfo();
  }

  async assertRequiredNodes(requiredNodeTypes: string[]): Promise<void> {
    if (requiredNodeTypes.length === 0) {
      return;
    }

    const objectInfo = await this.fetchObjectInfo();
    const missing = requiredNodeTypes.filter((nodeType) => !(nodeType in objectInfo));

    if (missing.length > 0) {
      throw new ComfyError(`ComfyUI is missing required nodes: ${missing.join(", ")}`, {
        code: "COMFY_MISSING_NODES",
        details: missing,
        statusCode: 503,
      });
    }
  }

  async submitPrompt({
    clientId = "creation-station",
    prompt,
  }: {
    clientId?: string;
    prompt: Record<string, unknown>;
  }): Promise<{ promptId: string }> {
    let response: Response;

    try {
      response = await this.fetchImpl(`${this.baseUrl}/prompt`, {
        body: JSON.stringify({ client_id: clientId, prompt }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
    } catch (error) {
      throw new ComfyError(
        `ComfyUI is unavailable at ${this.baseUrl}: ${error instanceof Error ? error.message : "connection failed"}`,
        { code: "COMFY_OFFLINE", statusCode: 503 },
      );
    }

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new ComfyError(
        `ComfyUI workflow submit failed with HTTP ${response.status}${details ? `: ${details}` : "."}`,
        { code: "COMFY_SUBMIT_FAILED", statusCode: 502 },
      );
    }

    const payload = asRecord(await response.json());
    const promptId = typeof payload?.prompt_id === "string" ? payload.prompt_id : "";

    if (!promptId) {
      throw new ComfyError("ComfyUI did not return a prompt_id.", {
        code: "COMFY_BAD_RESPONSE",
        statusCode: 502,
      });
    }

    return { promptId };
  }

  async waitForCompletion({
    promptId,
    intervalMs = resolveComfyPollIntervalMs(),
    timeoutMs = resolveComfyTimeoutMs(),
  }: {
    promptId: string;
    intervalMs?: number;
    timeoutMs?: number;
  }): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const history = await this.fetchHistory(promptId);
      const record = asRecord(history[promptId]);
      const status = asRecord(record?.status);

      if (status?.status_str === "error") {
        throw new ComfyError(`ComfyUI job failed: ${promptId}`, {
          code: "COMFY_JOB_FAILED",
          statusCode: 502,
        });
      }

      if (status?.completed === true || asRecord(record?.outputs)) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new ComfyError(`ComfyUI job timed out: ${promptId}`, {
      code: "COMFY_TIMEOUT",
      statusCode: 504,
    });
  }

  async getPromptRuntimeStatus(promptId: string): Promise<ComfyPromptRuntimeStatus> {
    const history = await this.fetchHistory(promptId);
    const record = asRecord(history[promptId]);
    const status = asRecord(record?.status);

    if (status?.status_str === "error") {
      return "failed";
    }

    if (status?.completed === true || asRecord(record?.outputs)) {
      return "completed";
    }

    const queue = await this.fetchQueue();
    const running = Array.isArray(queue.queue_running) ? queue.queue_running : [];
    const pending = Array.isArray(queue.queue_pending) ? queue.queue_pending : [];

    if (containsPromptId(running, promptId)) {
      return "running";
    }

    if (containsPromptId(pending, promptId)) {
      return "queued";
    }

    return "running";
  }

  async retrieveOutputs(promptId: string): Promise<ComfyOutputRef[]> {
    const history = await this.fetchHistory(promptId);
    const record = asRecord(history[promptId]);
    const outputs = asRecord(record?.outputs);
    const collected: ComfyOutputRef[] = [];

    for (const nodeOutput of Object.values(outputs ?? {})) {
      const nodeOutputRecord = asRecord(nodeOutput);

      for (const value of Object.values(nodeOutputRecord ?? {})) {
        if (!Array.isArray(value)) {
          continue;
        }

        for (const item of value) {
          const output = asRecord(item);
          const filename = typeof output?.filename === "string" ? output.filename : "";
          const subfolder = typeof output?.subfolder === "string" ? output.subfolder : "";
          const type = typeof output?.type === "string" ? output.type : "output";

          if (!filename) {
            continue;
          }

          const params = new URLSearchParams({ filename, subfolder, type });
          collected.push({
            filename,
            subfolder,
            type,
            url: `${this.baseUrl}/view?${params.toString()}`,
          });
        }
      }
    }

    if (collected.length === 0) {
      throw new ComfyError(`ComfyUI job has no retrievable outputs: ${promptId}`, {
        code: "COMFY_MISSING_OUTPUT",
        statusCode: 502,
      });
    }

    return collected;
  }

  async getHistory(promptId: string): Promise<Record<string, unknown>> {
    return this.fetchHistory(promptId);
  }

  async downloadOutput(output: ComfyOutputRef): Promise<Buffer> {
    let response: Response;

    try {
      response = await this.fetchImpl(output.url);
    } catch (error) {
      throw new ComfyError(
        `ComfyUI output download failed for ${output.filename}: ${
          error instanceof Error ? error.message : "connection failed"
        }`,
        { code: "COMFY_DOWNLOAD_FAILED", statusCode: 502 },
      );
    }

    if (!response.ok) {
      throw new ComfyError(`ComfyUI output download failed with HTTP ${response.status}: ${output.filename}`, {
        code: "COMFY_DOWNLOAD_FAILED",
        statusCode: 502,
      });
    }

    const bytes = Buffer.from(await response.arrayBuffer());

    if (bytes.length === 0) {
      throw new ComfyError(`ComfyUI output is empty or corrupted: ${output.filename}`, {
        code: "COMFY_EMPTY_OUTPUT",
        statusCode: 502,
      });
    }

    return bytes;
  }

  private async fetchObjectInfo(): Promise<Record<string, unknown>> {
    let response: Response;

    try {
      response = await this.fetchImpl(`${this.baseUrl}/object_info`);
    } catch (error) {
      throw new ComfyError(
        `ComfyUI is unavailable at ${this.baseUrl}: ${error instanceof Error ? error.message : "connection failed"}`,
        { code: "COMFY_OFFLINE", statusCode: 503 },
      );
    }

    if (!response.ok) {
      throw new ComfyError(`ComfyUI node lookup failed with HTTP ${response.status}.`, {
        code: "COMFY_NODE_LOOKUP_FAILED",
        statusCode: 502,
      });
    }

    return (await response.json()) as Record<string, unknown>;
  }

  private async fetchHistory(promptId: string): Promise<Record<string, unknown>> {
    let response: Response;

    try {
      response = await this.fetchImpl(`${this.baseUrl}/history/${encodeURIComponent(promptId)}`);
    } catch (error) {
      throw new ComfyError(
        `ComfyUI history lookup failed because ComfyUI is unavailable at ${this.baseUrl}: ${
          error instanceof Error ? error.message : "connection failed"
        }`,
        { code: "COMFY_OFFLINE", statusCode: 503 },
      );
    }

    if (!response.ok) {
      throw new ComfyError(`ComfyUI history lookup failed with HTTP ${response.status}.`, {
        code: "COMFY_HISTORY_FAILED",
        statusCode: 502,
      });
    }

    return (await response.json()) as Record<string, unknown>;
  }

  private async fetchQueue(): Promise<Record<string, unknown>> {
    let response: Response;

    try {
      response = await this.fetchImpl(`${this.baseUrl}/queue`);
    } catch (error) {
      throw new ComfyError(
        `ComfyUI queue lookup failed because ComfyUI is unavailable at ${this.baseUrl}: ${
          error instanceof Error ? error.message : "connection failed"
        }`,
        { code: "COMFY_OFFLINE", statusCode: 503 },
      );
    }

    if (!response.ok) {
      throw new ComfyError(`ComfyUI queue lookup failed with HTTP ${response.status}.`, {
        code: "COMFY_QUEUE_FAILED",
        statusCode: 502,
      });
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

function containsPromptId(entries: unknown[], promptId: string): boolean {
  return entries.some((entry) => entryContainsPromptId(entry, promptId));
}

function entryContainsPromptId(value: unknown, promptId: string): boolean {
  if (typeof value === "string") {
    return value === promptId;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => entryContainsPromptId(entry, promptId));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((entry) => entryContainsPromptId(entry, promptId));
  }

  return false;
}