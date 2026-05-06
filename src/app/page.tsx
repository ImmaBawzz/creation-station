import Link from "next/link";
import { AppSidebar } from "@/app/components/AppSidebar";
import { FirstUseOnboarding } from "@/app/components/FirstUseOnboarding";
import { TaskBoard, type BoardTask, type TaskBoardQuery } from "@/app/components/TaskBoard";
import { assetCountLabel, assetLines } from "@/lib/asset-ui";
import { db } from "@/lib/db";
import { potentialLabel, statusBadgeClass, statusLabel } from "@/lib/status-ui";
import { TASK_LABELS } from "@/lib/task-labels";
import {
  approvePlan,
  archiveIdea,
  createIdea,
  requestRevision,
  sendToFactory,
} from "./actions";

type HomeProps = {
  searchParams?: Promise<{
    factoryError?: string;
    factorySuccess?: string;
    q?: string;
    status?: string;
    archived?: string;
    taskQ?: string;
    taskStatus?: string;
    taskPriority?: string;
    taskLabel?: string;
    taskView?: string;
  }>;
};

const ideaStatusFilters = [
  "ALL",
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

const taskStatusFilters = [
  "ALL",
  "TODO",
  "DOING",
  "BLOCKED",
  "BACKLOG",
  "DONE",
  "ARCHIVED",
];

const taskPriorityFilters = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const taskLabels = [
  "ALL",
  ...TASK_LABELS,
];

function cleanSearchParam(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function includesSearch(value: string | null, query: string): boolean {
  return (value ?? "").toLowerCase().includes(query);
}

function cleanTaskStatus(value: string | undefined): string {
  return taskStatusFilters.includes(value ?? "") ? value ?? "ALL" : "ALL";
}

function cleanTaskPriority(value: string | undefined): string {
  return taskPriorityFilters.includes(value ?? "") ? value ?? "ALL" : "ALL";
}

function cleanTaskLabel(value: string | undefined): string {
  return taskLabels.includes(value ?? "") ? value ?? "ALL" : "ALL";
}

function cleanTaskView(value: string | undefined): "all" | "focus" {
  return value === "focus" ? "focus" : "all";
}

function buildInboxHref({
  archived,
  q,
  status,
}: {
  archived?: boolean;
  q: string;
  status: string;
}): string {
  const params = new URLSearchParams();

  if (q) {
    params.set("q", q);
  }

  if (status !== "ALL") {
    params.set("status", status);
  }

  if (archived) {
    params.set("archived", "1");
  }

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export default async function Home({ searchParams }: HomeProps) {
  const messages = (await searchParams) ?? {};
  const searchQuery = cleanSearchParam(messages.q);
  const normalizedSearchQuery = searchQuery.toLowerCase();
  const selectedStatus = ideaStatusFilters.includes(messages.status ?? "")
    ? messages.status ?? "ALL"
    : "ALL";
  const showArchived = messages.archived === "1" || selectedStatus === "ARCHIVED";
  const taskBoardQuery: TaskBoardQuery = {
    q: searchQuery,
    status: selectedStatus,
    archived: showArchived,
    taskQ: cleanSearchParam(messages.taskQ),
    taskStatus: cleanTaskStatus(messages.taskStatus),
    taskPriority: cleanTaskPriority(messages.taskPriority),
    taskLabel: cleanTaskLabel(messages.taskLabel),
    taskView: cleanTaskView(messages.taskView),
  };
  const archiveToggleHref = showArchived
    ? buildInboxHref({
        archived: false,
        q: searchQuery,
        status: selectedStatus === "ARCHIVED" ? "ALL" : selectedStatus,
      })
    : buildInboxHref({
        archived: true,
        q: searchQuery,
        status: selectedStatus,
      });

  const ideas = await db.idea.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      plans: {
        orderBy: { createdAt: "desc" },
        include: {
          tasks: true,
        },
      },
    },
  });

  const filteredIdeas = ideas.filter((idea) => {
    if (!showArchived && idea.status === "ARCHIVED") {
      return false;
    }

    if (selectedStatus !== "ALL" && idea.status !== selectedStatus) {
      return false;
    }

    if (!normalizedSearchQuery) {
      return true;
    }

    return (
      includesSearch(idea.title, normalizedSearchQuery) ||
      includesSearch(idea.rawText, normalizedSearchQuery) ||
      includesSearch(idea.tags, normalizedSearchQuery) ||
      includesSearch(idea.summary, normalizedSearchQuery)
    );
  });

  const reviewPlans = await db.factoryPlan.findMany({
    where: {
      OR: [
        { status: "REVIEW_PENDING" },
        {
          status: "REVISION_REQUESTED",
          idea: {
            status: "NEEDS_REVISION",
          },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      idea: true,
      tasks: true,
    },
  });

  const tasks = await db.task.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      plan: {
        include: {
          idea: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-6 lg:grid-cols-[280px_1fr]">
        <AppSidebar
          active="inbox"
          title="Creation Station"
          subtitle="Idea Inbox -> Factory -> Review -> Tasks"
          showBackup
        />

        <section className="space-y-6">
          {messages.factoryError && (
            <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-100 shadow-2xl">
              <p className="font-semibold">Factory Planner problem</p>
              <p className="mt-2 text-red-100/90">{messages.factoryError}</p>
              <p className="mt-2 text-red-100/70">
                Tip: check Ollama, then try the button again.
              </p>
            </div>
          )}

          {messages.factorySuccess && (
            <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-sm text-emerald-100 shadow-2xl">
              <p className="font-semibold">Factory Planner ready</p>
              <p className="mt-2 text-emerald-100/90">{messages.factorySuccess}</p>
            </div>
          )}

          {ideas.length === 0 && <FirstUseOnboarding />}

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">New Idea</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Capture the raw spark before it disappears.
                </p>
              </div>

              <Link
                href="/factory"
                className="rounded-2xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-200 transition hover:border-blue-400 hover:bg-blue-500/20"
              >
                Open Factory Planner
              </Link>
            </div>

            <form action={createIdea} className="mt-5 grid gap-3">
              <input
                name="title"
                required
                placeholder="Idea title"
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-purple-500"
              />

              <textarea
                name="rawText"
                required
                placeholder="Write the raw idea here..."
                rows={5}
                className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-purple-500"
              />

              <div className="grid gap-3 md:grid-cols-2">
                <select
                  name="category"
                  className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-purple-500"
                >
                  <option>Music</option>
                  <option>Video</option>
                  <option>Film</option>
                  <option>Games</option>
                  <option>AI Systems</option>
                  <option>Visual Art</option>
                  <option>Product Ideas</option>
                  <option>Worldbuilding</option>
                  <option>Knowledge</option>
                </select>

                <input
                  name="tags"
                  placeholder="tags: ai, game, music, prototype"
                  className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-purple-500"
                />
              </div>

              <button className="rounded-2xl bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-500">
                Save to Inbox
              </button>
            </form>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">📥 Idea Inbox</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    {filteredIdeas.length} visible of {ideas.length} saved ideas
                  </p>
                </div>
                <Link
                  href={archiveToggleHref}
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-center text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
                >
                  {showArchived ? "Hide Archived" : "Show Archived"}
                </Link>
              </div>

              <form className="mt-5 grid min-w-0 gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  name="q"
                  defaultValue={searchQuery}
                  placeholder="Search title, raw text, tags, or summary"
                  className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-purple-500 sm:col-span-2"
                />
                <select
                  name="status"
                  defaultValue={selectedStatus}
                  className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-purple-500"
                >
                  {ideaStatusFilters.map((status) => (
                    <option key={status} value={status}>
                      {status === "ALL" ? "All statuses" : statusLabel(status)}
                    </option>
                  ))}
                </select>
                {showArchived && <input type="hidden" name="archived" value="1" />}
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:justify-end">
                  <button className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500 sm:min-w-28 sm:whitespace-nowrap">
                    Apply Filters
                  </button>
                  <Link
                    href="/"
                    className="rounded-xl bg-zinc-800 px-4 py-2 text-center text-sm font-semibold text-zinc-200 hover:bg-zinc-700 sm:min-w-24 sm:whitespace-nowrap"
                  >
                    Clear
                  </Link>
                </div>
              </form>

              <div className="mt-5 space-y-4">
                {filteredIdeas.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-sm">
                    <p className="font-semibold text-zinc-200">
                      {ideas.length === 0 ? "No ideas captured yet" : "No ideas match this view"}
                    </p>
                    <p className="mt-2 text-zinc-400">
                      {ideas.length === 0
                        ? "Use the New Idea form above to save the first spark, then send it to the Factory when it is ready for planning."
                        : "Adjust the search, status filter, or archived view toggle to widen the inbox."}
                    </p>
                  </div>
                )}

                {filteredIdeas.map((idea) => (
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

                    {idea.tags && (
                      <p className="mt-3 text-xs text-purple-300">
                        Tags: {idea.tags}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {idea.status === "RAW" && (
                        <form action={sendToFactory}>
                          <input type="hidden" name="ideaId" value={idea.id} />
                          <input type="hidden" name="returnTo" value="/" />
                          <button className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold hover:bg-blue-500">
                            Send to Factory
                          </button>
                        </form>
                      )}

                      {idea.status === "NEEDS_REVISION" && (
                        <form action={sendToFactory}>
                          <input type="hidden" name="ideaId" value={idea.id} />
                          <input type="hidden" name="returnTo" value="/" />
                          <button className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold hover:bg-orange-500">
                            Re-plan with Feedback
                          </button>
                        </form>
                      )}

                      {idea.status === "PLAN_READY" && (
                        <span
                          className={`rounded-xl border px-3 py-2 text-xs font-medium ${statusBadgeClass(idea.status)}`}
                        >
                          {statusLabel(idea.status)}
                        </span>
                      )}

                      {idea.status === "TASKED" && (
                        <span
                          className={`rounded-xl border px-3 py-2 text-xs font-medium ${statusBadgeClass(idea.status)}`}
                        >
                          {statusLabel(idea.status)}
                        </span>
                      )}

                      {idea.status !== "ARCHIVED" && (
                        <form action={archiveIdea}>
                          <input type="hidden" name="ideaId" value={idea.id} />
                          <button className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-semibold hover:bg-zinc-700">
                            Archive
                          </button>
                        </form>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
              <h2 className="text-xl font-semibold">🔍 Review Inbox</h2>

              <div className="mt-5 space-y-4">
                {reviewPlans.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-sm">
                    <p className="font-semibold text-zinc-200">No plans waiting for review</p>
                    <p className="mt-2 text-zinc-400">
                      Send an idea to the Factory to generate a plan. New plans will appear here for approval or revision.
                    </p>
                  </div>
                )}

                {reviewPlans.map((plan) => {
                  const requiredAssets = assetLines(plan.requiredAssets);

                  return (
                    <article
                      key={plan.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                    >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold">{plan.title}</h3>
                      <span
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(plan.status)}`}
                      >
                        {statusLabel(plan.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      From idea: {plan.idea.title}
                    </p>

                    <p className="mt-3 text-sm text-zinc-300">{plan.summary}</p>

                    <div className="mt-4 rounded-xl bg-zinc-900 p-3 text-sm text-zinc-300">
                      <strong>Concept:</strong>
                      <p className="mt-2">{plan.concept}</p>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-cyan-100">Required Assets</strong>
                          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-medium text-cyan-100">
                            {assetCountLabel(requiredAssets.length)}
                          </span>
                        </div>
                        {requiredAssets.length > 0 ? (
                          <ul className="mt-3 space-y-2 text-zinc-300">
                            {requiredAssets.map((asset) => (
                              <li key={asset} className="rounded-lg bg-zinc-950/70 px-3 py-2">
                                {asset}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 text-zinc-400">
                            No required assets were listed for this plan.
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl bg-zinc-900 p-3 text-xs">
                        <strong>Risks</strong>
                        <pre className="mt-2 whitespace-pre-wrap text-zinc-400">
                          {plan.risks}
                        </pre>
                      </div>
                    </div>

                    {plan.nextActions && (
                      <div className="mt-3 rounded-xl bg-zinc-900 p-3 text-xs">
                        <strong className="text-zinc-200">AI-Suggested Next Actions</strong>
                        <pre className="mt-2 whitespace-pre-wrap text-zinc-400">
                          {plan.nextActions}
                        </pre>
                      </div>
                    )}

                    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-xs text-zinc-300">
                      <p className="font-semibold text-zinc-100">Choose the next step</p>
                      <p className="mt-2 text-zinc-400">
                        Approve this plan if it is ready to become tasks. Request a revision if the next AI plan should use your notes and replace this draft.
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {plan.status !== "REVISION_REQUESTED" && (
                        <form action={approvePlan}>
                          <input type="hidden" name="planId" value={plan.id} />
                          <button className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold hover:bg-emerald-500">
                            Approve + Create Tasks
                          </button>
                        </form>
                      )}

                      {plan.status !== "REVISION_REQUESTED" && (
                        <form action={requestRevision} className="flex flex-col gap-2">
                          <input type="hidden" name="planId" value={plan.id} />
                          <p className="text-xs text-zinc-400">
                            Revision notes are saved with this plan and reused the next time you run the Factory for this idea.
                          </p>
                          <textarea
                            name="revisionNotes"
                            placeholder="Describe what should change in the next AI draft..."
                            rows={2}
                            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs outline-none focus:border-orange-500"
                          />
                          <button className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold hover:bg-orange-500">
                            Request Revision
                          </button>
                        </form>
                      )}

                      {plan.status === "REVISION_REQUESTED" && (
                        <div className="w-full space-y-2">
                          <p className="text-xs text-orange-300/80">
                            Revision requested. The current draft is on hold until you go to the Idea Inbox and click Re-plan with Feedback for this idea.
                          </p>
                          {plan.revisionNotes && (
                            <div className="rounded-xl bg-orange-500/10 p-3 text-xs text-orange-200">
                              <strong>Saved revision notes for the next AI plan:</strong>
                              <p className="mt-1 whitespace-pre-wrap">{plan.revisionNotes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>

          <TaskBoard query={taskBoardQuery} tasks={tasks as BoardTask[]} />
        </section>
      </div>
    </main>
  );
}
