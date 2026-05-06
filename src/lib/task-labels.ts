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

function textIncludesAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function normalizeLabels(labels: string[]): TaskLabel[] {
  const normalized: TaskLabel[] = [];

  for (const label of labels) {
    const cleanLabel = label.trim();

    if (taskLabelSet.has(cleanLabel) && !normalized.includes(cleanLabel as TaskLabel)) {
      normalized.push(cleanLabel as TaskLabel);
    }
  }

  return normalized.length > 0 ? normalized : ["Other"];
}

export function serializeTaskLabels(labels: string[]): string {
  return JSON.stringify(normalizeLabels(labels));
}

export function parseTaskLabels(labels: string | null | undefined): TaskLabel[] {
  const cleanLabels = labels?.trim() ?? "";

  if (!cleanLabels) {
    return [];
  }

  try {
    const parsed = JSON.parse(cleanLabels);

    if (Array.isArray(parsed)) {
      return normalizeLabels(
        parsed.filter((label): label is string => typeof label === "string"),
      );
    }
  } catch {
    return normalizeLabels(cleanLabels.split(/[\n,]/));
  }

  return [];
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
