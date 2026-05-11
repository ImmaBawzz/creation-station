"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity-log";
import {
  cleanContentText,
  parseContentFormat,
  parseDraftStatus,
  parseMoneyToCents,
  parseMonetizationMethod,
  parseNonNegativeInteger,
  parseOptionalDate,
  parsePublishingPlatform,
} from "@/lib/content-pipeline";
import { db } from "@/lib/db";
import { canAccessFeature } from "@/lib/feature-gating";
import {
  CREATOR_RUN_CONTENT_TAG_PREFIX,
  CREATOR_RUN_TAG,
  PRODUCTION_PACKET_DRAFT_TITLE,
  PRODUCTION_PACKET_FEATURE_ID,
  PRODUCTION_TASK_DEFINITIONS,
  buildProductionPacket,
} from "@/lib/production-packet";
import { serializeTaskLabels } from "@/lib/task-labels";

function requireContentId(formData: FormData): string {
  const contentItemId = cleanContentText(formData.get("contentItemId"));

  if (!contentItemId) {
    throw new Error("Content item is required.");
  }

  return contentItemId;
}

async function contentExists(contentItemId: string) {
  const item = await db.contentItem.findUnique({
    where: { id: contentItemId },
    select: { id: true, status: true, title: true },
  });

  if (!item) {
    throw new Error("Content item was not found.");
  }

  return item;
}

function requireProductionPacketAccess() {
  if (!canAccessFeature(PRODUCTION_PACKET_FEATURE_ID)) {
    throw new Error("Production packets are available only for internal or private creator workflows.");
  }
}

