"use client";

import { useState } from "react";

const storageKey = "creation-station.prompt-presets.v0.9";
const factoryCookieName = "creation_station_factory_preset";
const revisionCookieName = "creation_station_revision_preset";

const defaultPresets = {
  factory: "Keep plans practical, local-first, and focused on the first useful version.",
  revision: "Make the next plan smaller, clearer, and directly responsive to the review notes.",
};

function loadInitialPresets() {
  if (typeof window === "undefined") {
    return defaultPresets;
  }

  const savedPresets = window.localStorage.getItem(storageKey);

  if (!savedPresets) {
    return defaultPresets;
  }

  try {
    const parsed = JSON.parse(savedPresets) as Partial<typeof defaultPresets>;

    return {
      factory: parsed.factory || defaultPresets.factory,
      revision: parsed.revision || defaultPresets.revision,
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return defaultPresets;
  }
}

function setPresetCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

function clearPresetCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

export function PromptPresets() {
  const [presets, setPresets] = useState(loadInitialPresets);
  const [saved, setSaved] = useState(false);

  function savePresets() {
    window.localStorage.setItem(storageKey, JSON.stringify(presets));
    setPresetCookie(factoryCookieName, presets.factory);
    setPresetCookie(revisionCookieName, presets.revision);
    setSaved(true);
  }

  function resetPresets() {
    window.localStorage.removeItem(storageKey);
    clearPresetCookie(factoryCookieName);
    clearPresetCookie(revisionCookieName);
    setPresets(defaultPresets);
    setSaved(false);
  }

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Prompt Presets</h2>
        <p className="text-sm text-zinc-400">
          Draft reusable prompt notes for Factory and revision work. Saved presets are used by the Factory from this browser.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-zinc-200">Factory planning preset</span>
          <textarea
            value={presets.factory}
            onChange={(event) => {
              setPresets((current) => ({
                ...current,
                factory: event.target.value,
              }));
              setSaved(false);
            }}
            rows={5}
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-purple-500"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-zinc-200">Revision preset</span>
          <textarea
            value={presets.revision}
            onChange={(event) => {
              setPresets((current) => ({
                ...current,
                revision: event.target.value,
              }));
              setSaved(false);
            }}
            rows={5}
            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-purple-500"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={savePresets}
          className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500"
        >
          Save Presets
        </button>
        <button
          type="button"
          onClick={resetPresets}
          className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
        >
          Reset
        </button>
        {saved && <span className="text-sm text-emerald-300">Saved in this browser.</span>}
      </div>
    </section>
  );
}
