import Link from "next/link";

import { updateTaskStatus } from "@/app/actions";
import { assetCountLabel, assetLines } from "@/lib/asset-ui";
import { statusBadgeClass, statusLabel } from "@/lib/status-ui";

const taskEmptyStateCopy: Record<string, string> = {
  Active:
    "Approved plans create active tasks here first. Approve a plan in Review Inbox to fill this section.",
  Backlog:
    "No deferred tasks yet. Move tasks here when they are valid but not immediate.",
  Completed: "Completed tasks collect here when work is finished.",
  Archived: "Archived tasks stay out of the active board without being deleted.",
};

const taskBoardSections = [
  {
    title: "Active",
    statuses: ["TODO", "DOING", "BLOCKED"],
    description: "Immediate work from approved plans.",
    defaultOpen: true,
  },
  {
    title: "Backlog",
    statuses: ["BACKLOG"],
    description: "Valid work parked for later.",
    defaultOpen: true,
  },
  {
    title: "Completed",
    statuses: ["DONE"],
    description: "Finished work kept for reference.",
    defaultOpen: false,
  },
  {
    title: "Archived",
    statuses: ["ARCHIVED"],
    description: "Hidden or obsolete work preserved locally.",
    defaultOpen: false,
  },
] as const;

const taskGroupSections = [
  { title: "Intake / New", defaultOpen: true },
  { title: "Validation", defaultOpen: true },
  { title: "Planning", defaultOpen: true },
  { title: "Build", defaultOpen: false },
  { title: "Assets Needed", defaultOpen: false },
  { title: "Release Prep", defaultOpen: false },
  { title: "Other", defaultOpen: false },
] as const;

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
const focusStatuses = new Set(["TODO", "DOING", "BLOCKED"]);

type TaskGroupTitle = (typeof taskGroupSections)[number]["title"];
type TaskView = "all" | "focus";

export type BoardTask = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  plan: {
    title: string;
    requiredAssets: string;
    idea: {
      title: string;
      category: string;
      tags: string;
    };
  };
};

export type TaskBoardQuery = {
  q: string;
  status: string;
  archived: boolean;
  taskQ: string;
  taskStatus: string;
  taskPriority: string;
  taskLabel: string;
  taskView: TaskView;
};

function includesSearch(value: string | null, query: string): boolean {
  return (value ?? "").toLowerCase().includes(query);
}

function textIncludesAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function getTaskGroup(task: BoardTask): TaskGroupTitle {
  const searchableText = `${task.title} ${task.description}`.toLowerCase();

  if (textIncludesAny(searchableText, ["capture", "idea", "raw"])) {
    return "Intake / New";
  }

  if (textIncludesAny(searchableText, ["test", "validate", "feedback", "mvp"])) {
    return "Validation";
  }

  if (textIncludesAny(searchableText, ["brief", "plan", "scope", "define"])) {
    return "Planning";
  }

  if (textIncludesAny(searchableText, ["build", "create", "implement", "prototype"])) {
    return "Build";
  }

  if (textIncludesAny(searchableText, ["asset", "reference", "template", "notes"])) {
    return "Assets Needed";
  }

  if (textIncludesAny(searchableText, ["release", "checklist", "polish", "v1"])) {
    return "Release Prep";
  }

  return "Other";
}

function groupTasksBySection(tasks: BoardTask[]): Record<TaskGroupTitle, BoardTask[]> {
  const groupedTasks = taskGroupSections.reduce(
    (groups, section) => ({
      ...groups,
      [section.title]: [],
    }),
    {} as Record<TaskGroupTitle, BoardTask[]>,
  );

  for (const task of tasks) {
    groupedTasks[getTaskGroup(task)].push(task);
  }

  return groupedTasks;
}

function taskBelongsToSection(
  task: BoardTask,
  section: (typeof taskBoardSections)[number],
): boolean {
  if (section.title === "Active") {
    return focusStatuses.has(task.status);
  }

  return (section.statuses as readonly string[]).includes(task.status);
}

function taskMatchesSearch(task: BoardTask, query: string): boolean {
  if (!query) {
    return true;
  }

  return (
    includesSearch(task.title, query) ||
    includesSearch(task.description, query) ||
    includesSearch(task.status, query) ||
    includesSearch(task.priority, query) ||
    includesSearch(task.plan.title, query) ||
    includesSearch(task.plan.requiredAssets, query) ||
    includesSearch(task.plan.idea.title, query) ||
    includesSearch(task.plan.idea.category, query) ||
    includesSearch(task.plan.idea.tags, query)
  );
}

