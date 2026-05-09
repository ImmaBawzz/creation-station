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
  const [lyricsMessage, setLyricsMessage] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

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
      <div className="flex flex-wrap items-center gap-2">
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
      {lyricsMessage ? <p className="text-sm text-zinc-400">{lyricsMessage}</p> : null}
      {message ? <p className="text-sm text-zinc-400">{message}</p> : null}
    </div>
  );
}
