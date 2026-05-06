import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type AnalyticsEventType =
  | "backup_exported"
  | "backup_imported"
  | "idea_converted"
  | "idea_created"
  | "onboarding_completed"
  | "onboarding_skipped"
  | "project_created"
  | "task_archived"
  | "task_completed"
  | "task_created";

export type AnalyticsEvent = {
  eventType: AnalyticsEventType;
  metadata?: Record<string, string | number | boolean>;
  timestamp: string;
};

export type AnalyticsSummary = {
  backupsCreated: number;
  backupsImported: number;
  completionRate: number;
  ideasConverted: number;
  lastEventAt: string | null;
  onboardingState: "completed" | "not_started" | "skipped";
  projectsCreated: number;
  recentEvents: AnalyticsEvent[];
  tasksArchived: number;
  tasksCompleted: number;
  tasksCreated: number;
  totalEvents: number;
};

const analyticsDir = path.join(process.cwd(), ".creation-station");
const analyticsPath = path.join(analyticsDir, "analytics-events.json");
const maxAnalyticsEvents = 500;

function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const event = value as Partial<AnalyticsEvent>;
  return typeof event.eventType === "string" && typeof event.timestamp === "string";
}

async function readAnalyticsEvents(): Promise<AnalyticsEvent[]> {
  try {
    const raw = await readFile(analyticsPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAnalyticsEvent) : [];
  } catch {
    return [];
  }
}

async function writeAnalyticsEvents(events: AnalyticsEvent[]) {
  await mkdir(analyticsDir, { recursive: true });
  await writeFile(
    analyticsPath,
    `${JSON.stringify(events.slice(-maxAnalyticsEvents), null, 2)}\n`,
    "utf8",
  );
}

export async function logAnalyticsEvent(
  eventType: AnalyticsEventType,
  metadata: AnalyticsEvent["metadata"] = {},
) {
  const events = await readAnalyticsEvents();

  events.push({
    eventType,
    metadata,
    timestamp: new Date().toISOString(),
  });

  await writeAnalyticsEvents(events);
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const events = await readAnalyticsEvents();
  const count = (eventType: AnalyticsEventType) =>
    events.filter((event) => event.eventType === eventType).length;
  const tasksCreated = count("task_created");
  const tasksCompleted = count("task_completed");
  const onboardingEvents = events.filter(
    (event) =>
      event.eventType === "onboarding_completed" ||
      event.eventType === "onboarding_skipped",
  );
  const latestOnboardingEvent = onboardingEvents.at(-1);

  return {
    backupsCreated: count("backup_exported"),
    backupsImported: count("backup_imported"),
    completionRate: tasksCreated > 0 ? Math.round((tasksCompleted / tasksCreated) * 100) : 0,
    ideasConverted: count("idea_converted"),
    lastEventAt: events.at(-1)?.timestamp ?? null,
    onboardingState:
      latestOnboardingEvent?.eventType === "onboarding_completed"
        ? "completed"
        : latestOnboardingEvent?.eventType === "onboarding_skipped"
          ? "skipped"
          : "not_started",
    projectsCreated: count("project_created"),
    recentEvents: events.slice(-8).reverse(),
    tasksArchived: count("task_archived"),
    tasksCompleted,
    tasksCreated,
    totalEvents: events.length,
  };
}
