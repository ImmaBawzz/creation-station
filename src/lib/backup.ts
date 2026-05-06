import { db } from "@/lib/db";
import packageJson from "../../package.json";

type BackupRecord = Record<string, unknown>;

const allowedIdeaStatuses = new Set([
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
]);

const allowedPriorities = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const allowedPotentials = new Set(["UNKNOWN", "SMALL", "MEDIUM", "LARGE", "MASSIVE"]);

function asRecord(value: unknown): BackupRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as BackupRecord)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asDate(value: unknown): Date {
  const date = new Date(asString(value));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function asEnum(value: unknown, allowed: Set<string>, fallback: string): string {
  const normalized = asString(value, fallback);
  return allowed.has(normalized) ? normalized : fallback;
}

function getArray(value: unknown): BackupRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

export async function buildWorkspaceBackup() {
  const exportedAt = new Date().toISOString();

  const [ideas, factoryPlans, tasks, taskBlockers] = await Promise.all([
    db.idea.findMany({
      orderBy: { createdAt: "asc" },
    }),
    db.factoryPlan.findMany({
      orderBy: { createdAt: "asc" },
    }),
    db.task.findMany({
      orderBy: { createdAt: "asc" },
    }),
    db.taskBlocker.findMany({
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    version: "v1.5",
    appVersion: packageJson.version,
    exportedAt,
    generatedAt: exportedAt,
    settings: {
      backupMode: "manual-local-json",
      promptPresetsStorage: "browser-local",
    },
    ideas,
    projects: factoryPlans,
    factoryPlans,
    tasks,
    taskBlockers,
  };
}

export function backupFilename(exportedAt: string): string {
  return `creation-station-backup-${exportedAt.replace(/[:.]/g, "-")}.json`;
}

export function parseWorkspaceBackup(rawBackup: unknown) {
  const backup = asRecord(rawBackup);
  const ideas = getArray(backup.ideas);
  const projects = getArray(backup.projects).length > 0
    ? getArray(backup.projects)
    : getArray(backup.factoryPlans);
  const tasks = getArray(backup.tasks);
  const taskBlockers = getArray(backup.taskBlockers);

  if (ideas.length === 0 && projects.length === 0 && tasks.length === 0) {
    throw new Error("Backup does not contain ideas, projects, or tasks.");
  }

  const ideaIds = new Set<string>();
  const projectIds = new Set<string>();
  const taskIds = new Set<string>();

  const parsedIdeas = ideas.map((idea) => {
    const id = asString(idea.id);

    if (!id || !asString(idea.title) || !asString(idea.rawText)) {
      throw new Error("Backup contains an invalid idea record.");
    }

    ideaIds.add(id);

    return {
      id,
      title: asString(idea.title),
      rawText: asString(idea.rawText),
      summary: asString(idea.summary) || null,
      category: asString(idea.category, "Uncategorized"),
      tags: asString(idea.tags),
      status: asEnum(idea.status, allowedIdeaStatuses, "RAW") as
        | "RAW"
        | "TRIAGED"
        | "IN_FACTORY"
        | "PLAN_READY"
        | "REVIEW_PENDING"
        | "APPROVED"
        | "NEEDS_REVISION"
        | "TASKED"
        | "IN_PRODUCTION"
        | "ASSET_READY"
        | "PUBLISHED"
        | "ARCHIVED",
      priority: asEnum(idea.priority, allowedPriorities, "MEDIUM") as
        | "LOW"
        | "MEDIUM"
        | "HIGH"
        | "CRITICAL",
      potential: asEnum(idea.potential, allowedPotentials, "UNKNOWN") as
        | "UNKNOWN"
        | "SMALL"
        | "MEDIUM"
        | "LARGE"
        | "MASSIVE",
      createdAt: asDate(idea.createdAt),
      updatedAt: asDate(idea.updatedAt),
    };
  });

  const parsedProjects = projects.map((project) => {
    const id = asString(project.id);
    const ideaId = asString(project.ideaId);

    if (!id || !ideaId || !ideaIds.has(ideaId) || !asString(project.title)) {
      throw new Error("Backup contains an invalid project record.");
    }

    projectIds.add(id);

    return {
      id,
      ideaId,
      title: asString(project.title),
      summary: asString(project.summary),
      concept: asString(project.concept),
      requiredAssets: asString(project.requiredAssets),
      risks: asString(project.risks),
      nextActions: asString(project.nextActions),
      status: asString(project.status, "REVIEW_PENDING"),
      revisionNotes: asString(project.revisionNotes),
      createdAt: asDate(project.createdAt),
      updatedAt: asDate(project.updatedAt),
    };
  });

  const parsedTasks = tasks.map((task) => {
    const id = asString(task.id);
    const planId = asString(task.planId);

    if (!id || !planId || !projectIds.has(planId) || !asString(task.title)) {
      throw new Error("Backup contains an invalid task record.");
    }

    taskIds.add(id);

    return {
      id,
      planId,
      title: asString(task.title),
      description: asString(task.description),
      status: asString(task.status, "TODO"),
      priority: asEnum(task.priority, allowedPriorities, "MEDIUM") as
        | "LOW"
        | "MEDIUM"
        | "HIGH"
        | "CRITICAL",
      labels: asString(task.labels),
      createdAt: asDate(task.createdAt),
      updatedAt: asDate(task.updatedAt),
    };
  });

  const parsedTaskBlockers = taskBlockers
    .map((blocker) => ({
      id: asString(blocker.id),
      taskId: asString(blocker.taskId),
      blockerTaskId: asString(blocker.blockerTaskId),
      createdAt: asDate(blocker.createdAt),
    }))
    .filter(
      (blocker) =>
        blocker.id &&
        taskIds.has(blocker.taskId) &&
        taskIds.has(blocker.blockerTaskId) &&
        blocker.taskId !== blocker.blockerTaskId,
    );

  return {
    ideas: parsedIdeas,
    projects: parsedProjects,
    tasks: parsedTasks,
    taskBlockers: parsedTaskBlockers,
  };
}

export async function restoreWorkspaceBackup(rawBackup: unknown) {
  const backup = parseWorkspaceBackup(rawBackup);

  await db.$transaction(async (tx) => {
    await tx.taskBlocker.deleteMany();
    await tx.task.deleteMany();
    await tx.factoryPlan.deleteMany();
    await tx.idea.deleteMany();

    if (backup.ideas.length > 0) {
      await tx.idea.createMany({ data: backup.ideas });
    }

    if (backup.projects.length > 0) {
      await tx.factoryPlan.createMany({ data: backup.projects });
    }

    if (backup.tasks.length > 0) {
      await tx.task.createMany({ data: backup.tasks });
    }

    if (backup.taskBlockers.length > 0) {
      await tx.taskBlocker.createMany({
        data: backup.taskBlockers,
      });
    }
  });
}
