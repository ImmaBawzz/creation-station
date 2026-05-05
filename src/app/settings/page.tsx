import { AppSidebar } from "@/app/components/AppSidebar";
import { getAiProviderStatus } from "@/lib/aiProvider";
import { testAiConnection } from "./actions";
import { PromptPresets } from "./PromptPresets";

type SettingsPageProps = {
  searchParams?: Promise<{
    aiHealth?: string;
    aiMessage?: string;
  }>;
};

export const dynamic = "force-dynamic";

function healthClasses(ok: boolean): string {
  return ok
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
    : "border-red-500/30 bg-red-500/10 text-red-100";
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = (await searchParams) ?? {};
  const status = getAiProviderStatus();
  const lastHealthOk = params.aiHealth === "ok";
  const hasHealthResult = Boolean(params.aiHealth && params.aiMessage);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-6 lg:grid-cols-[280px_1fr]">
        <AppSidebar
          active="settings"
          title="Settings"
          subtitle="Local AI Factory configuration and health."
          showBackup
        />

        <section className="space-y-6">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">AI Provider Controls</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Current local environment values used by the Factory Planner.
                </p>
              </div>
              <form action={testAiConnection}>
                <button className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold hover:bg-blue-500">
                  Test AI Connection
                </button>
              </form>
            </div>
          </section>

          <section
            className={`rounded-3xl border p-5 text-sm shadow-2xl ${healthClasses(
              status.environmentReady,
            )}`}
          >
            <p className="font-semibold">
              AI Health: {status.environmentReady ? "Environment Ready" : "Needs Setup"}
            </p>
            <p className="mt-2 opacity-90">{status.message}</p>
          </section>

          {hasHealthResult && (
            <section
              className={`rounded-3xl border p-5 text-sm shadow-2xl ${healthClasses(
                lastHealthOk,
              )}`}
            >
              <p className="font-semibold">
                Connection Test: {lastHealthOk ? "Healthy" : "Failed"}
              </p>
              <p className="mt-2 opacity-90">{params.aiMessage}</p>
            </section>
          )}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="text-sm text-zinc-400">AI Provider</p>
              <p className="mt-3 text-xl font-semibold">{status.provider}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="text-sm text-zinc-400">Ollama Model</p>
              <p className="mt-3 break-words text-xl font-semibold">{status.model}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="text-sm text-zinc-400">Ollama Base URL</p>
              <p className="mt-3 break-words text-sm font-semibold text-zinc-200">
                {status.baseUrl}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="text-sm text-zinc-400">Environment Status</p>
              <p className="mt-3 text-xl font-semibold">
                {status.environmentReady ? "Ready" : "Incomplete"}
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
            <h2 className="text-xl font-semibold">Environment Checklist</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-zinc-950 p-4">
                <p className="text-sm text-zinc-400">Provider supported</p>
                <p className="mt-2 font-semibold">
                  {status.supported ? "Yes" : "No"}
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-950 p-4">
                <p className="text-sm text-zinc-400">Base URL set</p>
                <p className="mt-2 font-semibold">
                  {status.hasBaseUrl ? "Yes" : "No"}
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-950 p-4">
                <p className="text-sm text-zinc-400">Model set</p>
                <p className="mt-2 font-semibold">{status.hasModel ? "Yes" : "No"}</p>
              </div>
            </div>
          </section>

          <PromptPresets />
        </section>
      </div>
    </main>
  );
}
