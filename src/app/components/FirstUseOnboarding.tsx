import Link from "next/link";

export function FirstUseOnboarding() {
  return (
    <section className="rounded-3xl border border-blue-500/30 bg-blue-500/10 p-6 shadow-2xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-blue-200">
            First use
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Start with one raw idea</h2>
          <p className="mt-2 max-w-3xl text-sm text-blue-100/80">
            Creation Station is built for a solo creator loop: capture one idea,
            turn it into a Factory plan, review or revise it, then approve it into
            tasks.
          </p>
        </div>
        <Link
          href="/settings"
          className="rounded-2xl border border-blue-400/40 bg-blue-500/20 px-4 py-3 text-center text-sm font-semibold text-blue-100 transition hover:bg-blue-500/30"
        >
          Check AI Setup
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[
          "Capture a clear title and raw notes.",
          "Run the Factory Planner from Inbox or Factory.",
          "Review the plan, then revise or approve.",
          "Use generated tasks as the first execution board.",
        ].map((step, index) => (
          <div key={step} className="rounded-2xl bg-zinc-950/70 p-4">
            <p className="text-xs font-semibold text-blue-200">Step {index + 1}</p>
            <p className="mt-2 text-sm text-zinc-200">{step}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
