import Link from "next/link";
import { AppSidebar } from "@/app/components/AppSidebar";
import { FirstUseOnboarding } from "@/app/components/FirstUseOnboarding";
import { TaskBoard, type BoardTask, type TaskBoardQuery } from "@/app/components/TaskBoard";
import { assetCountLabel, assetLines } from "@/lib/asset-ui";
import { orchestrateAutonomyGoal, type AutonomyPlan } from "@/lib/autonomy/orchestrator";
import { db } from "@/lib/db";
import {
  buildIntelligenceRecommendations,
  detectIdeaRoute,
  type IntelligenceRecommendation,
} from "@/lib/intelligence";
import {
  PIPELINE_FILTERS,
  pipelineDefinitionForKey,
  type PipelineFilter,
  type PipelineKey,
} from "@/lib/pipelines";
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
    taskPipeline?: string;
    taskProject?: string;
    taskView?: string;
    pipeline?: string;
    autonomyGoal?: string;
    autonomyRevision?: string;
    autonomyDecision?: string;
    autonomyApprovalToken?: string;
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

const recommendationToneClasses: Record<IntelligenceRecommendation["tone"], string> = {
  attention: "border-blue-500/25 bg-blue-500/10 text-blue-100",
  blocked: "border-rose-500/25 bg-rose-500/10 text-rose-100",
  priority: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  route: "border-violet-500/25 bg-violet-500/10 text-violet-100",
  stale: "border-amber-500/25 bg-amber-500/10 text-amber-100",
};

const routeBadgeClasses: Record<PipelineKey, string> = {
  game: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  general: "border-zinc-700 bg-zinc-900 text-zinc-300",
  music: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-100",
  automation: "border-blue-500/25 bg-blue-500/10 text-blue-100",
  visual: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
};

const ideaStageClasses: Record<string, string> = {
  Archived: "border-zinc-700 bg-zinc-900 text-zinc-400",
  Converted: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
  New: "border-zinc-700 bg-zinc-900 text-zinc-200",
  Reviewing: "border-blue-500/25 bg-blue-500/10 text-blue-100",
};

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

function cleanPipelineFilter(value: string | undefined): PipelineFilter {
  return PIPELINE_FILTERS.includes(value as PipelineFilter)
    ? (value as PipelineFilter)
    : "ALL";
}

function cleanTaskView(value: string | undefined): "all" | "focus" {
  return value === "focus" ? "focus" : "all";
}

function cleanAutonomyDecision(value: string | undefined): "approve" | "reject" | "" {
  return value === "approve" || value === "reject" ? value : "";
}

function ideaStage(status: string): "Archived" | "Converted" | "New" | "Reviewing" {
  if (status === "ARCHIVED") {
    return "Archived";
  }

  if (status === "TASKED" || status === "APPROVED") {
    return "Converted";
  }

  if (
    status === "IN_FACTORY" ||
    status === "NEEDS_REVISION" ||
    status === "PLAN_READY" ||
    status === "REVIEW_PENDING"
  ) {
    return "Reviewing";
  }

  return "New";
}

