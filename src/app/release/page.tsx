import Link from "next/link";

import { AppSidebar } from "@/app/components/AppSidebar";

const readinessItems = [
  "Create idea",
  "Send idea to AI Factory",
  "Plan appears in Review Inbox",
  "Request revision with notes",
  "Re-plan with feedback",
  "Approve plan",
  "Tasks appear on board",
  "Export backup downloads JSON",
  "Dashboard shows current counts",
  "Settings shows AI provider health",
];

const releaseGuards = [
  "No schema changes",
  "No auth or team features",
  "No external connectors",
  "No plugin systems",
  "No cloud sync",
  "No asset vault",
  "No new AI systems",
];

export default function ReleasePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-6 lg:grid-cols-[280px_1fr]">
        <AppSidebar
          active="release"
          title="Release"
          subtitle="v1.0 readiness checklist."
          showBackup
        />

        <section className="space-y-6">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">v1.0 Release Readiness</h2>
                <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                  Run this as the final local QA pass before calling Creation Station
                  v1.0 ready. The goal is confidence in the existing solo creator
                  workflow, not expansion.
                </p>
              </div>
              <Link
                href="/"
                className="rounded-2xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-center text-sm font-semibold text-blue-200 transition hover:border-blue-400 hover:bg-blue-500/20"
              >
                Start QA Loop
              </Link>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
              <h2 className="text-xl font-semibold">Manual Product Checks</h2>
              <div className="mt-5 space-y-3">
                {readinessItems.map((item) => (
                  <label
                    key={item}
                    className="flex items-start gap-3 rounded-2xl bg-zinc-950 p-4 text-sm text-zinc-200"
                  >
                    <input type="checkbox" className="mt-1 size-4 accent-emerald-500" />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
              <h2 className="text-xl font-semibold">Release Guardrails</h2>
              <div className="mt-5 space-y-3">
                {releaseGuards.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300"
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <p className="font-semibold">Backup before release</p>
                <p className="mt-2 text-emerald-100/80">
                  Export a local JSON backup before final QA and before any future
                  milestone work.
                </p>
                <a
                  href="/api/export"
                  className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-500"
                >
                  Export Backup
                </a>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
