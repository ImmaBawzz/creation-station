"use client";

import { useEffect, useState } from "react";

type WorkflowType = "flux-fast-concept" | "flux-dev-cinematic";
type ScenePriority = "high" | "low";
type SceneGenerationType = "intro" | "lyric" | "chorus" | "peak" | "transition" | "outro";

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

type ScenePlanScene = {
  cameraDirection: string;
  emotionalTone: string;
  endTime: number;
  generationType: SceneGenerationType;
  id: string;
  lyricSegment: string;
  priority: ScenePriority;
  startTime: number;
  visualDescription: string;
  workflowType: WorkflowType;
};

type ScenePlanResponse = {
  details?: string[];
  error?: string;
  planPath?: string;
  projectId?: string;
  sceneCount?: number;
  scenePlan?: {
    scenes: ScenePlanScene[];
  };
  songDuration?: number;
  success?: boolean;
  timestampSource?: string;
};

function formatSceneTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function buildScenePrompt(scene: ScenePlanScene): string {
  return [
    scene.visualDescription,
    scene.cameraDirection,
    scene.lyricSegment ? `Lyric cue: ${scene.lyricSegment}.` : "Instrumental transition frame.",
  ].join(" ");
}

export function RenderProjectButton({ projectId }: { projectId: string }) {
  const [approvedSceneIds, setApprovedSceneIds] = useState<string[]>([]);
  const [activeConceptJobId, setActiveConceptJobId] = useState<string | null>(null);
  const [conceptMessage, setConceptMessage] = useState<string>("");
  const [conceptPrompt, setConceptPrompt] = useState(`cinematic concept art for ${projectId.replace(/[-_]+/g, " ")}`);
  const [conceptStatus, setConceptStatus] = useState<ComfyJobStatus | null>(null);
  const [creativeDirection, setCreativeDirection] = useState<string>("");
  const [negativeConceptPrompt, setNegativeConceptPrompt] = useState(
    "blurry, low quality, distorted anatomy, watermark, text, logo",
  );
  const [isGeneratingConcept, setIsGeneratingConcept] = useState(false);
  const [lyricsMessage, setLyricsMessage] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isGeneratingScenePlan, setIsGeneratingScenePlan] = useState(false);
  const [isQueueingScenePlan, setIsQueueingScenePlan] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isRefreshingWorkflowState, setIsRefreshingWorkflowState] = useState(false);
  const [scenePlan, setScenePlan] = useState<ScenePlanScene[]>([]);
  const [scenePlanMessage, setScenePlanMessage] = useState<string>("");
  const [selectedWorkflowType, setSelectedWorkflowType] = useState<WorkflowType>("flux-fast-concept");
  const [stylePreset, setStylePreset] = useState<string>("");
  const [workflowStatusByType, setWorkflowStatusByType] = useState<Record<WorkflowType, WorkflowStatusResponse>>(DEFAULT_WORKFLOW_STATUS);

  const isConceptJobActive = conceptStatus !== null && conceptStatus !== "completed" && conceptStatus !== "failed" && conceptStatus !== "timeout";
  const selectedWorkflow = workflowStatusByType[selectedWorkflowType] ?? DEFAULT_WORKFLOW_STATUS[selectedWorkflowType];
  const approvedScenes = scenePlan.filter((scene) => approvedSceneIds.includes(scene.id));
  const selectedWorkflowNote = selectedWorkflow.errors?.[0]
    ?? (selectedWorkflow.models?.missing && selectedWorkflow.models.missing.length > 0
      ? `Missing model files: ${selectedWorkflow.models.missing.join(", ")}`
      : undefined)
    ?? selectedWorkflow.models?.warnings?.[0]
    ?? selectedWorkflow.warnings?.[0]
    ?? "";

  useEffect(() => {
    let cancelled = false;

    async function loadScenePlan() {
      try {
        const response = await fetch(`/api/scene-planner/generate?projectId=${encodeURIComponent(projectId)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ScenePlanResponse;

        if (cancelled || !payload.scenePlan) {
          return;
        }

        setScenePlan(payload.scenePlan.scenes);
        setApprovedSceneIds(payload.scenePlan.scenes.map((scene) => scene.id));
      } catch {
        // Ignore missing persisted plans on first load.
      }
    }

    void loadScenePlan();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

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

  async function handleGenerateScenePlan(regenerateSceneId?: string) {
    setIsGeneratingScenePlan(true);
    setScenePlanMessage(regenerateSceneId ? "Refreshing scene..." : "Building scene plan...");

    try {
      const response = await fetch("/api/scene-planner/generate", {
        body: JSON.stringify({
          creativeDirection: creativeDirection.trim() || undefined,
          projectId,
          regenerateSceneId,
          stylePreset: stylePreset.trim() || undefined,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as ScenePlanResponse;

      if (!response.ok || !payload.scenePlan) {
        const detailText = payload.details && payload.details.length > 0
          ? ` ${payload.details.join("; ")}`
          : "";
        setScenePlanMessage(`${payload.error ?? "Scene planning failed."}${detailText}`);
        return;
      }

      const nextScenes = payload.scenePlan.scenes;
      const previousApproved = new Set(approvedSceneIds);
      setScenePlan(nextScenes);
      setApprovedSceneIds(nextScenes.map((scene) => scene.id).filter((sceneId) => previousApproved.size === 0 || previousApproved.has(sceneId)));
      setScenePlanMessage(
        `${payload.sceneCount ?? nextScenes.length} scenes ready from ${payload.timestampSource ?? "generated"} timestamps${payload.planPath ? `: ${payload.planPath}` : ""}`,
      );
    } catch (error) {
      setScenePlanMessage(error instanceof Error ? error.message : "Scene planning failed.");
    } finally {
      setIsGeneratingScenePlan(false);
    }
  }

  function handleToggleSceneApproval(sceneId: string) {
    setApprovedSceneIds((current) => current.includes(sceneId)
      ? current.filter((id) => id !== sceneId)
      : [...current, sceneId]);
  }

  function handleApproveAllScenes() {
    setApprovedSceneIds(scenePlan.map((scene) => scene.id));
    setScenePlanMessage(scenePlan.length > 0 ? `Approved ${scenePlan.length} scenes.` : "Generate a scene plan first.");
  }

  async function handleQueueApprovedScenes() {
    if (approvedScenes.length === 0) {
      setScenePlanMessage("Approve at least one scene before queueing image generation.");
      return;
    }

    setIsQueueingScenePlan(true);
    setScenePlanMessage("Queueing approved scenes...");

    let queued = 0;
    const failures: string[] = [];

    for (const scene of approvedScenes) {
      const workflow = workflowStatusByType[scene.workflowType] ?? DEFAULT_WORKFLOW_STATUS[scene.workflowType];

      if (!workflow.selectable) {
        failures.push(`${scene.id}: ${workflow.errors?.[0] ?? "workflow unavailable"}`);
        continue;
      }

      try {
        const response = await fetch("/api/comfy/generate-image", {
          body: JSON.stringify({
            negativePrompt: negativeConceptPrompt.trim(),
            projectId,
            prompt: buildScenePrompt(scene),
            workflowType: scene.workflowType,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as ComfyGenerateResponse;

        if (!response.ok) {
          failures.push(`${scene.id}: ${payload.error ?? "queue failed"}`);
          continue;
        }

        queued += 1;
      } catch (error) {
        failures.push(`${scene.id}: ${error instanceof Error ? error.message : "queue failed"}`);
      }
    }

    setScenePlanMessage(
      failures.length > 0
        ? `Queued ${queued} scenes. ${failures.join(" | ")}`
        : `Queued ${queued} approved scenes for image generation.`,
    );
    setIsQueueingScenePlan(false);
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
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>Creative direction</span>
          <input
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-0 placeholder:text-zinc-500"
            onChange={(event) => setCreativeDirection(event.target.value)}
            placeholder="Optional creative brief for scene planning"
            type="text"
            value={creativeDirection}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>Style preset</span>
          <input
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-0 placeholder:text-zinc-500"
            onChange={(event) => setStylePreset(event.target.value)}
            placeholder="Optional look preset"
            type="text"
            value={stylePreset}
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
          disabled={isGeneratingScenePlan}
          onClick={() => void handleGenerateScenePlan()}
          type="button"
        >
          {isGeneratingScenePlan ? "Generating Scene Plan..." : "Generate Scene Plan"}
        </button>
        <button
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={scenePlan.length === 0}
          onClick={handleApproveAllScenes}
          type="button"
        >
          Approve All Scenes
        </button>
        <button
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isQueueingScenePlan || approvedScenes.length === 0}
          onClick={() => void handleQueueApprovedScenes()}
          type="button"
        >
          {isQueueingScenePlan ? "Queueing Scenes..." : `Queue Approved Scenes (${approvedScenes.length})`}
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
      {scenePlanMessage ? <p className="text-sm text-zinc-400">{scenePlanMessage}</p> : null}
      {message ? <p className="text-sm text-zinc-400">{message}</p> : null}
      {scenePlan.length > 0 ? (
        <div className="mt-2 w-full space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Planned shots</h3>
              <p className="text-xs text-zinc-400">Review, approve, and regenerate individual scenes before image generation.</p>
            </div>
            <p className="text-xs text-zinc-500">{approvedScenes.length} of {scenePlan.length} approved</p>
          </div>
          <div className="space-y-3">
            {scenePlan.map((scene) => (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3" key={scene.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-zinc-700 px-2 py-1 text-zinc-200">{scene.id}</span>
                      <span className="rounded-full border border-zinc-700 px-2 py-1 text-zinc-200">{formatSceneTime(scene.startTime)} - {formatSceneTime(scene.endTime)}</span>
                      <span className="rounded-full border border-zinc-700 px-2 py-1 text-zinc-200">{scene.generationType}</span>
                      <span className={`rounded-full border px-2 py-1 ${scene.priority === "high" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-amber-500/40 bg-amber-500/10 text-amber-200"}`}>{scene.priority}</span>
                      <span className={`rounded-full border px-2 py-1 ${getWorkflowBadgeClass(scene.workflowType === "flux-dev-cinematic" ? workflowStatusByType[scene.workflowType]?.status : "valid")}`}>{scene.workflowType}</span>
                    </div>
                    <p className="text-sm text-zinc-100">{scene.lyricSegment || "Instrumental transition"}</p>
                    <p className="text-sm text-zinc-400">Tone: {scene.emotionalTone}</p>
                    <p className="text-sm text-zinc-300">{scene.visualDescription}</p>
                    <p className="text-sm text-zinc-400">{scene.cameraDirection}</p>
                  </div>
                  <div className="flex min-w-44 flex-col items-stretch gap-2">
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      <input
                        checked={approvedSceneIds.includes(scene.id)}
                        className="rounded border-zinc-700 bg-zinc-950"
                        onChange={() => handleToggleSceneApproval(scene.id)}
                        type="checkbox"
                      />
                      Approve scene
                    </label>
                    <button
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isGeneratingScenePlan}
                      onClick={() => void handleGenerateScenePlan(scene.id)}
                      type="button"
                    >
                      Regenerate Scene
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