function IdeaRouteBadge({
  idea,
}: {
  idea: {
    category: string;
    rawText: string;
    tags: string;
    title: string;
  };
}) {
  const route = detectIdeaRoute(idea);

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${routeBadgeClasses[route.id]}`}
      title={route.reasons.length > 0 ? route.reasons.join(", ") : undefined}
    >
      {route.pipeline}
    </span>
  );
}

function AiRecommendationPanel({
  pipelineCounts,
  recommendations,
}: {
  pipelineCounts: Array<{
    count: number;
    pipeline: ReturnType<typeof pipelineDefinitionForKey>;
  }>;
  recommendations: IntelligenceRecommendation[];
}) {
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">AI Recommendations</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Current signals from ideas, reviews, blockers, and task age.
          </p>
        </div>
        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-medium text-zinc-300">
          {recommendations.length} signals
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {pipelineCounts.map(({ count, pipeline }) => (
          <span
            key={pipeline.key}
            className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-zinc-300"
          >
            {pipeline.label} <span className="text-zinc-500">{count}</span>
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {recommendations.map((recommendation) => (
          <Link
            key={recommendation.id}
            href={recommendation.href}
            className={`rounded-2xl border p-4 transition hover:border-zinc-500 ${recommendationToneClasses[recommendation.tone]}`}
          >
            <p className="font-semibold">{recommendation.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {recommendation.body}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function AutonomyValidationSummary({ plan }: { plan: AutonomyPlan }) {
  const issues = [
    ...plan.validation.duplicateTasks,
    ...plan.validation.duplicateExecutionAttempts,
    ...plan.validation.invalidTasks,
    ...plan.validation.invalidChains,
    ...plan.validation.unsafeExecutionRequests,
  ];

  if (issues.length === 0 && plan.stopPolicy.canContinue) {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
        Preview validation passed. The chain is read-only, ordered, and waiting for a human decision.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
      <p className="font-semibold">Preview needs attention</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-100/85">
        {issues.map((issue) => (
          <li key={`${issue.taskId}-${issue.reason}`}>
            {issue.taskId}: {issue.reason}
          </li>
        ))}
        {plan.stopPolicy.messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

function AutonomySimulationDashboard({ plan }: { plan: AutonomyPlan }) {
  const dashboard = plan.simulationDashboard;
  const dashboardStats = [
    { label: "Queued", value: dashboard.queuedTasks.length },
    { label: "Failed", value: dashboard.failedTasks.length },
    { label: "Blocked", value: dashboard.blockedTasks.length },
    { label: "Warnings", value: dashboard.validatorWarnings.length },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-semibold text-zinc-100">Simulation Dashboard</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Read-only simulation state derived from the current preview.
          </p>
        </div>
        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
          Stop reason: {dashboard.stopReason}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardStats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold text-zinc-100">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm">
          <p className="font-medium text-zinc-100">Current Task</p>
          <p className="mt-2 text-zinc-400">
            {dashboard.currentTask?.taskTitle ?? "No runnable simulated task selected"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm">
          <p className="font-medium text-zinc-100">Queued Tasks</p>
          <p className="mt-2 text-zinc-400">
            {dashboard.queuedTasks.length > 0
              ? dashboard.queuedTasks.map((task) => task.taskTitle).join(", ")
              : "No queued simulated tasks"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm">
          <p className="font-medium text-zinc-100">Failed Tasks</p>
          <p className="mt-2 text-zinc-400">
            {dashboard.failedTasks.length > 0
              ? dashboard.failedTasks.map((task) => task.taskTitle).join(", ")
              : "No simulated failures"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm">
          <p className="font-medium text-zinc-100">Blocked Tasks</p>
          <p className="mt-2 text-zinc-400">
            {dashboard.blockedTasks.length > 0
              ? dashboard.blockedTasks.map((task) => task.taskTitle).join(", ")
              : "No blocked simulated tasks"}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm">
        <p className="font-medium text-zinc-100">Validator Warnings</p>
        {dashboard.validatorWarnings.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-400">
            {dashboard.validatorWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-zinc-400">No validator warnings for this preview.</p>
        )}
      </div>
    </div>
  );
}

function ControlledExecutionPanel({ plan }: { plan: AutonomyPlan }) {
  const execution = plan.controlledExecution;
  const approvalQueue = execution.approvalQueue;
  const rollbackQueue = execution.rollbackQueue;
  const routeLabels = execution.executionRoutes.map((route) => route.route);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-semibold text-zinc-100">Controlled Execution Foundation</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Ledger, approval, rollback, and router state are simulated only.
          </p>
        </div>
        <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
          {execution.executionHistory.length} ledger entries
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          <p className="font-medium text-zinc-100">Execution History</p>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs text-zinc-400">
            {execution.executionHistory.map((entry) => (
              <div key={`${entry.runId}-${entry.taskId}`} className="rounded-lg bg-zinc-950 p-2">
                <p className="text-zinc-200">{entry.taskPayload.title}</p>
                <p>Approval: {entry.approvalState}</p>
                <p>Execution: {entry.executionState}</p>
                <p>Stop: {entry.stopEngineResult.stopReason}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          <p className="font-medium text-zinc-100">Approval Queue</p>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs text-zinc-400">
            {approvalQueue.length > 0 ? (
              approvalQueue.map((entry) => (
                <div key={entry.taskId} className="rounded-lg bg-zinc-950 p-2">
                  <p className="text-zinc-200">{entry.taskPayload.title}</p>
                  <p>Expires: {entry.approvalExpiresAt}</p>
                  <p>Token: {entry.approvalToken}</p>
                </div>
              ))
            ) : (
              <p>No pending approval items.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          <p className="font-medium text-zinc-100">Rollback Queue</p>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs text-zinc-400">
            {rollbackQueue.length > 0 ? (
              rollbackQueue.map((rollback) => (
                <div key={rollback.rollbackId} className="rounded-lg bg-zinc-950 p-2">
                  <p className="text-zinc-200">{rollback.status}</p>
                  <p>{rollback.message}</p>
                </div>
              ))
            ) : (
              <p>No rollback simulations queued.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          <p className="font-medium text-zinc-100">Execution Logs</p>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs text-zinc-400">
            {execution.executionLogs.map((log, index) => (
              <div key={`${log.event}-${log.taskId ?? index}`} className="rounded-lg bg-zinc-950 p-2">
                <p className="text-zinc-200">{log.event}</p>
                <p>{log.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
        Routes: {routeLabels.length > 0 ? routeLabels.join(", ") : "simulation"}
      </p>
    </div>
  );
}

function AutonomyPreviewMode({
  approvalToken,
  decision,
  goal,
  revision,
}: {
  approvalToken: string;
  decision: "approve" | "reject" | "";
  goal: string;
  revision: string;
}) {
  const plan = goal
    ? orchestrateAutonomyGoal({
        approvalDecision: decision,
        approvalToken,
        goal,
        revision,
      })
    : null;
  const nextApproval = plan?.controlledExecution.approvalQueue[0] ?? null;

  return (
    <section
      id="autonomy-preview"
      className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Autonomy Preview Mode</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Observer-mode planning only. Previews do not execute tasks or change production data.
          </p>
        </div>
        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-100">
          Observer only
        </span>
      </div>

      <form className="mt-5 grid gap-3">
        <label className="text-xs font-medium text-zinc-500" htmlFor="autonomy-goal">
          Goal
        </label>
        <textarea
          id="autonomy-goal"
          name="autonomyGoal"
          required
          defaultValue={goal}
          placeholder="Describe the high-level goal to preview..."
          rows={3}
          className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
        />
        <button className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500">
          Propose Execution Plan
        </button>
      </form>

      {decision && (
        <div
          className={
            decision === "approve"
              ? "mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-100"
              : "mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-100"
          }
        >
          {decision === "approve"
            ? "Preview approved for review tracking only. Observer mode still did not execute any tasks."
            : "Preview rejected. No task execution or production mutation occurred."}
        </div>
      )}

      {plan && (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-300">
                {plan.tasks.length} proposed tasks
              </span>
              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-300">
                Approval required
              </span>
              <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-300">
                Mutation risk: none
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">{plan.summary}</p>
            <p className="mt-2 text-xs text-zinc-500">Goal: {plan.goal}</p>
          </div>

          <AutonomyValidationSummary plan={plan} />

          <AutonomySimulationDashboard plan={plan} />

          <ControlledExecutionPanel plan={plan} />

          <div className="grid gap-3 lg:grid-cols-2">
            {plan.tasks.map((task) => (
              <article
                key={task.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-zinc-100">
                    {task.order}. {task.title}
                  </h3>
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300">
                    {task.action}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {task.description}
                </p>
                <p className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">
                  {task.expectedOutput}
                </p>
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="font-semibold text-zinc-100">Execution Preview</h3>
            <div className="mt-3 grid gap-2">
              {plan.executionPreview.map((preview) => (
                <div
                  key={preview.taskId}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300"
                >
                  <p className="font-medium text-zinc-100">{preview.taskTitle}</p>
                  <p className="mt-1 text-xs text-zinc-400">{preview.preview}</p>
                </div>
              ))}
            </div>
          </div>

          <details className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <summary className="cursor-pointer list-none font-semibold text-zinc-100">
              Structured Simulation Logs
            </summary>
            <div className="mt-3 grid gap-2">
              {plan.logs.map((log, index) => (
                <div
                  key={`${log.event}-${log.taskId ?? "run"}-${index}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300"
                >
                  <p className="font-semibold text-zinc-100">{log.event}</p>
                  <p className="mt-1">{log.message}</p>
                  {log.taskId && <p className="mt-1 text-zinc-500">Task: {log.taskId}</p>}
                </div>
              ))}
            </div>
          </details>

          <div className="grid gap-3 lg:grid-cols-[auto_auto_1fr]">
            <form>
              <input type="hidden" name="autonomyGoal" value={goal} />
              {revision && <input type="hidden" name="autonomyRevision" value={revision} />}
              {nextApproval && (
                <input
                  type="hidden"
                  name="autonomyApprovalToken"
                  value={nextApproval.approvalToken}
                />
              )}
              <button
                name="autonomyDecision"
                value="approve"
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold hover:bg-emerald-500"
              >
                Approve Preview
              </button>
            </form>
            <form>
              <input type="hidden" name="autonomyGoal" value={goal} />
              {revision && <input type="hidden" name="autonomyRevision" value={revision} />}
              <button
                name="autonomyDecision"
                value="reject"
                className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold hover:bg-rose-500"
              >
                Reject Preview
              </button>
            </form>
            <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input type="hidden" name="autonomyGoal" value={goal} />
              <textarea
                name="autonomyRevision"
                defaultValue={revision}
                placeholder="Revise the preview instructions..."
                rows={2}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <button className="rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700">
                Revise
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function buildInboxHref({
  archived,
  pipeline,
  q,
  status,
}: {
  archived?: boolean;
  pipeline: PipelineFilter;
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

  if (pipeline !== "ALL") {
    params.set("pipeline", pipeline);
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
  const selectedPipeline = cleanPipelineFilter(messages.pipeline);
  const autonomyGoal = cleanSearchParam(messages.autonomyGoal);
  const autonomyRevision = cleanSearchParam(messages.autonomyRevision);
  const autonomyDecision = cleanAutonomyDecision(messages.autonomyDecision);
  const autonomyApprovalToken = cleanSearchParam(messages.autonomyApprovalToken);
  const showArchived = messages.archived === "1" || selectedStatus === "ARCHIVED";
  const taskBoardQuery: TaskBoardQuery = {
    q: searchQuery,
    status: selectedStatus,
    archived: showArchived,
    taskQ: cleanSearchParam(messages.taskQ),
    taskStatus: cleanTaskStatus(messages.taskStatus),
    taskPriority: cleanTaskPriority(messages.taskPriority),
    taskLabel: cleanTaskLabel(messages.taskLabel),
    taskPipeline: cleanPipelineFilter(messages.taskPipeline),
    taskProject: cleanSearchParam(messages.taskProject) || "ALL",
    taskView: cleanTaskView(messages.taskView),
  };
  const archiveToggleHref = showArchived
    ? buildInboxHref({
        archived: false,
        pipeline: selectedPipeline,
        q: searchQuery,
        status: selectedStatus === "ARCHIVED" ? "ALL" : selectedStatus,
      })
    : buildInboxHref({
        archived: true,
        pipeline: selectedPipeline,
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
    const route = detectIdeaRoute(idea);

    if (!showArchived && idea.status === "ARCHIVED") {
      return false;
    }

    if (selectedStatus !== "ALL" && idea.status !== selectedStatus) {
      return false;
    }

    if (selectedPipeline !== "ALL" && route.id !== selectedPipeline) {
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
      blockers: true,
      plan: {
        include: {
          idea: true,
        },
      },
    },
  });
  const tasksWithPipeline = tasks.map((task) => ({
    ...task,
    plan: {
      ...task.plan,
      idea: {
        ...task.plan.idea,
        pipelineKey: detectIdeaRoute(task.plan.idea).id,
      },
    },
  }));
  const pipelineCounts = PIPELINE_FILTERS.filter(
    (pipeline): pipeline is PipelineKey => pipeline !== "ALL",
  ).map((pipelineKey) => ({
    count: ideas.filter((idea) => detectIdeaRoute(idea).id === pipelineKey).length,
    pipeline: pipelineDefinitionForKey(pipelineKey),
  }));
  const intelligenceRecommendations = buildIntelligenceRecommendations({
    ideas,
    reviewPlans,
    tasks: tasksWithPipeline,
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

          <AiRecommendationPanel
            pipelineCounts={pipelineCounts}
            recommendations={intelligenceRecommendations}
          />

          <AutonomyPreviewMode
            approvalToken={autonomyApprovalToken}
            decision={autonomyDecision}
            goal={autonomyGoal}
            revision={autonomyRevision}
          />

          <div
            id="new-idea"
            className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl"
          >
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
                  <h2 className="text-xl font-semibold">Idea Inbox</h2>
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

              <form className="mt-5 grid min-w-0 gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
                <div className="min-w-0">
                  <label className="text-xs font-medium text-zinc-500" htmlFor="idea-search">
                    Find ideas
                  </label>
                  <input
                    id="idea-search"
                    name="q"
                    defaultValue={searchQuery}
                    placeholder="Search title, raw text, tags, or summary"
                    className="mt-1 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-purple-500"
                  />
                </div>
                <div className="min-w-0">
                  <label className="text-xs font-medium text-zinc-500" htmlFor="idea-status">
                    Workflow state
                  </label>
                  <select
                    id="idea-status"
                    name="status"
                    defaultValue={selectedStatus}
                    className="mt-1 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-purple-500"
                  >
                    {ideaStatusFilters.map((status) => (
                      <option key={status} value={status}>
                        {status === "ALL" ? "All statuses" : statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs font-medium text-zinc-500" htmlFor="idea-pipeline">
                    Pipeline
                  </label>
                  <select
                    id="idea-pipeline"
                    name="pipeline"
                    defaultValue={selectedPipeline}
                    className="mt-1 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-purple-500"
                  >
                    <option value="ALL">All pipelines</option>
                    {pipelineCounts.map(({ pipeline }) => (
                      <option key={pipeline.key} value={pipeline.key}>
                        {pipeline.label}
                      </option>
                    ))}
                  </select>
                </div>
                {showArchived && <input type="hidden" name="archived" value="1" />}
                <div className="flex min-w-0 flex-col justify-end gap-2 sm:flex-row xl:flex-col">
                  <button className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500 xl:whitespace-nowrap">
                    Apply
                  </button>
                  <Link
                    href="/"
                    className="rounded-xl bg-zinc-800 px-4 py-2 text-center text-sm font-semibold text-zinc-200 hover:bg-zinc-700 xl:whitespace-nowrap"
                  >
                    Clear
                  </Link>
                </div>
              </form>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {pipelineCounts.map(({ count, pipeline }) => (
                  <Link
                    key={pipeline.key}
                    href={buildInboxHref({
                      archived: showArchived,
                      pipeline: pipeline.key,
                      q: searchQuery,
                      status: selectedStatus,
                    })}
                    className={
                      selectedPipeline === pipeline.key
                        ? "rounded-xl border border-violet-500/40 bg-violet-500/20 px-3 py-2 font-semibold text-violet-100"
                        : "rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-semibold text-zinc-300 hover:bg-zinc-800"
                    }
                  >
                    {pipeline.label} <span className="text-zinc-500">{count}</span>
                  </Link>
                ))}
              </div>

              <div className="mt-5 max-h-[72rem] space-y-3 overflow-y-auto pr-1">
                {filteredIdeas.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-sm">
                    <p className="font-semibold text-zinc-200">
                      {ideas.length === 0 ? "No ideas captured yet" : "No ideas match this view"}
                    </p>
                    <p className="mt-2 text-zinc-400">
                      {ideas.length === 0
                        ? "Capture your first idea above. That becomes the first project candidate once you send it to the Factory."
                        : "Adjust the search, status filter, or archived view toggle to widen the inbox."}
                    </p>
                  </div>
                )}

                {filteredIdeas.map((idea) => {
                  const stage = ideaStage(idea.status);
                  const planCount = idea.plans.length;
                  const taskCount = idea.plans.reduce(
                    (count, plan) => count + plan.tasks.length,
                    0,
                  );
                  const latestPlan = idea.plans[0] ?? null;

                  return (
                    <article
                      key={idea.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-zinc-700"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ideaStageClasses[stage]}`}
                            >
                              {stage}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusBadgeClass(idea.status)}`}
                            >
                              {statusLabel(idea.status)}
                            </span>
                            <IdeaRouteBadge idea={idea} />
                          </div>
                          <h3 className="mt-3 font-semibold leading-snug text-zinc-100">
                            {idea.title}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                            <span>{idea.category}</span>
                            <span>{planCount} plans</span>
                            <span>{taskCount} tasks</span>
                            <span>{potentialLabel(idea.potential)}</span>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                          {idea.status === "RAW" && (
                            <form action={sendToFactory}>
                              <input type="hidden" name="ideaId" value={idea.id} />
                              <input type="hidden" name="returnTo" value="/" />
                              <button className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold hover:bg-blue-500">
                                Convert in Factory
                              </button>
                            </form>
                          )}

                          {idea.status === "NEEDS_REVISION" && (
                            <form action={sendToFactory}>
                              <input type="hidden" name="ideaId" value={idea.id} />
                              <input type="hidden" name="returnTo" value="/" />
                              <button className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold hover:bg-orange-500">
                                Convert Revised Plan
                              </button>
                            </form>
                          )}

                          {idea.status === "PLAN_READY" && (
                            <Link
                              href="#review-inbox"
                              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold hover:bg-blue-500"
                            >
                              Review Plan
                            </Link>
                          )}

                          {idea.status === "TASKED" && (
                            <Link
                              href="#task-board"
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold hover:bg-emerald-500"
                            >
                              Open Tasks
                            </Link>
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
                      </div>

                      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-300">
                        {idea.rawText}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        {idea.tags && (
                          <span className="rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-1 text-purple-200">
                            {idea.tags}
                          </span>
                        )}
                        {latestPlan && (
                          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-400">
                            Latest plan: {statusLabel(latestPlan.status)}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div
              id="review-inbox"
              className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl"
            >
              <h2 className="text-xl font-semibold">🔍 Review Inbox</h2>

              <div className="mt-5 space-y-4">
                {reviewPlans.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/70 p-4 text-sm">
                    <p className="font-semibold text-zinc-200">No project plans waiting for review</p>
                    <p className="mt-2 text-zinc-400">
                      Convert your first idea in the Factory to create a project plan. New plans appear here for approval or revision before they become tasks.
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

          <TaskBoard query={taskBoardQuery} tasks={tasksWithPipeline as BoardTask[]} />
        </section>
      </div>
    </main>
  );
}
