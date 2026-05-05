import Link from "next/link";

import { assetCountLabel, assetLines } from "@/lib/asset-ui";
import { db } from "@/lib/db";
import { potentialLabel, statusBadgeClass, statusLabel } from "@/lib/status-ui";
import { sendToFactory } from "../actions";

type FactoryPageProps = {
  searchParams?: Promise<{
    factoryError?: string;
    factorySuccess?: string;
  }>;
};

export default async function FactoryPage({ searchParams }: FactoryPageProps) {
  const messages = (await searchParams) ?? {};

  const planningIdeas = await db.idea.findMany({
    where: {
      status: {
        in: ["RAW", "NEEDS_REVISION", "PLAN_READY"],
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      plans: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const latestPlans = await db.factoryPlan.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      idea: true,
    },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl p-6">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl">
            <h1 className="text-2xl font-bold">Factory Planner</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Turn one raw idea into one clear plan.
            </p>

            <nav className="mt-8 space-y-2 text-sm">
              <Link
                href="/dashboard"
                className="block rounded-2xl px-4 py-3 text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100"
              >
                📊 Dashboard
              </Link>
              <Link
                href="/"
                className="block rounded-2xl px-4 py-3 text-zinc-400 transition hover:bg-zinc-800/70 hover:text-zinc-100"
              >
                📥 Back to Inbox
              </Link>
              <div className="rounded-2xl bg-zinc-800 px-4 py-3">🏭 Factory Planner</div>
            </nav>

            <div className="mt-8 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-100">
              <p className="font-semibold">Tip</p>
              <p className="mt-2 text-blue-100/80">
                Click “Make AI Plan” to turn an idea into a simple project outline.
                Then review the plan before you approve it on the home page.
              </p>
            </div>
          </aside>

          <section className="space-y-6">
            {messages.factoryError && (
              <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-100 shadow-2xl">
                <p className="font-semibold">Factory Planner problem</p>
                <p className="mt-2 text-red-100/90">{messages.factoryError}</p>
                <p className="mt-2 text-red-100/70">
                  Tip: if the model is missing, run the Ollama pull command shown in the message.
                </p>
              </div>
            )}

            {messages.factorySuccess && (
              <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-sm text-emerald-100 shadow-2xl">
                <p className="font-semibold">AI plan created</p>
                <p className="mt-2 text-emerald-100/90">{messages.factorySuccess}</p>
              </div>
            )}

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
              <h2 className="text-2xl font-semibold">Factory Planner</h2>
              <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                This page takes a saved idea and turns it into a structured plan.
                Start with an idea on the left. After that, read the plan sections on the right.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Ideas Ready for Planning</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      Pick an idea and let Ollama build a first draft plan.
                    </p>
                  </div>
                  <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
                    {planningIdeas.length} ready
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {planningIdeas.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-sm">
                      <p className="font-semibold text-zinc-200">No ideas ready for planning</p>
                      <p className="mt-2 text-zinc-400">
                        Save a new idea on the home page, or request a revision from Review Inbox to send an idea back through the Factory.
                      </p>
                    </div>
                  )}

                  {planningIdeas.map((idea) => {
                    const latestPlan = idea.plans[0];

                    return (
                      <article
                        key={idea.id}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold">{idea.title}</h3>
                            <p className="mt-1 text-xs text-zinc-500">{idea.category}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(idea.status)}`}
                              >
                                {statusLabel(idea.status)}
                              </span>
                            </div>
                          </div>
                          <span className="rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-200">
                            {potentialLabel(idea.potential)}
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-zinc-300">{idea.rawText}</p>

                        <div className="mt-4 rounded-2xl bg-zinc-900 p-3 text-xs text-zinc-400">
                          <p className="font-semibold text-zinc-200">What this button does</p>
                          <p className="mt-2">
                            It asks your local Ollama model to write a first plan with clear next steps.
                          </p>
                        </div>

                        {latestPlan && (
                          <p className="mt-3 text-xs text-emerald-300">
                            Latest saved plan: {latestPlan.title}
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <form action={sendToFactory}>
                            <input type="hidden" name="ideaId" value={idea.id} />
                            <input type="hidden" name="returnTo" value="/factory" />
                            <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500">
                              {latestPlan ? "Make New AI Plan" : "Make AI Plan"}
                            </button>
                          </form>

                          <Link
                            href="/"
                            className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
                          >
                            Go to Review Page
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
                <h2 className="text-xl font-semibold">Latest AI Plans</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  These are the newest plans created by the Factory Planner.
                </p>

                <div className="mt-5 space-y-4">
                  {latestPlans.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-sm">
                      <p className="font-semibold text-zinc-200">No AI plans saved yet</p>
                      <p className="mt-2 text-zinc-400">
                        Choose an idea from the left and run Make AI Plan. The newest plan will show up here for a quick read-through.
                      </p>
                    </div>
                  )}

                  {latestPlans.map((plan) => {
                    const requiredAssets = assetLines(plan.requiredAssets);

                    return (
                      <article
                        key={plan.id}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                      >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{plan.title}</h3>
                          <p className="mt-1 text-xs text-zinc-500">
                            From idea: {plan.idea.title}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(plan.status)}`}
                        >
                          {statusLabel(plan.status)}
                        </span>
                      </div>

                      <div className="mt-4 space-y-3 text-sm">
                        <section className="rounded-2xl bg-zinc-900 p-3">
                          <h4 className="font-semibold text-zinc-100">Summary</h4>
                          <p className="mt-2 text-zinc-300">{plan.summary}</p>
                        </section>

                        <section className="rounded-2xl bg-zinc-900 p-3">
                          <h4 className="font-semibold text-zinc-100">Main Concept</h4>
                          <p className="mt-2 whitespace-pre-wrap text-zinc-300">{plan.concept}</p>
                        </section>

                        <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="font-semibold text-cyan-100">What You Need</h4>
                            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-medium text-cyan-100">
                              {assetCountLabel(requiredAssets.length)}
                            </span>
                          </div>
                          {requiredAssets.length > 0 ? (
                            <ul className="mt-3 space-y-2 text-zinc-300">
                              {requiredAssets.map((asset) => (
                                <li key={asset} className="rounded-xl bg-zinc-950/70 px-3 py-2">
                                  {asset}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-3 text-zinc-400">
                              No required assets were listed for this plan.
                            </p>
                          )}
                        </section>

                        <section className="rounded-2xl bg-zinc-900 p-3">
                          <h4 className="font-semibold text-zinc-100">Risks</h4>
                          <pre className="mt-2 whitespace-pre-wrap text-zinc-400">
                            {plan.risks}
                          </pre>
                        </section>

                        <section className="rounded-2xl bg-zinc-900 p-3">
                          <h4 className="font-semibold text-zinc-100">Next Steps</h4>
                          <pre className="mt-2 whitespace-pre-wrap text-zinc-400">
                            {plan.nextActions}
                          </pre>
                        </section>
                      </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
