import Link from "next/link";

import { AppSidebar } from "@/app/components/AppSidebar";
import { db } from "@/lib/db";
import { statusBadgeClass, statusLabel } from "@/lib/status-ui";

export const dynamic = "force-dynamic";

const ideaStatusOrder = [
  "RAW",
  "TRIAGED",
  "IN_FACTORY",
  "PLAN_READY",
  "REVIEW_PENDING",
  "APPROVED",
  "NEEDS_REVISION",
  "TASKED",
  "IN_PRODUCTION",
  "ASSET_READY",
  "PUBLISHED",
  "ARCHIVED",
];

const taskStatusOrder = ["TODO", "DOING", "BLOCKED", "DONE"];

function countByStatus(items: { status: string }[]): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
}

function orderedStatuses(
  preferredOrder: string[],
  counts: Record<string, number>,
): string[] {
  const extras = Object.keys(counts).filter(
    (status) => !preferredOrder.includes(status),
  );

  return [...preferredOrder, ...extras].filter((status) => counts[status] > 0);
}

export default async function DashboardPage() {
  const [ideas, plansWaitingReview, recentlyApprovedPlans, tasks, recentTasks] =
    await Promise.all([
      db.idea.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.factoryPlan.count({
        where: { status: "REVIEW_PENDING" },
      }),
      db.factoryPlan.findMany({
        where: { status: "APPROVED" },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: { idea: true },
      }),
      db.task.findMany({
        orderBy: { createdAt: "desc" },
      }),
      db.task.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          plan: {
            include: {
              idea: true,
            },
          },
        },
      }),
    ]);

  const totalIdeas = await db.idea.count();
  const allIdeas = await db.idea.findMany({
    select: { status: true },
  });
  const ideaCounts = countByStatus(allIdeas);
  const taskCounts = countByStatus(tasks);
  const visibleIdeaStatuses = orderedStatuses(ideaStatusOrder, ideaCounts);
  const visibleTaskStatuses = orderedStatuses(taskStatusOrder, taskCounts);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-6 lg:grid-cols-[280px_1fr]">
        <AppSidebar
          active="dashboard"
          title="Dashboard"
          subtitle="Overview of the local Creation Station pipeline."
          showBackup
        />

        <section className="space-y-6">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Command Overview</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Current counts and recent activity from the existing local database.
                </p>
              </div>
              <Link
                href="/"
                className="rounded-2xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-200 transition hover:border-blue-400 hover:bg-blue-500/20"
              >
                Open Inbox
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="text-sm text-zinc-400">Total Ideas</p>
              <p className="mt-3 text-4xl font-bold">{totalIdeas}</p>
            </section>

            <section className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
              <p className="text-sm text-blue-100/80">Plans Waiting Review</p>
              <p className="mt-3 text-4xl font-bold text-blue-100">
                {plansWaitingReview}
              </p>
            </section>

            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
              <p className="text-sm text-emerald-100/80">Total Tasks</p>
              <p className="mt-3 text-4xl font-bold text-emerald-100">
                {tasks.length}
              </p>
            </section>

            <section className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-5">
              <p className="text-sm text-orange-100/80">Needs Revision</p>
              <p className="mt-3 text-4xl font-bold text-orange-100">
                {ideaCounts.NEEDS_REVISION ?? 0}
              </p>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
              <h2 className="text-xl font-semibold">Ideas by Status</h2>
              <div className="mt-5 space-y-3">
                {visibleIdeaStatuses.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-sm text-zinc-400">
                    No ideas have been captured yet.
                  </p>
                )}
                {visibleIdeaStatuses.map((status) => (
                  <div
                    key={status}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-950 p-3"
                  >
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(status)}`}
                    >
                      {statusLabel(status)}
                    </span>
                    <span className="text-sm font-semibold">
                      {ideaCounts[status]}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
              <h2 className="text-xl font-semibold">Tasks by Status</h2>
              <div className="mt-5 space-y-3">
                {visibleTaskStatuses.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-sm text-zinc-400">
                    No tasks have been created yet.
                  </p>
                )}
                {visibleTaskStatuses.map((status) => (
                  <div
                    key={status}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-950 p-3"
                  >
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(status)}`}
                    >
                      {statusLabel(status)}
                    </span>
                    <span className="text-sm font-semibold">
                      {taskCounts[status]}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
              <h2 className="text-xl font-semibold">Recently Created Ideas</h2>
              <div className="mt-5 space-y-3">
                {ideas.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-sm text-zinc-400">
                    New ideas will appear here.
                  </p>
                )}
                {ideas.map((idea) => (
                  <article key={idea.id} className="rounded-2xl bg-zinc-950 p-4">
                    <p className="font-semibold">{idea.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{idea.category}</p>
                    <span
                      className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(idea.status)}`}
                    >
                      {statusLabel(idea.status)}
                    </span>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
              <h2 className="text-xl font-semibold">Recently Approved Plans</h2>
              <div className="mt-5 space-y-3">
                {recentlyApprovedPlans.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-sm text-zinc-400">
                    Approved plans will appear here after review.
                  </p>
                )}
                {recentlyApprovedPlans.map((plan) => (
                  <article key={plan.id} className="rounded-2xl bg-zinc-950 p-4">
                    <p className="font-semibold">{plan.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      From idea: {plan.idea.title}
                    </p>
                    <p className="mt-3 line-clamp-3 text-sm text-zinc-400">
                      {plan.summary}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
              <h2 className="text-xl font-semibold">Recently Created Tasks</h2>
              <div className="mt-5 space-y-3">
                {recentTasks.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-sm text-zinc-400">
                    New tasks will appear here after plan approval.
                  </p>
                )}
                {recentTasks.map((task) => (
                  <article key={task.id} className="rounded-2xl bg-zinc-950 p-4">
                    <p className="font-semibold">{task.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {task.plan.idea.title}
                    </p>
                    <span
                      className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(task.status)}`}
                    >
                      {statusLabel(task.status)}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
