"use client";

import { useState } from "react";

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
  imagePath?: string;
  manifestPath?: string;
  promptId?: string;
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
  const [conceptMessage, setConceptMessage] = useState<string>("");
  const [conceptPrompt, setConceptPrompt] = useState(`cinematic concept art for ${projectId.replace(/[-_]+/g, " ")}`);
  const [negativeConceptPrompt, setNegativeConceptPrompt] = useState(
    "blurry, low quality, distorted anatomy, watermark, text, logo",
  );
  const [isGeneratingConcept, setIsGeneratingConcept] = useState(false);
  const [lyricsMessage, setLyricsMessage] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  async function handleGenerateConcept() {
    const prompt = conceptPrompt.trim();

    if (!prompt) {
      setConceptMessage("Concept prompt is required.");
      return;
    }
    const negativePrompt = negativeConceptPrompt.trim();

    setIsGeneratingConcept(true);
    setConceptMessage("");

    try {
      const response = await fetch("/api/comfy/generate-image", {
        body: JSON.stringify({
          negativePrompt,
          projectId,
          prompt,
          workflowType: "flux-fast-concept",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as ComfyGenerateResponse;

      if (!response.ok) {
        const detailText = payload.details && payload.details.length > 0
          ? ` ${payload.details.join("; ")}`
          : "";
        setConceptMessage(`${payload.error ?? "Concept generation failed."}${detailText}`);
        return;
      }

      setConceptMessage(`Concept art ready: ${payload.imagePath ?? "image created"}`);
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
          <span>Concept prompt</span>
          <input
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-0 placeholder:text-zinc-500"
            onChange={(event) => setConceptPrompt(event.target.value)}
            placeholder="Describe the concept image to generate"
            type="text"
            value={conceptPrompt}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
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
          disabled={isGeneratingConcept}
          onClick={handleGenerateConcept}
          type="button"
        >
          {isGeneratingConcept ? "Generating Concept..." : "Generate Concept Art"}
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
      {conceptMessage ? <p className="text-sm text-zinc-400">{conceptMessage}</p> : null}
      {lyricsMessage ? <p className="text-sm text-zinc-400">{lyricsMessage}</p> : null}
      {message ? <p className="text-sm text-zinc-400">{message}</p> : null}
    </div>
  );
}