async function getContentItemForProductionPacket(contentItemId: string) {
  const item = await db.contentItem.findUnique({
    where: { id: contentItemId },
    include: {
      brief: true,
      drafts: {
        where: { title: PRODUCTION_PACKET_DRAFT_TITLE },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!item) {
    throw new Error("Content item was not found.");
  }

  return item;
}

function shouldAdvanceDraftStatus(status: string): boolean {
  return !["READY_TO_PUBLISH", "SCHEDULED", "PUBLISHED", "ARCHIVED"].includes(status);
}

function creatorRunContentTag(contentItemId: string): string {
  return `${CREATOR_RUN_CONTENT_TAG_PREFIX}${contentItemId}`;
}

function creatorRunTags(contentItemId: string): string {
  return `${CREATOR_RUN_TAG}, ${creatorRunContentTag(contentItemId)}`;
}

export async function createContentItem(formData: FormData) {
  const title = cleanContentText(formData.get("title"));
  const coreIdea = cleanContentText(formData.get("coreIdea"));
  const audience = cleanContentText(formData.get("audience"));
  const tags = cleanContentText(formData.get("tags"));
  const format = parseContentFormat(cleanContentText(formData.get("format")));
  const primaryPlatform = parsePublishingPlatform(
    cleanContentText(formData.get("primaryPlatform")),
  );

  if (!title || !coreIdea) {
    throw new Error("Content title and core idea are required.");
  }

  const item = await db.contentItem.create({
    data: {
      audience,
      coreIdea,
      format,
      primaryPlatform,
      tags,
      title,
    },
  });

  await logActivity({
    entityId: item.id,
    entityType: "content",
    eventType: "content_created",
    metadata: {
      platform: item.primaryPlatform,
      title: item.title,
    },
  });

  revalidatePath("/content");
}

export async function saveContentBrief(formData: FormData) {
  const contentItemId = requireContentId(formData);
  const item = await contentExists(contentItemId);
  const objective = cleanContentText(formData.get("objective"));
  const angle = cleanContentText(formData.get("angle"));
  const promise = cleanContentText(formData.get("promise"));
  const outline = cleanContentText(formData.get("outline"));
  const cta = cleanContentText(formData.get("cta"));
  const keywords = cleanContentText(formData.get("keywords"));
  const notes = cleanContentText(formData.get("notes"));

  if (!objective && !angle && !promise && !outline) {
    throw new Error("Add at least one brief field before saving.");
  }

  await db.$transaction(async (tx) => {
    await tx.contentBrief.upsert({
      where: { contentItemId },
      create: {
        angle,
        contentItemId,
        cta,
        keywords,
        notes,
        objective,
        outline,
        promise,
      },
      update: {
        angle,
        cta,
        keywords,
        notes,
        objective,
        outline,
        promise,
      },
    });

    if (item.status === "IDEA") {
      await tx.contentItem.update({
        where: { id: contentItemId },
        data: { status: "BRIEFED" },
      });
    }
  });

  await logActivity({
    entityId: contentItemId,
    entityType: "content",
    eventType: "content_brief_saved",
    metadata: {
      title: item.title,
    },
  });

  revalidatePath("/content");
}

export async function saveContentDraft(formData: FormData) {
  const contentItemId = requireContentId(formData);
  const item = await contentExists(contentItemId);
  const title = cleanContentText(formData.get("draftTitle")) || item.title;
  const body = cleanContentText(formData.get("draftBody"));
  const status = parseDraftStatus(cleanContentText(formData.get("draftStatus")));

  if (!body) {
    throw new Error("Draft body is required.");
  }

  const draft = await db.$transaction(async (tx) => {
    const draftCount = await tx.contentDraft.count({
      where: { contentItemId },
    });
    const createdDraft = await tx.contentDraft.create({
      data: {
        body,
        contentItemId,
        status,
        title,
        version: draftCount + 1,
      },
    });

    if (!["READY_TO_PUBLISH", "SCHEDULED", "PUBLISHED", "ARCHIVED"].includes(item.status)) {
      await tx.contentItem.update({
        where: { id: contentItemId },
        data: { status: draftCount === 0 ? "DRAFTING" : "EDITING" },
      });
    }

    return createdDraft;
  });

  await logActivity({
    entityId: contentItemId,
    entityType: "content",
    eventType: "content_draft_saved",
    metadata: {
      title: item.title,
      version: draft.version,
    },
  });

  revalidatePath("/content");
}

export async function createProductionPacket(formData: FormData) {
  requireProductionPacketAccess();

  const contentItemId = requireContentId(formData);
  const item = await getContentItemForProductionPacket(contentItemId);
  const body = buildProductionPacket({
    brief: item.brief,
    item,
  });

  const draft = await db.$transaction(async (tx) => {
    const draftCount = await tx.contentDraft.count({
      where: { contentItemId },
    });
    const createdDraft = await tx.contentDraft.create({
      data: {
        body,
        contentItemId,
        status: "READY",
        title: PRODUCTION_PACKET_DRAFT_TITLE,
        version: draftCount + 1,
      },
    });

    if (shouldAdvanceDraftStatus(item.status)) {
      await tx.contentItem.update({
        where: { id: contentItemId },
        data: { status: draftCount === 0 ? "DRAFTING" : "EDITING" },
      });
    }

    return createdDraft;
  });

  await logActivity({
    entityId: contentItemId,
    entityType: "content",
    eventType: "production_packet_created",
    metadata: {
      title: item.title,
      version: draft.version,
    },
  });

  revalidatePath("/content");
}

export async function createProductionTasks(formData: FormData) {
  requireProductionPacketAccess();

  const contentItemId = requireContentId(formData);
  const item = await getContentItemForProductionPacket(contentItemId);
  const existingPacket = item.drafts[0] ?? null;
  const packetBody = existingPacket?.body ?? buildProductionPacket({
    brief: item.brief,
    item,
  });

  const result = await db.$transaction(async (tx) => {
    let packetDraftWasCreated = false;

    if (!existingPacket) {
      const draftCount = await tx.contentDraft.count({
        where: { contentItemId },
      });

      await tx.contentDraft.create({
        data: {
          body: packetBody,
          contentItemId,
          status: "READY",
          title: PRODUCTION_PACKET_DRAFT_TITLE,
          version: draftCount + 1,
        },
      });
      packetDraftWasCreated = true;

      if (shouldAdvanceDraftStatus(item.status)) {
        await tx.contentItem.update({
          where: { id: contentItemId },
          data: { status: draftCount === 0 ? "DRAFTING" : "EDITING" },
        });
      }
    }

    const contentTag = creatorRunContentTag(contentItemId);
    const idea = await tx.idea.findFirst({
      where: {
        category: "Content Production",
        tags: {
          contains: contentTag,
        },
      },
    }) ?? await tx.idea.create({
      data: {
        category: "Content Production",
        rawText: item.coreIdea,
        status: "TASKED",
        summary: `Manual Creator Run production tasks for ${item.title}.`,
        tags: creatorRunTags(contentItemId),
        title: `Creator Run: ${item.title}`,
      },
    });

    const nextActions = PRODUCTION_TASK_DEFINITIONS.map((task) => task.title).join("\n");
    const plan = await tx.factoryPlan.findFirst({
      where: { ideaId: idea.id },
    }) ?? await tx.factoryPlan.create({
      data: {
        concept: packetBody,
        ideaId: idea.id,
        nextActions,
        requiredAssets: [
          PRODUCTION_PACKET_DRAFT_TITLE,
          "Manual music source",
          "Manual image sources",
          "Manual video editing workspace",
        ].join("\n"),
        risks: "Manual-first production only. No direct publishing, imported analytics, payment APIs, affiliate APIs, provider credentials, or autonomous media generation are used.",
        status: "APPROVED",
        summary: `Manual production plan for ${item.title}.`,
        title: `Creator Run v0.1: ${item.title}`,
      },
    });

    const existingTasks = await tx.task.findMany({
      where: { planId: plan.id },
      select: { title: true },
    });
    const existingTaskTitles = new Set(existingTasks.map((task) => task.title));
    const missingTasks = PRODUCTION_TASK_DEFINITIONS.filter(
      (task) => !existingTaskTitles.has(task.title),
    );

    await Promise.all(
      missingTasks.map((task) =>
        tx.task.create({
          data: {
            description: [
              task.description,
              `Content item: ${item.title}`,
              `Source draft: ${PRODUCTION_PACKET_DRAFT_TITLE}`,
            ].join("\n"),
            labels: serializeTaskLabels([task.label]),
            planId: plan.id,
            priority: "MEDIUM",
            status: "TODO",
            title: task.title,
          },
        }),
      ),
    );

    return {
      createdTaskCount: missingTasks.length,
      packetDraftWasCreated,
      planId: plan.id,
    };
  });

  if (result.packetDraftWasCreated) {
    await logActivity({
      entityId: contentItemId,
      entityType: "content",
      eventType: "production_packet_created",
      metadata: {
        title: item.title,
      },
    });
  }

  await logActivity({
    entityId: result.planId,
    entityType: "plan",
    eventType: "production_tasks_created",
    metadata: {
      contentItemId,
      taskCount: result.createdTaskCount,
      title: item.title,
    },
  });

  revalidatePath("/content");
  revalidatePath("/");
}

export async function savePublishingTarget(formData: FormData) {
  const contentItemId = requireContentId(formData);
  const item = await contentExists(contentItemId);
  const platform = parsePublishingPlatform(cleanContentText(formData.get("platform")));
  const caption = cleanContentText(formData.get("caption"));
  const hashtags = cleanContentText(formData.get("hashtags"));
  const checklist = cleanContentText(formData.get("checklist"));
  const scheduledAt = parseOptionalDate(cleanContentText(formData.get("scheduledAt")));
  const targetStatus = scheduledAt ? "SCHEDULED" : "READY";

  if (!caption && !hashtags && !checklist) {
    throw new Error("Add caption, hashtags, or checklist before saving publishing prep.");
  }

  await db.$transaction(async (tx) => {
    const existingTarget = await tx.publishingTarget.findFirst({
      where: { contentItemId, platform },
      select: { id: true },
    });

    if (existingTarget) {
      await tx.publishingTarget.update({
        where: { id: existingTarget.id },
        data: {
          caption,
          checklist,
          hashtags,
          scheduledAt,
          status: targetStatus,
        },
      });
    } else {
      await tx.publishingTarget.create({
        data: {
          caption,
          checklist,
          contentItemId,
          hashtags,
          platform,
          scheduledAt,
          status: targetStatus,
        },
      });
    }

    if (!["PUBLISHED", "ARCHIVED"].includes(item.status)) {
      await tx.contentItem.update({
        where: { id: contentItemId },
        data: { status: scheduledAt ? "SCHEDULED" : "READY_TO_PUBLISH" },
      });
    }
  });

  await logActivity({
    entityId: contentItemId,
    entityType: "content",
    eventType: "publishing_target_saved",
    metadata: {
      platform,
      title: item.title,
    },
  });

  revalidatePath("/content");
}

export async function markPublishingTargetPublished(formData: FormData) {
  const publishingTargetId = cleanContentText(formData.get("publishingTargetId"));
  const publishUrl = cleanContentText(formData.get("publishUrl"));
  const publishedAt =
    parseOptionalDate(cleanContentText(formData.get("publishedAt"))) ?? new Date();

  if (!publishingTargetId) {
    throw new Error("Publishing target is required.");
  }

  const target = await db.publishingTarget.findUnique({
    where: { id: publishingTargetId },
    include: {
      contentItem: {
        select: { id: true, title: true },
      },
    },
  });

  if (!target) {
    throw new Error("Publishing target was not found.");
  }

  await db.$transaction(async (tx) => {
    await tx.publishingTarget.update({
      where: { id: publishingTargetId },
      data: {
        publishedAt,
        publishUrl,
        status: "PUBLISHED",
      },
    });

    await tx.contentItem.update({
      where: { id: target.contentItemId },
      data: { status: "PUBLISHED" },
    });
  });

  await logActivity({
    entityId: target.contentItemId,
    entityType: "content",
    eventType: "content_published",
    metadata: {
      platform: target.platform,
      title: target.contentItem.title,
    },
  });

  revalidatePath("/content");
}

export async function recordContentMetric(formData: FormData) {
  const contentItemId = requireContentId(formData);
  const item = await contentExists(contentItemId);
  const platform = parsePublishingPlatform(cleanContentText(formData.get("metricPlatform")));
  const capturedAt =
    parseOptionalDate(cleanContentText(formData.get("capturedAt"))) ?? new Date();

  await db.contentMetric.create({
    data: {
      capturedAt,
      clicks: parseNonNegativeInteger(cleanContentText(formData.get("clicks"))),
      comments: parseNonNegativeInteger(cleanContentText(formData.get("comments"))),
      contentItemId,
      likes: parseNonNegativeInteger(cleanContentText(formData.get("likes"))),
      notes: cleanContentText(formData.get("metricNotes")),
      platform,
      saves: parseNonNegativeInteger(cleanContentText(formData.get("saves"))),
      shares: parseNonNegativeInteger(cleanContentText(formData.get("shares"))),
      views: parseNonNegativeInteger(cleanContentText(formData.get("views"))),
    },
  });

  await logActivity({
    entityId: contentItemId,
    entityType: "content",
    eventType: "content_metrics_recorded",
    metadata: {
      platform,
      title: item.title,
    },
  });

  revalidatePath("/content");
}

export async function saveMonetizationLink(formData: FormData) {
  const contentItemId = requireContentId(formData);
  const item = await contentExists(contentItemId);
  const method = parseMonetizationMethod(cleanContentText(formData.get("method")));
  const offerName = cleanContentText(formData.get("offerName"));
  const offerUrl = cleanContentText(formData.get("offerUrl"));
  const expectedValueCents = parseMoneyToCents(
    cleanContentText(formData.get("expectedValue")),
  );
  const actualRevenueCents = parseMoneyToCents(
    cleanContentText(formData.get("actualRevenue")),
  );
  const currency = cleanContentText(formData.get("currency")) || "USD";
  const notes = cleanContentText(formData.get("monetizationNotes"));

  if (!offerName && !offerUrl && actualRevenueCents === 0 && expectedValueCents === 0) {
    throw new Error("Add an offer, link, expected value, or revenue before saving monetization.");
  }

  await db.monetizationLink.create({
    data: {
      actualRevenueCents,
      contentItemId,
      currency,
      expectedValueCents,
      method,
      notes,
      offerName,
      offerUrl,
    },
  });

  await logActivity({
    entityId: contentItemId,
    entityType: "content",
    eventType: "content_monetization_saved",
    metadata: {
      method,
      title: item.title,
    },
  });

  revalidatePath("/content");
}
