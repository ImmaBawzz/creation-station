"use client";

import { useEffect, useState } from "react";

type WorkflowType = "flux-fast-concept" | "flux-dev-cinematic";

type WorkflowValidationStatus = "valid" | "validWithAlias" | "invalid" | "offline";
type WorkflowRuntimeStatus = "Available" | "Needs validation" | "Comfy offline" | "Timeout" | "Output missing" | "Validated";
type WorkflowStatusLabel = WorkflowValidationStatus | WorkflowRuntimeStatus;

type WorkflowOption = {
  label: string;
  value: WorkflowType;
};

type WorkflowStatusResponse = {
  available?: boolean;
  errors?: string[];
  label?: string;
  models?: {
    missing?: string[];
    resolved?: Array<{ requiredName: string; resolvedName: string }>;
    warnings?: string[];
  };
  selectable?: boolean;
  stateStatus?: WorkflowRuntimeStatus;
  status?: WorkflowStatusLabel;
  valid?: boolean;
  warnings?: string[];
  workflowType?: WorkflowType;
};

const WORKFLOW_OPTIONS: WorkflowOption[] = [
  { label: "Fast Concept", value: "flux-fast-concept" },
  { label: "Cinematic Frame", value: "flux-dev-cinematic" },
];

const DEFAULT_WORKFLOW_STATUS: Record<WorkflowType, WorkflowStatusResponse> = {
  "flux-dev-cinematic": {
    available: false,
    errors: [],
    label: "Cinematic Frame",
    models: { missing: [], resolved: [], warnings: [] },
    selectable: false,
    stateStatus: "Needs validation",
    status: "invalid",
    valid: false,
    warnings: [],
    workflowType: "flux-dev-cinematic",
  },
  "flux-fast-concept": {
    available: true,
    errors: [],
    label: "Fast Concept",
    models: { missing: [], resolved: [], warnings: [] },
    selectable: true,
    stateStatus: "Validated",
    status: "valid",
    valid: true,
    warnings: [],
    workflowType: "flux-fast-concept",
  },
};

type RenderResponse = {
  duration?: string;
  details?: string[];
  error?: string;
  packagePath?: string;
  qualityCheck?: {
    durationSeconds: number;
    expectedDurationSeconds: number;
  };
  renderPath?: string;
  success?: boolean;
  usedAudio?: string;
  usedImage?: string;
};

type ComfyGenerateResponse = {
  details?: string[];
  error?: string;
  jobId?: string;
  promptId?: string;
  status?: ComfyJobStatus;
  success?: boolean;
};

type ComfyJobStatus = "queued" | "running" | "importing" | "completed" | "failed" | "timeout";

type ComfyJobResponse = {
  details?: string[];
  error?: string;
  imagePath?: string;
  jobId?: string;
  manifestPath?: string;
  promptId?: string;
  status?: ComfyJobStatus;
  success?: boolean;
  workflowType?: string;
};

type LyricsResponse = {
  assPath?: string;
  details?: string[];
  error?: string;
  jsonPath?: string;
  lineCount?: number;
  srtPath?: string;
  success?: boolean;
  wordCount?: number;
};

