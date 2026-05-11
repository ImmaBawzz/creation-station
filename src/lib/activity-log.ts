import { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/db";

type ActivityMetadataValue =
  | string
  | number
  | boolean
  | null
  | ActivityMetadataValue[]
  | { [key: string]: ActivityMetadataValue };

export type ActivityMetadata = Record<string, ActivityMetadataValue>;

export type LogActivityInput = {
  entityId?: string | null;
  entityType: string;
  eventType: string;
  metadata?: ActivityMetadata;
};

export async function logActivity({
  entityId,
  entityType,
  eventType,
  metadata,
}: LogActivityInput) {
  return db.activityEvent.create({
    data: {
      entityId: entityId ?? null,
      entityType,
      eventType,
      metadata: (metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
    },
  });
}

export async function getRecentActivity(limit = 12) {
  const take = Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), 50)) : 12;

  return db.activityEvent.findMany({
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take,
  });
}