function buildTaskHref(query: TaskBoardQuery, overrides: Partial<TaskBoardQuery>): string {
  const nextQuery = { ...query, ...overrides };
  const params = new URLSearchParams();

  if (nextQuery.q) {
    params.set("q", nextQuery.q);
  }

  if (nextQuery.status !== "ALL") {
    params.set("status", nextQuery.status);
  }

  if (nextQuery.archived) {
    params.set("archived", "1");
  }

  if (nextQuery.taskQ) {
    params.set("taskQ", nextQuery.taskQ);
  }

  if (nextQuery.taskStatus !== "ALL") {
    params.set("taskStatus", nextQuery.taskStatus);
  }

  if (nextQuery.taskPriority !== "ALL") {
    params.set("taskPriority", nextQuery.taskPriority);
  }

  if (nextQuery.taskLabel !== "ALL") {
    params.set("taskLabel", nextQuery.taskLabel);
  }

  if (nextQuery.taskView !== "all") {
    params.set("taskView", nextQuery.taskView);
  }

  const serialized = params.toString();
  return serialized ? `/?${serialized}#task-board` : "/#task-board";
}

function TaskStatusButton({
  children,
  status,
  taskId,
}: {
  children: string;
  status: string;
  taskId: string;
}) {
  return (
    <form action={updateTaskStatus}>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="nextStatus" value={status} />
      <button className="rounded-lg bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-700">
        {children}
      </button>
    </form>
  );
}

