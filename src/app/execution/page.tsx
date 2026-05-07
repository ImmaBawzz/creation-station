import Link from "next/link";

import { createMusicVideoPipeline } from "@/app/actions";
import { AppSidebar } from "@/app/components/AppSidebar";
import { buildMusicVideoPipelinePlan } from "@/lib/creative-execution";
import { MUSIC_VIDEO_WORKFLOW_PRESETS } from "@/lib/music-video-workflows";
import { MusicVideoBuilderPanel } from "./MusicVideoBuilderPanel";

const samplePlan = buildMusicVideoPipelinePlan({
  concept: "A neon-lit performance video that moves from isolation to a crowded final chorus.",
  durationSeconds: 180,
  genre: "cinematic synth pop",
  mood: "urgent, glossy, emotional",
  styleReferences: "night city reflections, editorial lighting, high-contrast color",
  title: "Signal Fire",
});

const adapterRows = [
  {
    label: "ComfyUI",
    text: "Submit workflow JSON, poll history until completion, and collect viewable output URLs.",
  },
  {
    label: "FFmpeg",
    text: "Loop visuals, merge audio and video, and validate the exported render file.",
  },
  {
    label: "Asset Pipeline",
    text: "Create project folders, normalize output names, and prepare release package files.",
  },
  {
    label: "Prompt Generation",
    text: "Generate Suno, Udio, image, and video prompts from one music-video brief.",
  },
];

export default function ExecutionPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl p-6">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <AppSidebar
            active="execution"
            subtitle="Create prompt packs, render plans, and release-ready execution steps."
            title="Execution Layer"
          />

          <section className="space-y-6">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Create Music Video Pipeline</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
                    Build a reviewable execution plan with music prompts, visual prompts,
                    ComfyUI handoff steps, FFmpeg render assembly, and release packaging.
                  </p>
                </div>
                <Link
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-center text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
                  href="/?pipeline=music#review-inbox"
                >
                  Open Music Reviews
                </Link>
              </div>
            </div>

            <MusicVideoBuilderPanel workflowPresets={MUSIC_VIDEO_WORKFLOW_PRESETS} />

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <form
                action={createMusicVideoPipeline}
                className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl"
              >
                <h3 className="text-xl font-semibold">Pipeline Brief</h3>
                <div className="mt-5 grid gap-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-500" htmlFor="title">
                      Title
                    </label>
                    <input
                      className="mt-1 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-fuchsia-500"
                      id="title"
                      name="title"
                      placeholder="Signal Fire"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-500" htmlFor="concept">
                      Music video concept
                    </label>
                    <textarea
                      className="mt-1 min-h-36 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-relaxed outline-none focus:border-fuchsia-500"
                      id="concept"
                      name="concept"
                      placeholder="Describe the story, performance setup, visual arc, and release target."
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-zinc-500" htmlFor="genre">
                        Genre
                      </label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-fuchsia-500"
                        id="genre"
                        name="genre"
                        placeholder="cinematic synth pop"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500" htmlFor="mood">
                        Mood
                      </label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-fuchsia-500"
                        id="mood"
                        name="mood"
                        placeholder="urgent, glossy, emotional"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                    <div>
                      <label className="text-xs font-medium text-zinc-500" htmlFor="styleReferences">
                        Visual style references
                      </label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-fuchsia-500"
                        id="styleReferences"
                        name="styleReferences"
                        placeholder="night city reflections, editorial lighting"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500" htmlFor="durationSeconds">
                        Duration
                      </label>
                      <input
                        className="mt-1 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-fuchsia-500"
                        id="durationSeconds"
                        min={15}
                        name="durationSeconds"
                        placeholder="180"
                        type="number"
                      />
                    </div>
                  </div>
                </div>

                <button className="mt-5 rounded-2xl bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-500">
                  Create Music Video Pipeline
                </button>
              </form>

              <div className="space-y-6">
                <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
                  <h3 className="text-xl font-semibold">Execution Adapters</h3>
                  <div className="mt-4 space-y-3">
                    {adapterRows.map((row) => (
                      <div key={row.label} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                        <p className="font-semibold text-zinc-100">{row.label}</p>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{row.text}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-6 shadow-2xl">
                  <h3 className="text-xl font-semibold text-fuchsia-100">Prompt Pack Preview</h3>
                  <div className="mt-4 space-y-3 text-sm text-fuchsia-50/90">
                    <div>
                      <p className="text-xs font-semibold uppercase text-fuchsia-200/70">Suno</p>
                      <p className="mt-1 leading-relaxed">{samplePlan.promptPack.sunoPrompt}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-fuchsia-200/70">Image</p>
                      <p className="mt-1 leading-relaxed">{samplePlan.promptPack.imagePrompts[0]}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-fuchsia-200/70">Video</p>
                      <p className="mt-1 leading-relaxed">{samplePlan.promptPack.videoPrompts[0]}</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
