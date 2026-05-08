"use client";

import { useState } from "react";

type RenderResponse = {
  details?: string[];
  error?: string;
  packagePath?: string;
  renderPath?: string;
};

export function RenderProjectButton({ projectId }: { projectId: string }) {
  const [message, setMessage] = useState<string>("");
  const [isRendering, setIsRendering] = useState(false);

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
      <button
        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isRendering}
        onClick={handleRender}
        type="button"
      >
        {isRendering ? "Rendering..." : "Render Project"}
      </button>
      {message ? <p className="text-sm text-zinc-400">{message}</p> : null}
    </div>
  );
}
