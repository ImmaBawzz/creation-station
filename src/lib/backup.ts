import type {
  ContentDraftStatus,
  ContentFormat,
  ContentStatus,
  MonetizationMethod,
  PublishingPlatform,
} from "@/generated/prisma/enums";
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
const allowedContentStatuses = new Set([
  "IDEA",
  "BRIEFED",
  "DRAFTING",
  "EDITING",
  "READY_TO_PUBLISH",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
]);
const allowedContentFormats = new Set([
  "SHORT_VIDEO",
  "LONG_VIDEO",
  "ARTICLE",
  "NEWSLETTER",
  "SOCIAL_POST",
  "THREAD",
  "PODCAST",
  "EMAIL",
  "OTHER",
]);
const allowedDraftStatuses = new Set(["DRAFT", "NEEDS_EDIT", "READY", "ARCHIVED"]);
const allowedMonetizationMethods = new Set([
  "AFFILIATE",
  "SPONSORSHIP",
  "PRODUCT",
  "SERVICE",
  "LEAD_MAGNET",
  "AD_REVENUE",
  "DONATION",
  "OTHER",
]);
const allowedPublishingPlatforms = new Set([
  "YOUTUBE",
  "TIKTOK",
  "INSTAGRAM",
  "X",
  "BLOG",
  "NEWSLETTER",
  "LINKEDIN",
  "FACEBOOK",
  "OTHER",
]);

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

