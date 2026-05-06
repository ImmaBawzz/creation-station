const STATUS_LABELS: Record<string, string> = {
  RAW: "Raw Idea",
  TRIAGED: "Triaged",
  IN_FACTORY: "In Factory",
  PLAN_READY: "Plan Ready",
  REVIEW_PENDING: "Awaiting Review",
  APPROVED: "Approved",
  NEEDS_REVISION: "Needs Revision",
  REVISION_REQUESTED: "Revision Requested",
  TASKED: "Tasks Created",
  IN_PRODUCTION: "In Production",
  ASSET_READY: "Assets Ready",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
  TODO: "To Do",
  DOING: "Doing",
  BLOCKED: "Blocked",
  BACKLOG: "Backlog",
  DONE: "Done",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  RAW: "border-zinc-700/80 bg-zinc-800/80 text-zinc-200",
  TRIAGED: "border-sky-500/30 bg-sky-500/15 text-sky-200",
  IN_FACTORY: "border-violet-500/30 bg-violet-500/15 text-violet-200",
  PLAN_READY: "border-blue-500/30 bg-blue-500/15 text-blue-200",
  REVIEW_PENDING: "border-blue-500/30 bg-blue-500/15 text-blue-200",
  APPROVED: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
  NEEDS_REVISION: "border-orange-500/30 bg-orange-500/15 text-orange-200",
  REVISION_REQUESTED: "border-orange-500/30 bg-orange-500/15 text-orange-200",
  TASKED: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
  IN_PRODUCTION: "border-cyan-500/30 bg-cyan-500/15 text-cyan-200",
  ASSET_READY: "border-teal-500/30 bg-teal-500/15 text-teal-200",
  PUBLISHED: "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-200",
  ARCHIVED: "border-zinc-700/80 bg-zinc-800/80 text-zinc-400",
  TODO: "border-zinc-700/80 bg-zinc-800/80 text-zinc-200",
  DOING: "border-sky-500/30 bg-sky-500/15 text-sky-200",
  BLOCKED: "border-rose-500/30 bg-rose-500/15 text-rose-200",
  BACKLOG: "border-amber-500/30 bg-amber-500/15 text-amber-200",
  DONE: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
};

const POTENTIAL_LABELS: Record<string, string> = {
  UNKNOWN: "Unscored",
  SMALL: "Small",
  MEDIUM: "Medium",
  LARGE: "Large",
  MASSIVE: "Massive",
};

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? toTitleCase(status);
}

export function statusBadgeClass(status: string): string {
  return (
    STATUS_BADGE_CLASSES[status] ??
    "border-zinc-700/80 bg-zinc-800/80 text-zinc-200"
  );
}

export function potentialLabel(potential: string): string {
  return POTENTIAL_LABELS[potential] ?? toTitleCase(potential);
}
