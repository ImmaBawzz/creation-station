import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockActivityEventCreate, mockActivityEventFindMany } = vi.hoisted(() => ({
  mockActivityEventCreate: vi.fn(),
  mockActivityEventFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    activityEvent: {
      create: mockActivityEventCreate,
      findMany: mockActivityEventFindMany,
    },
  },
}));

import { getRecentActivity, logActivity } from "@/lib/activity-log";

describe("activity-log", () => {
  beforeEach(() => {
    mockActivityEventCreate.mockReset();
    mockActivityEventFindMany.mockReset();
  });

  it("creates activity events with normalized nullable fields", async () => {
    mockActivityEventCreate.mockResolvedValue({ id: "event-1" });

    await logActivity({
      entityType: "idea",
      eventType: "idea_created",
      metadata: {
        category: "Music",
        title: "Signal Fire",
      },
    });

    expect(mockActivityEventCreate).toHaveBeenCalledWith({
      data: {
        entityId: null,
        entityType: "idea",
        eventType: "idea_created",
        metadata: {
          category: "Music",
          title: "Signal Fire",
        },
      },
    });
  });

  it("retrieves recent activity in descending timestamp order", async () => {
    mockActivityEventFindMany.mockResolvedValue([]);

    await getRecentActivity(80);

    expect(mockActivityEventFindMany).toHaveBeenCalledWith({
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: 50,
    });
  });
});