function asOptionalDate(value: unknown): Date | null {
  if (!asString(value)) {
    return null;
  }

  const date = new Date(asString(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function asEnum(value: unknown, allowed: Set<string>, fallback: string): string {
  const normalized = asString(value, fallback);
  return allowed.has(normalized) ? normalized : fallback;
}

function asInt(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(asString(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getArray(value: unknown): BackupRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

export async function buildWorkspaceBackup() {
  const exportedAt = new Date().toISOString();

  const [
    ideas,
    factoryPlans,
    tasks,
    taskBlockers,
    contentItems,
    contentBriefs,
    contentDrafts,
    publishingTargets,
    contentMetrics,
    monetizationLinks,
  ] = await Promise.all([
    db.idea.findMany({ orderBy: { createdAt: "asc" } }),
    db.factoryPlan.findMany({ orderBy: { createdAt: "asc" } }),
    db.task.findMany({ orderBy: { createdAt: "asc" } }),
    db.taskBlocker.findMany({ orderBy: { createdAt: "asc" } }),
    db.contentItem.findMany({ orderBy: { createdAt: "asc" } }),
    db.contentBrief.findMany({ orderBy: { createdAt: "asc" } }),
    db.contentDraft.findMany({ orderBy: { createdAt: "asc" } }),
    db.publishingTarget.findMany({ orderBy: { createdAt: "asc" } }),
    db.contentMetric.findMany({ orderBy: { createdAt: "asc" } }),
    db.monetizationLink.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return {
    version: "v1.8-content-mvp",
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
    contentItems,
    contentBriefs,
    contentDrafts,
    publishingTargets,
    contentMetrics,
    monetizationLinks,
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
  const contentItems = getArray(backup.contentItems);
  const contentBriefs = getArray(backup.contentBriefs);
  const contentDrafts = getArray(backup.contentDrafts);
  const publishingTargets = getArray(backup.publishingTargets);
  const contentMetrics = getArray(backup.contentMetrics);
  const monetizationLinks = getArray(backup.monetizationLinks);

  if (
    ideas.length === 0 &&
    projects.length === 0 &&
    tasks.length === 0 &&
    contentItems.length === 0
  ) {
    throw new Error("Backup does not contain ideas, projects, tasks, or content items.");
  }

  const ideaIds = new Set<string>();
  const projectIds = new Set<string>();
  const taskIds = new Set<string>();
  const contentItemIds = new Set<string>();

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

  const parsedContentItems = contentItems.map((item) => {
    const id = asString(item.id);

    if (!id || !asString(item.title) || !asString(item.coreIdea)) {
      throw new Error("Backup contains an invalid content item record.");
    }

    contentItemIds.add(id);

    return {
      id,
      title: asString(item.title),
      coreIdea: asString(item.coreIdea),
      audience: asString(item.audience),
      format: asEnum(item.format, allowedContentFormats, "SHORT_VIDEO") as ContentFormat,
      primaryPlatform: asEnum(
        item.primaryPlatform,
        allowedPublishingPlatforms,
        "YOUTUBE",
      ) as PublishingPlatform,
      status: asEnum(item.status, allowedContentStatuses, "IDEA") as ContentStatus,
      tags: asString(item.tags),
      createdAt: asDate(item.createdAt),
      updatedAt: asDate(item.updatedAt),
    };
  });

  const parsedContentBriefs = contentBriefs.map((brief) => {
    const id = asString(brief.id);
    const contentItemId = asString(brief.contentItemId);

    if (!id || !contentItemIds.has(contentItemId)) {
      throw new Error("Backup contains an invalid content brief record.");
    }

    return {
      id,
      contentItemId,
      objective: asString(brief.objective),
      angle: asString(brief.angle),
      promise: asString(brief.promise),
      outline: asString(brief.outline),
      cta: asString(brief.cta),
      keywords: asString(brief.keywords),
      notes: asString(brief.notes),
      createdAt: asDate(brief.createdAt),
      updatedAt: asDate(brief.updatedAt),
    };
  });

  const parsedContentDrafts = contentDrafts.map((draft) => {
    const id = asString(draft.id);
    const contentItemId = asString(draft.contentItemId);

    if (!id || !contentItemIds.has(contentItemId) || !asString(draft.title)) {
      throw new Error("Backup contains an invalid content draft record.");
    }

    return {
      id,
      contentItemId,
      title: asString(draft.title),
      body: asString(draft.body),
      version: asInt(draft.version, 1),
      status: asEnum(draft.status, allowedDraftStatuses, "DRAFT") as ContentDraftStatus,
      createdAt: asDate(draft.createdAt),
      updatedAt: asDate(draft.updatedAt),
    };
  });

  const parsedPublishingTargets = publishingTargets.map((target) => {
    const id = asString(target.id);
    const contentItemId = asString(target.contentItemId);

    if (!id || !contentItemIds.has(contentItemId)) {
      throw new Error("Backup contains an invalid publishing target record.");
    }

    return {
      id,
      contentItemId,
      platform: asEnum(target.platform, allowedPublishingPlatforms, "YOUTUBE") as PublishingPlatform,
      caption: asString(target.caption),
      hashtags: asString(target.hashtags),
      checklist: asString(target.checklist),
      status: asString(target.status, "PREP"),
      scheduledAt: asOptionalDate(target.scheduledAt),
      publishedAt: asOptionalDate(target.publishedAt),
      publishUrl: asString(target.publishUrl),
      createdAt: asDate(target.createdAt),
      updatedAt: asDate(target.updatedAt),
    };
  });

  const parsedContentMetrics = contentMetrics.map((metric) => {
    const id = asString(metric.id);
    const contentItemId = asString(metric.contentItemId);

    if (!id || !contentItemIds.has(contentItemId)) {
      throw new Error("Backup contains an invalid content metric record.");
    }

    return {
      id,
      contentItemId,
      platform: asEnum(metric.platform, allowedPublishingPlatforms, "YOUTUBE") as PublishingPlatform,
      views: asInt(metric.views),
      likes: asInt(metric.likes),
      comments: asInt(metric.comments),
      shares: asInt(metric.shares),
      saves: asInt(metric.saves),
      clicks: asInt(metric.clicks),
      notes: asString(metric.notes),
      capturedAt: asDate(metric.capturedAt),
      createdAt: asDate(metric.createdAt),
    };
  });

  const parsedMonetizationLinks = monetizationLinks.map((link) => {
    const id = asString(link.id);
    const contentItemId = asString(link.contentItemId);

    if (!id || !contentItemIds.has(contentItemId)) {
      throw new Error("Backup contains an invalid monetization link record.");
    }

    return {
      id,
      contentItemId,
      method: asEnum(link.method, allowedMonetizationMethods, "OTHER") as MonetizationMethod,
      offerName: asString(link.offerName),
      offerUrl: asString(link.offerUrl),
      expectedValueCents: asInt(link.expectedValueCents),
      actualRevenueCents: asInt(link.actualRevenueCents),
      currency: asString(link.currency, "USD"),
      notes: asString(link.notes),
      createdAt: asDate(link.createdAt),
      updatedAt: asDate(link.updatedAt),
    };
  });

  return {
    ideas: parsedIdeas,
    projects: parsedProjects,
    tasks: parsedTasks,
    taskBlockers: parsedTaskBlockers,
    contentItems: parsedContentItems,
    contentBriefs: parsedContentBriefs,
    contentDrafts: parsedContentDrafts,
    publishingTargets: parsedPublishingTargets,
    contentMetrics: parsedContentMetrics,
    monetizationLinks: parsedMonetizationLinks,
  };
}

export async function restoreWorkspaceBackup(rawBackup: unknown) {
  const backup = parseWorkspaceBackup(rawBackup);

  await db.$transaction(async (tx) => {
    await tx.monetizationLink.deleteMany();
    await tx.contentMetric.deleteMany();
    await tx.publishingTarget.deleteMany();
    await tx.contentDraft.deleteMany();
    await tx.contentBrief.deleteMany();
    await tx.contentItem.deleteMany();
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

    if (backup.contentItems.length > 0) {
      await tx.contentItem.createMany({ data: backup.contentItems });
    }

    if (backup.contentBriefs.length > 0) {
      await tx.contentBrief.createMany({ data: backup.contentBriefs });
    }

    if (backup.contentDrafts.length > 0) {
      await tx.contentDraft.createMany({ data: backup.contentDrafts });
    }

    if (backup.publishingTargets.length > 0) {
      await tx.publishingTarget.createMany({ data: backup.publishingTargets });
    }

    if (backup.contentMetrics.length > 0) {
      await tx.contentMetric.createMany({ data: backup.contentMetrics });
    }

    if (backup.monetizationLinks.length > 0) {
      await tx.monetizationLink.createMany({ data: backup.monetizationLinks });
    }
  });
}
