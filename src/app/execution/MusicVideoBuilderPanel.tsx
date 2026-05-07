"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { MusicVideoWorkflowPreset } from "@/lib/music-video-workflows";

type BuilderStatus =
  | "completed"
  | "failed"
  | "merging"
  | "packaging"
  | "pending"
  | "rendering"
  | "running";

type BuilderResponse = {
  downloads: Record<string, string> | null;
  request: {
    error: string;
    id: string;
    status: BuilderStatus | string;
  };
};

const progressSteps = [
  { key: "pending", label: "Queued" },
  { key: "rendering", label: "Rendering" },
  { key: "merging", label: "Merging" },
  { key: "packaging", label: "Packaging" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
] as const;

function normalizedStatus(status: string): BuilderStatus {
  if (status === "running") {
    return "rendering";
  }

  if (
    status === "completed" ||
    status === "failed" ||
    status === "merging" ||
    status === "packaging" ||
    status === "pending" ||
    status === "rendering"
  ) {
    return status;
  }

  return "pending";
}

function stepState(status: string, step: string): "active" | "done" | "idle" | "failed" {
  const normalized = normalizedStatus(status);

  if (normalized === "failed") {
    return step === "failed" ? "failed" : "idle";
  }

  const activeIndex = progressSteps.findIndex((item) => item.key === normalized);
  const stepIndex = progressSteps.findIndex((item) => item.key === step);

  if (step === normalized) {
    return "active";
  }

  return stepIndex < activeIndex ? "done" : "idle";
}

export function MusicVideoBuilderPanel({
  workflowPresets,
}: {
  workflowPresets: MusicVideoWorkflowPreset[];
}) {
  const defaultPresetId = workflowPresets[0]?.id ?? "";
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestState, setRequestState] = useState<BuilderResponse | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState(defaultPresetId);
  const activeRequestId = requestState?.request.id ?? "";
  const terminal = ["completed", "failed"].includes(requestState?.request.status ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  const selectedPreset = useMemo(
    () =>
      workflowPresets.find((preset) => preset.id === selectedPresetId) ??
      workflowPresets[0] ??
      null,
    [selectedPresetId, workflowPresets],
  );

  const statusLabel = useMemo(() => {
    const status = normalizedStatus(requestState?.request.status ?? "pending");
    const current = progressSteps.find((step) => step.key === status);
    return current?.label ?? "Queued";
  }, [requestState?.request.status]);

  useEffect(() => {
    if (!activeRequestId || terminal) {
      return;
    }

    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/music-video-builder/${activeRequestId}`, {
          cache: "no-store",
        });
        const payload = await response.json() as BuilderResponse;

        if (!cancelled && response.ok) {
          setRequestState(payload);
        }
      } catch {
        if (!cancelled) {
          setError("Could not refresh builder progress.");
        }
      }
    }, 1_500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeRequestId, terminal]);

  async function submitBuilder(formData: FormData) {
    setError("");
    setIsSubmitting(true);
    setRequestState(null);

    try {
      const response = await fetch("/api/music-video-builder", {
        body: formData,
        method: "POST",
      });
      const payload = await response.json() as BuilderResponse | { error: string };

      if (!response.ok) {
        setError("error" in payload ? payload.error : "Music video request failed.");
        return;
      }

      const nextState = payload as BuilderResponse;
      setRequestState(nextState);
      formRef.current?.reset();

      void fetch("/api/worker/tick", {
        body: JSON.stringify({
          actionLimits: { music_video_builder_v1: 1 },
          workerId: "music-video-builder-ui",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }).then(async (workerResponse) => {
        if (!workerResponse.ok) {
          setError("Worker did not accept the music video request.");
        }

        const statusResponse = await fetch(`/api/music-video-builder/${nextState.request.id}`, {
          cache: "no-store",
        });

        if (statusResponse.ok) {
          setRequestState(await statusResponse.json() as BuilderResponse);
        }
      }).catch(() => {
        setError("Worker could not start the music video request.");
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-fuchsia-500/25 bg-zinc-900/70 p-6 shadow-2xl">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h3 className="text-xl font-semibold">End-to-End Music Video Builder</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            Upload audio, choose a visual workflow, render through ComfyUI, merge with FFmpeg,
            and export a release package.
          </p>
        </div>
        <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-100">
          MusicVideoBuilderV1
        </span>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <form
          ref={formRef}
          action={submitBuilder}
          className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
        >
          <div>
            <label className="text-xs font-medium text-zinc-500" htmlFor="builder-title">
              Title
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-fuchsia-500"
              id="builder-title"
              name="title"
              placeholder="Signal Fire"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500" htmlFor="builder-audio">
              Audio upload
            </label>
            <input
              accept="audio/*"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              id="builder-audio"
              name="audio"
              required
              type="file"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500" htmlFor="builder-prompt">
              Visual prompt
            </label>
            <textarea
              className="mt-1 min-h-32 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-relaxed outline-none focus:border-fuchsia-500"
              id="builder-prompt"
              name="visualPrompt"
              placeholder="Neon-lit performance sequence with reflective wet streets and a crowded final chorus."
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-500" htmlFor="builder-source-image">
                Source image
              </label>
              <input
                accept="image/*"
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-100"
                id="builder-source-image"
                name="sourceImage"
                type="file"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500" htmlFor="builder-duration">
                Duration
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-fuchsia-500"
                id="builder-duration"
                min={15}
                name="durationSeconds"
                placeholder="180"
                type="number"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500" htmlFor="builder-workflow">
              Workflow preset
            </label>
            <select
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-fuchsia-500"
              id="builder-workflow"
              name="workflowPreset"
              onChange={(event) => setSelectedPresetId(event.currentTarget.value)}
              required
              value={selectedPresetId}
            >
              {workflowPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          {selectedPreset && (
            <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-4">
              <p className="text-sm leading-relaxed text-fuchsia-50">
                {selectedPreset.description}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {selectedPreset.stages.map((stage, index) => (
                  <div
                    className="flex min-h-12 items-center gap-3 rounded-xl border border-fuchsia-500/15 bg-zinc-950/60 px-3 py-2 text-sm text-fuchsia-50/90"
                    key={`${selectedPreset.id}-${stage}`}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-fuchsia-500 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span>{stage}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
              {error}
            </p>
          )}

          <button
            className="rounded-2xl bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Queueing..." : "Create Video Package"}
          </button>
        </form>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-zinc-100">Progress</p>
              <p className="mt-1 text-sm text-zinc-400">{statusLabel}</p>
            </div>
            {activeRequestId && (
              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                {activeRequestId.slice(0, 8)}
              </span>
            )}
          </div>

          <div className="mt-5 space-y-3">
            {progressSteps.map((step) => {
              const state = stepState(requestState?.request.status ?? "pending", step.key);
              const stateClass = state === "done"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : state === "active"
                  ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-100"
                  : state === "failed"
                    ? "border-rose-500/40 bg-rose-500/15 text-rose-100"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400";

              return (
                <div
                  key={step.key}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${stateClass}`}
                >
                  <span>{step.label}</span>
                  <span className="text-xs">
                    {state === "done" ? "Done" : state === "active" ? "Active" : state === "failed" ? "Failed" : "Waiting"}
                  </span>
                </div>
              );
            })}
          </div>

          {requestState?.request.error && (
            <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
              {requestState.request.error}
            </p>
          )}

          {requestState?.downloads && (
            <div className="mt-5">
              <p className="font-semibold text-zinc-100">Download package</p>
              <div className="mt-3 grid gap-2 text-sm">
                {[
                  ["Final MP4", requestState.downloads.finalMp4],
                  ["Thumbnail", requestState.downloads.thumbnail],
                  ["Workflow JSON", requestState.downloads.workflow],
                  ["Prompt Text", requestState.downloads.promptText],
                  ["Metadata", requestState.downloads.metadata],
                ].map(([label, href]) => (
                  <a
                    className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200 transition hover:border-fuchsia-500/40 hover:bg-zinc-800"
                    href={href}
                    key={label}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