export function RenderProjectButton({ projectId }: { projectId: string }) {
  const [activeConceptJobId, setActiveConceptJobId] = useState<string | null>(null);
  const [conceptMessage, setConceptMessage] = useState<string>("");
  const [conceptPrompt, setConceptPrompt] = useState(`cinematic concept art for ${projectId.replace(/[-_]+/g, " ")}`);
  const [conceptStatus, setConceptStatus] = useState<ComfyJobStatus | null>(null);
  const [negativeConceptPrompt, setNegativeConceptPrompt] = useState(
    "blurry, low quality, distorted anatomy, watermark, text, logo",
  );
  const [isGeneratingConcept, setIsGeneratingConcept] = useState(false);
  const [lyricsMessage, setLyricsMessage] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isRefreshingWorkflowState, setIsRefreshingWorkflowState] = useState(false);
  const [selectedWorkflowType, setSelectedWorkflowType] = useState<WorkflowType>("flux-fast-concept");
  const [workflowStatusByType, setWorkflowStatusByType] = useState<Record<WorkflowType, WorkflowStatusResponse>>(DEFAULT_WORKFLOW_STATUS);

  const isConceptJobActive = conceptStatus !== null && conceptStatus !== "completed" && conceptStatus !== "failed" && conceptStatus !== "timeout";
  const selectedWorkflow = workflowStatusByType[selectedWorkflowType] ?? DEFAULT_WORKFLOW_STATUS[selectedWorkflowType];
  const selectedWorkflowNote = selectedWorkflow.errors?.[0]
    ?? (selectedWorkflow.models?.missing && selectedWorkflow.models.missing.length > 0
      ? `Missing model files: ${selectedWorkflow.models.missing.join(", ")}`
      : undefined)
    ?? selectedWorkflow.models?.warnings?.[0]
    ?? selectedWorkflow.warnings?.[0]
    ?? "";

  useEffect(() => {
    let cancelled = false;

    async function refreshWorkflowStatus() {
      setIsRefreshingWorkflowState(true);

      try {
        const results = await Promise.all(
          WORKFLOW_OPTIONS.map(async ({ value }) => {
            const response = await fetch(`/api/comfy/workflows/${value}/validate`, {
              method: "POST",
            });
            const payload = (await response.json()) as WorkflowStatusResponse;
            return [value, payload] as const;
          }),
        );

        if (cancelled) {
          return;
        }

        const nextState = { ...DEFAULT_WORKFLOW_STATUS };
        for (const [value, payload] of results) {
          nextState[value] = {
            ...nextState[value],
            ...payload,
            workflowType: value,
          };
        }

        setWorkflowStatusByType(nextState);
      } catch (error) {
        if (!cancelled) {
          setConceptMessage(error instanceof Error ? error.message : "Workflow validation failed.");
        }
      } finally {
        if (!cancelled) {
          setIsRefreshingWorkflowState(false);
        }
      }
    }

    void refreshWorkflowStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cinematicState = workflowStatusByType["flux-dev-cinematic"];

    if (
      !cinematicState
      || (cinematicState.status !== "valid" && cinematicState.status !== "validWithAlias")
      || !cinematicState.selectable
      || cinematicState.stateStatus === "Validated"
      || cinematicState.stateStatus === "Timeout"
      || cinematicState.stateStatus === "Output missing"
    ) {
      return;
    }

    let cancelled = false;

    async function runSmokeValidation() {
      try {
        const response = await fetch("/api/comfy/workflows/flux-dev-cinematic/smoke-test", {
          body: JSON.stringify({ projectId }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as WorkflowStatusResponse;

        if (cancelled) {
          return;
        }

        setWorkflowStatusByType((current) => ({
          ...current,
          "flux-dev-cinematic": {
            ...current["flux-dev-cinematic"],
            ...payload,
            workflowType: "flux-dev-cinematic",
          },
        }));
      } catch (error) {
        if (!cancelled) {
          setWorkflowStatusByType((current) => ({
            ...current,
            "flux-dev-cinematic": {
              ...current["flux-dev-cinematic"],
              errors: [error instanceof Error ? error.message : "Smoke validation failed."],
              selectable: false,
              status: "Needs validation",
              valid: false,
            },
          }));
        }
      }
    }

    void runSmokeValidation();

    return () => {
      cancelled = true;
    };
  }, [projectId, workflowStatusByType]);

  function getWorkflowBadgeClass(status: WorkflowStatusLabel | undefined): string {
    if (status === "Validated" || status === "Available" || status === "valid") {
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    }

    if (status === "validWithAlias" || status === "Needs validation" || status === "invalid") {
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    }

    return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  }

  useEffect(() => {
    if (!activeConceptJobId) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextPoll = (delayMs: number) => {
      if (cancelled) {
        return;
      }

      timer = setTimeout(() => {
        void pollJob();
      }, delayMs);
    };

    const pollJob = async () => {
      try {
        const response = await fetch(`/api/comfy/jobs/${activeConceptJobId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ComfyJobResponse;
        const nextStatus = payload.status ?? null;

        if (cancelled) {
          return;
        }

        if (nextStatus) {
          setConceptStatus(nextStatus);
        }

        if (nextStatus === "queued") {
          setConceptMessage("Queued");
          scheduleNextPoll(1_500);
          return;
        }

        if (nextStatus === "running") {
          setConceptMessage("Generating");
          scheduleNextPoll(1_500);
          return;
        }

        if (nextStatus === "importing") {
          setConceptMessage("Importing");
          scheduleNextPoll(1_000);
          return;
        }

        if (nextStatus === "completed") {
          setConceptMessage(`Complete: ${payload.imagePath ?? "image imported"}`);
          setActiveConceptJobId(null);
          return;
        }

        if (nextStatus === "failed" || nextStatus === "timeout") {
          setConceptMessage(payload.error ?? "Concept generation failed.");
          setActiveConceptJobId(null);
          return;
        }

        if (!response.ok) {
          setConceptMessage(payload.error ?? "Comfy job status check failed.");
          scheduleNextPoll(2_500);
          return;
        }

        scheduleNextPoll(1_500);
      } catch (error) {
        if (!cancelled) {
          setConceptMessage(error instanceof Error ? error.message : "Comfy job status check failed.");
          scheduleNextPoll(2_500);
        }
      }
    };

    void pollJob();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [activeConceptJobId]);

  async function handleGenerateConcept() {
    const prompt = conceptPrompt.trim();

    if (!prompt) {
      setConceptMessage("Concept prompt is required.");
      return;
    }
    const negativePrompt = negativeConceptPrompt.trim();

    if (!selectedWorkflow.selectable) {
      setConceptMessage(selectedWorkflowNote || `${selectedWorkflow.label ?? "Workflow"} is not ready.`);
      return;
    }

    setIsGeneratingConcept(true);
    setConceptMessage("Submitting...");

    try {
      const response = await fetch("/api/comfy/generate-image", {
        body: JSON.stringify({
          negativePrompt,
          projectId,
          prompt,
          workflowType: selectedWorkflowType,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as ComfyGenerateResponse;

      if (!response.ok) {
        if (response.status === 409 && payload.details?.[0]) {
          setActiveConceptJobId(payload.details[0]);
          setConceptStatus((payload.details[1] as ComfyJobStatus | undefined) ?? "queued");
          setConceptMessage(payload.details[1] === "running" ? "Generating" : "Queued");
          return;
        }

        const detailText = payload.details && payload.details.length > 0
          ? ` ${payload.details.join("; ")}`
          : "";
        setConceptMessage(`${payload.error ?? "Concept generation failed."}${detailText}`);
        return;
      }

      setActiveConceptJobId(payload.jobId ?? null);
      setConceptStatus(payload.status ?? "queued");
      setConceptMessage("Queued");
    } catch (error) {
      setConceptMessage(error instanceof Error ? error.message : "Concept generation failed.");
    } finally {
      setIsGeneratingConcept(false);
    }
  }

  async function handleGenerateLyrics() {
    setIsGeneratingLyrics(true);
    setLyricsMessage("");

    try {
      const response = await fetch(`/api/visual-engine/projects/${projectId}/lyrics/generate`, {
        method: "POST",
      });
      const payload = (await response.json()) as LyricsResponse;

      if (!response.ok) {
        const detailText = payload.details && payload.details.length > 0
          ? ` ${payload.details.join("; ")}`
          : "";
        setLyricsMessage(`${payload.error ?? "Lyrics generation failed."}${detailText}`);
        return;
      }

      setLyricsMessage(
        `Lyrics timing ready: ${payload.assPath ?? payload.srtPath ?? payload.jsonPath ?? "subtitle files created"}`,
      );
    } catch (error) {
      setLyricsMessage(error instanceof Error ? error.message : "Lyrics generation failed.");
    } finally {
      setIsGeneratingLyrics(false);
    }
  }

  async function handleRender() {
    setIsRendering(true);
    setMessage("");

    try {
      const response = await fetch(`/api/visual-engine/projects/${projectId}/render`, {
        method: "POST",
      });
      const payload = (await response.json()) as RenderResponse;

      if (!response.ok) {
        const detailText = payload.details && payload.details.length > 0
          ? ` ${payload.details.join("; ")}`
          : "";
        setMessage(`${payload.error ?? "Render failed."}${detailText}`);
        return;
      }

      setMessage(`Render ready: ${payload.renderPath ?? "final output created"}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Render failed.");
    } finally {
      setIsRendering(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="grid w-full gap-2 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>Workflow</span>
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-0"
            onChange={(event) => setSelectedWorkflowType(event.target.value as WorkflowType)}
            value={selectedWorkflowType}
          >
            {WORKFLOW_OPTIONS.map((option) => {
              const status = workflowStatusByType[option.value] ?? DEFAULT_WORKFLOW_STATUS[option.value];
              const enabled = option.value === "flux-fast-concept" || status.selectable;

              return (
                <option disabled={!enabled} key={option.value} value={option.value}>
                  {option.label}
                </option>
              );
            })}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>Concept prompt</span>
          <input
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-0 placeholder:text-zinc-500"
            onChange={(event) => setConceptPrompt(event.target.value)}
            placeholder="Describe the concept image to generate"
            type="text"
            value={conceptPrompt}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-300 md:col-span-2">
          <span>Negative prompt</span>
          <input
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-0 placeholder:text-zinc-500"
            onChange={(event) => setNegativeConceptPrompt(event.target.value)}
            placeholder="Optional exclusions for the generated image"
            type="text"
            value={negativeConceptPrompt}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isGeneratingConcept || isConceptJobActive}
          onClick={handleGenerateConcept}
          type="button"
        >
          {isGeneratingConcept
            ? "Submitting Concept..."
            : isConceptJobActive
            ? conceptStatus === "queued"
              ? "Concept Queued"
              : conceptStatus === "importing"
              ? "Importing Concept..."
              : "Generating Concept..."
            : "Generate Concept Art"}
        </button>
        <button
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isGeneratingLyrics}
          onClick={handleGenerateLyrics}
          type="button"
        >
          {isGeneratingLyrics ? "Generating Lyrics..." : "Generate Lyrics Timing"}
        </button>
        <button
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isRendering}
          onClick={handleRender}
          type="button"
        >
          {isRendering ? "Rendering..." : "Render Project"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {WORKFLOW_OPTIONS.map((option) => {
          const status = workflowStatusByType[option.value] ?? DEFAULT_WORKFLOW_STATUS[option.value];

          return (
            <span
              className={`rounded-full border px-2 py-1 ${getWorkflowBadgeClass(status.status)}`}
              key={option.value}
            >
              {status.label ?? option.label}: {status.status ?? "invalid"}
            </span>
          );
        })}
        {isRefreshingWorkflowState ? <span className="text-zinc-500">Checking workflows...</span> : null}
      </div>
      {selectedWorkflow.status === "validWithAlias" ? <p className="text-sm text-amber-300">Using local model alias</p> : null}
      {selectedWorkflowNote ? <p className="text-sm text-zinc-400">{selectedWorkflowNote}</p> : null}
      {conceptMessage ? <p className="text-sm text-zinc-400">{conceptMessage}</p> : null}
      {lyricsMessage ? <p className="text-sm text-zinc-400">{lyricsMessage}</p> : null}
      {message ? <p className="text-sm text-zinc-400">{message}</p> : null}
    </div>
  );
}
