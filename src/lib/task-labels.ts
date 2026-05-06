export const TASK_LABELS = [
  "Intake / New",
  "Validation",
  "Planning",
  "Build",
  "Assets Needed",
  "Release Prep",
  "Other",
] as const;

export type TaskLabel = (typeof TASK_LABELS)[number];

const taskLabelSet = new Set<string>(TASK_LABELS);

export type TaskMetadata = {
  blockedByTaskIds: string[];
  labels: TaskLabel[];
};

function textIncludesAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function normalizeExplicitLabels(labels: string[]): TaskLabel[] {
  const normalized: TaskLabel[] = [];

  for (const label of labels) {
    const cleanLabel = label.trim();

    if (taskLabelSet.has(cleanLabel) && !normalized.includes(cleanLabel as TaskLabel)) {
      normalized.push(cleanLabel as TaskLabel);
    }
  }

  return normalized;
}

function normalizeLabels(labels: string[]): TaskLabel[] {
  const normalized = normalizeExplicitLabels(labels);

  return normalized.length > 0 ? normalized : ["Other"];
}

function normalizeTaskIds(taskIds: string[]): string[] {
  const normalized: string[] = [];

  for (const taskId of taskIds) {
    const cleanTaskId = taskId.trim();

    if (cleanTaskId && !normalized.includes(cleanTaskId)) {
      normalized.push(cleanTaskId);
    }
  }

  return normalized;
}

function parseTaskMetadataObject(value: unknown): TaskMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      blockedByTaskIds: [],
      labels: [],
    };
  }

  const metadata = value as {
    blockedByTaskIds?: unknown;
    labels?: unknown;
  };

  const labels = Array.isArray(metadata.labels)
    ? normalizeExplicitLabels(
        metadata.labels.filter((label): label is string => typeof label === "string"),
      )
    : [];
  const blockedByTaskIds = Array.isArray(metadata.blockedByTaskIds)
    ? normalizeTaskIds(
        metadata.blockedByTaskIds.filter(
          (taskId): taskId is string => typeof taskId === "string",
        ),
      )
    : [];

  return {
    blockedByTaskIds,
    labels,
  };
}

export function serializeTaskLabels(labels: string[]): string {
  return JSON.stringify(normalizeLabels(labels));
}

export function serializeTaskMetadata(metadata: TaskMetadata): string {
  const labels = normalizeExplicitLabels(metadata.labels);
  const blockedByTaskIds = normalizeTaskIds(metadata.blockedByTaskIds);

  if (blockedByTaskIds.length === 0) {
    return labels.length > 0 ? JSON.stringify(labels) : "";
  }

  return JSON.stringify({
    blockedByTaskIds,
    labels,
  });
}

export function parseTaskMetadata(labels: string | null | undefined): TaskMetadata {
  const cleanLabels = labels?.trim() ?? "";

  if (!cleanLabels) {
    return {
      blockedByTaskIds: [],
      labels: [],
    };
  }

  try {
    const parsed = JSON.parse(cleanLabels);

    if (Array.isArray(parsed)) {
      return {
        blockedByTaskIds: [],
        labels: normalizeExplicitLabels(
          parsed.filter((label): label is string => typeof label === "string"),
        ),
      };
    }

    if (parsed && typeof parsed === "object") {
      return parseTaskMetadataObject(parsed);
    }
  } catch {
    return {
      blockedByTaskIds: [],
      labels: normalizeExplicitLabels(cleanLabels.split(/[\n,]/)),
    };
  }

  return {
    blockedByTaskIds: [],
    labels: [],
  };
}

export function parseTaskLabels(labels: string | null | undefined): TaskLabel[] {
  return parseTaskMetadata(labels).labels;
}

export function taskBlockerIds(task: { labels?: string | null }): string[] {
  return parseTaskMetadata(task.labels).blockedByTaskIds;
}

export function serializeTaskBlockerIds({
  blockerIds,
  labels,
}: {
  blockerIds: string[];
  labels?: string | null;
}): string {
  return serializeTaskMetadata({
    ...parseTaskMetadata(labels),
    blockedByTaskIds: blockerIds,
  });
}

export function fallbackTaskLabel({
  description,
  title,
}: {
  description: string;
  title: string;
}): TaskLabel {
  const searchableText = `${title} ${description}`.toLowerCase();

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

export function taskLabelsForApprovedAction({
  actionIndex,
  totalActions,
}: {
  actionIndex: number;
  totalActions: number;
}): TaskLabel[] {
  if (actionIndex === 0) {
    return ["Planning"];
  }

  if (actionIndex === totalActions - 1) {
    return ["Validation"];
  }

  return ["Build"];
}

export function taskDisplayLabels(task: {
  description: string;
  labels?: string | null;
  title: string;
}): TaskLabel[] {
  const labels = parseTaskLabels(task.labels);

  return labels.length > 0 ? labels : [fallbackTaskLabel(task)];
}
