"use client";

import type { LiveUnlockValidation } from "@/lib/autonomy/live-unlock";
import { useState } from "react";

const requirementClasses: Record<string, string> = {
  invalid: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  missing: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  present: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  valid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
};

const lockedFallback: LiveUnlockValidation = {
  actionId: "missing-action",
  mode: "live",
  requirements: [
    {
      label: "Server validation",
      message: "Live unlock diagnostics are not available for this render.",
      status: "missing",
    },
  ],
  unlocked: false,
};

export function ExecutionModeControls({
  liveUnlock,
}: {
  liveUnlock?: LiveUnlockValidation;
}) {
  const resolvedLiveUnlock = liveUnlock ?? lockedFallback;
  const [mode, setMode] = useState<"live" | "simulation">("simulation");
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-zinc-700 bg-zinc-950 p-1">
          <button
            type="button"
            onClick={() => setMode("simulation")}
            className={
              mode === "simulation"
                ? "rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                : "rounded-lg px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
            }
          >
            Simulation
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("live");
              setConfirmOpen(true);
            }}
            className={
              mode === "live"
                ? "rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white"
                : "rounded-lg px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
            }
          >
            Live
          </button>
        </div>
        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-semibold text-zinc-300">
          Current mode: {mode}
        </span>
      </div>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="execution-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl">
            <h4 id="execution-confirm-title" className="font-semibold text-zinc-100">
              Confirm Live Execution
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Server-side validation currently allows live unlock only for a safe file write.
            </p>
            <div className="mt-4 grid gap-2 text-xs">
              {resolvedLiveUnlock.requirements.map((requirement) => (
                <div
                  key={requirement.label}
                  className={`rounded-xl border px-3 py-2 ${requirementClasses[requirement.status]}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{requirement.label}</span>
                    <span>{requirement.status}</span>
                  </div>
                  <p className="mt-1 opacity-85">{requirement.message}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setMode("simulation");
                  setConfirmOpen(false);
                }}
                className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
              >
                Keep Simulation
              </button>
              <button
                type="button"
                disabled
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 opacity-60"
              >
                {resolvedLiveUnlock.unlocked ? "Live Unlock Ready" : "Live Locked"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