function TaskCard({ task }: { task: BoardTask }) {
  const requiredAssets = assetLines(task.plan.requiredAssets);
  const previewAssets = requiredAssets.slice(0, 2);
  const taskGroup = getTaskGroup(task);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-snug text-zinc-100">{task.title}</p>
          <p className="mt-1 text-xs text-zinc-500">{task.plan.idea.title}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(task.status)}`}
        >
          {statusLabel(task.status)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
          {task.priority}
        </span>
        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
          {taskGroup}
        </span>
      </div>
      {task.description && (
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-400">
          {task.description}
        </p>
      )}
      {requiredAssets.length > 0 && (
        <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2 text-xs">
          <p className="font-medium text-cyan-100">
            {assetCountLabel(requiredAssets.length)}
          </p>
          <p className="mt-1 text-zinc-400">
            {previewAssets.join(" | ")}
            {requiredAssets.length > previewAssets.length
              ? ` +${requiredAssets.length - previewAssets.length} more`
              : ""}
          </p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {task.status !== "TODO" && task.status !== "DOING" && task.status !== "BLOCKED" && (
          <TaskStatusButton taskId={task.id} status="TODO">
            Move Active
          </TaskStatusButton>
        )}
        {task.status !== "BACKLOG" && (
          <TaskStatusButton taskId={task.id} status="BACKLOG">
            Backlog
          </TaskStatusButton>
        )}
        {task.status !== "DONE" && (
          <TaskStatusButton taskId={task.id} status="DONE">
            Mark Done
          </TaskStatusButton>
        )}
        {task.status !== "ARCHIVED" && (
          <TaskStatusButton taskId={task.id} status="ARCHIVED">
            Archive
          </TaskStatusButton>
        )}
      </div>
    </div>
  );
}

function TaskSection({
  query,
  section,
  tasks,
}: {
  query: TaskBoardQuery;
  section: (typeof taskBoardSections)[number];
  tasks: BoardTask[];
}) {
  const groupedActiveTasks =
    section.title === "Active" ? groupTasksBySection(tasks) : null;

  return (
    <details
      id={`task-section-${section.title.toLowerCase()}`}
      open={section.defaultOpen || undefined}
      className="group rounded-2xl border border-zinc-800 bg-zinc-950"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-4 transition hover:bg-zinc-900">
        <div className="min-w-0">
          <h3 className="font-semibold">{section.title}</h3>
          <p className="mt-1 text-xs text-zinc-500">{section.description}</p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-zinc-700/80 bg-zinc-800/80 px-3 py-1 text-xs font-medium text-zinc-200">
            {tasks.length}
          </span>
          <span className="text-xs text-zinc-500 transition group-open:rotate-90">
            &gt;
          </span>
        </span>
      </summary>

      <div className="space-y-3 border-t border-zinc-800 p-4">
        {tasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/70 p-3 text-sm text-zinc-400">
            {query.taskQ || query.taskStatus !== "ALL" || query.taskPriority !== "ALL" || query.taskLabel !== "ALL"
              ? "No tasks match the current task filters in this section."
              : taskEmptyStateCopy[section.title]}
          </div>
        )}

        {section.title === "Active" && groupedActiveTasks && tasks.length > 0
          ? taskGroupSections.map((taskGroup) => {
              const sectionTasks = groupedActiveTasks[taskGroup.title];

              if (sectionTasks.length === 0) {
                return null;
              }

              return (
                <details
                  key={taskGroup.title}
                  open={taskGroup.defaultOpen || undefined}
                  className="group/task rounded-xl border border-zinc-800 bg-zinc-900/50"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800/80">
                    <span className="min-w-0">{taskGroup.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs font-medium text-zinc-300">
                        {sectionTasks.length}
                      </span>
                      <span className="text-xs text-zinc-500 transition group-open/task:rotate-90">
                        &gt;
                      </span>
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-zinc-800 p-3">
                    {sectionTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                </details>
              );
            })
          : tasks.map((task) => <TaskCard key={task.id} task={task} />)}
      </div>
    </details>
  );
}

export function TaskBoard({
  query,
  tasks,
}: {
  query: TaskBoardQuery;
  tasks: BoardTask[];
}) {
  const normalizedTaskQuery = query.taskQ.toLowerCase();
  const filteredTasks = tasks.filter((task) => {
    if (query.taskView === "focus" && !focusStatuses.has(task.status)) {
      return false;
    }

    if (query.taskStatus !== "ALL" && task.status !== query.taskStatus) {
      return false;
    }

    if (query.taskPriority !== "ALL" && task.priority !== query.taskPriority) {
      return false;
    }

    if (query.taskLabel !== "ALL" && getTaskGroup(task) !== query.taskLabel) {
      return false;
    }

    return taskMatchesSearch(task, normalizedTaskQuery);
  });

  const activeCount = tasks.filter((task) => focusStatuses.has(task.status)).length;
  const backlogCount = tasks.filter((task) => task.status === "BACKLOG").length;
  const completedCount = tasks.filter((task) => task.status === "DONE").length;
  const archivedCount = tasks.filter((task) => task.status === "ARCHIVED").length;
  const visibleSections =
    query.taskView === "focus"
      ? taskBoardSections.filter((section) => section.title === "Active")
      : taskBoardSections;

  return (
    <div
      id="task-board"
      className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Task Board</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Tasks are separated into active work, backlog, completed work, and archived work.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <a
            href="#task-section-active"
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-300 hover:bg-zinc-800"
          >
            Active <span className="font-semibold text-zinc-100">{activeCount}</span>
          </a>
          <a
            href="#task-section-backlog"
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-300 hover:bg-zinc-800"
          >
            Backlog <span className="font-semibold text-zinc-100">{backlogCount}</span>
          </a>
          <a
            href="#task-section-completed"
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-300 hover:bg-zinc-800"
          >
            Done <span className="font-semibold text-zinc-100">{completedCount}</span>
          </a>
          <a
            href="#task-section-archived"
            className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-300 hover:bg-zinc-800"
          >
            Archived <span className="font-semibold text-zinc-100">{archivedCount}</span>
          </a>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <Link
          href={buildTaskHref(query, { taskView: "focus" })}
          className={
            query.taskView === "focus"
              ? "rounded-xl border border-blue-500/40 bg-blue-500/20 px-3 py-2 font-semibold text-blue-100"
              : "rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-semibold text-zinc-300 hover:bg-zinc-800"
          }
        >
          Focus View
        </Link>
        <Link
          href={buildTaskHref(query, { taskView: "all" })}
          className={
            query.taskView === "all"
              ? "rounded-xl border border-blue-500/40 bg-blue-500/20 px-3 py-2 font-semibold text-blue-100"
              : "rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-semibold text-zinc-300 hover:bg-zinc-800"
          }
        >
          All Tasks
        </Link>
      </div>

      <form className="mt-4 grid min-w-0 gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto]">
        {query.q && <input type="hidden" name="q" value={query.q} />}
        {query.status !== "ALL" && (
          <input type="hidden" name="status" value={query.status} />
        )}
        {query.archived && <input type="hidden" name="archived" value="1" />}
        {query.taskView !== "all" && (
          <input type="hidden" name="taskView" value={query.taskView} />
        )}
        <input
          name="taskQ"
          defaultValue={query.taskQ}
          placeholder="Search tasks, plans, ideas, assets, or tags"
          className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-purple-500"
        />
        <select
          name="taskStatus"
          defaultValue={query.taskStatus}
          className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-purple-500"
        >
          {taskStatusFilters.map((status) => (
            <option key={status} value={status}>
              {status === "ALL" ? "All task statuses" : statusLabel(status)}
            </option>
          ))}
        </select>
        <select
          name="taskPriority"
          defaultValue={query.taskPriority}
          className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-purple-500"
        >
          {taskPriorityFilters.map((priority) => (
            <option key={priority} value={priority}>
              {priority === "ALL" ? "All priorities" : priority}
            </option>
          ))}
        </select>
        <select
          name="taskLabel"
          defaultValue={query.taskLabel}
          className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-purple-500"
        >
          <option value="ALL">All labels</option>
          {taskGroupSections.map((section) => (
            <option key={section.title} value={section.title}>
              {section.title}
            </option>
          ))}
        </select>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row lg:justify-end">
          <button className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500 lg:whitespace-nowrap">
            Apply
          </button>
          <Link
            href={buildTaskHref(query, {
              taskQ: "",
              taskStatus: "ALL",
              taskPriority: "ALL",
              taskLabel: "ALL",
              taskView: "all",
            })}
            className="rounded-xl bg-zinc-800 px-4 py-2 text-center text-sm font-semibold text-zinc-200 hover:bg-zinc-700 lg:whitespace-nowrap"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1">
          {filteredTasks.length} visible of {tasks.length} tasks
        </span>
        {query.taskView === "focus" && (
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-blue-100">
            Showing active work only
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {visibleSections.map((section) => {
          const tasksForSection = filteredTasks.filter((task) =>
            taskBelongsToSection(task, section),
          );

          return (
            <TaskSection
              key={section.title}
              query={query}
              section={section}
              tasks={tasksForSection}
            />
          );
        })}
      </div>
    </div>
  );
}
