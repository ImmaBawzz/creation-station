import type { AnalyticsSummary } from "@/lib/analytics";

type AnalyticsOverviewProps = {
  summary: AnalyticsSummary;
};

function eventLabel(eventType: string): string {
  return eventType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AnalyticsOverview({ summary }: AnalyticsOverviewProps) {
  const metrics = [
    { label: "Tasks Created", value: summary.tasksCreated },
    { label: "Completion Rate", value: `${summary.completionRate}%` },
    { label: "Ideas Converted", value: summary.ideasConverted },
    { label: "Projects Created", value: summary.projectsCreated },
    { label: "Backups Created", value: summary.backupsCreated },
    { label: "Backups Imported", value: summary.backupsImported },
  ];

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Local Analytics</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Internal workspace signals stored locally on this machine. No external
            analytics, accounts, tracking pixels, or cloud services are used.
          </p>
        </div>
        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-medium text-zinc-300">
          {summary.totalEvents} events kept
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-sm text-zinc-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-sm text-zinc-500">Onboarding</p>
          <p className="mt-2 text-xl font-semibold capitalize text-zinc-100">
            {summary.onboardingState.replace("_", " ")}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Last event: {summary.lastEventAt ?? "none recorded"}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-zinc-100">Recent Events</h3>
            <span className="text-xs text-zinc-500">last 8</span>
          </div>
          <div className="mt-3 space-y-2">
            {summary.recentEvents.length === 0 && (
              <p className="rounded-xl border border-dashed border-zinc-800 p-3 text-sm text-zinc-500">
                Events will appear here after normal workspace actions.
              </p>
            )}
            {summary.recentEvents.map((event) => (
              <div
                key={`${event.timestamp}-${event.eventType}`}
                className="flex flex-col gap-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-zinc-200">
                  {eventLabel(event.eventType)}
                </span>
                <span className="text-xs text-zinc-500">{event.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
