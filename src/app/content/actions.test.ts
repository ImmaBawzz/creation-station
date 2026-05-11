import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockContentBriefUpsert,
  mockContentDraftCount,
  mockContentDraftCreate,
  mockContentItemCreate,
  mockContentItemFindUnique,
  mockContentItemUpdate,
  mockContentMetricCreate,
  mockDbTransaction,
  mockFactoryPlanCreate,
  mockFactoryPlanFindFirst,
  mockIdeaCreate,
  mockIdeaFindFirst,
  mockLogActivity,
  mockMonetizationLinkCreate,
  mockPublishingTargetCreate,
  mockPublishingTargetFindFirst,
  mockPublishingTargetFindUnique,
  mockPublishingTargetUpdate,
  mockRevalidatePath,
  mockTaskCreate,
  mockTaskFindMany,
} = vi.hoisted(() => ({
  mockContentBriefUpsert: vi.fn(),
  mockContentDraftCount: vi.fn(),
  mockContentDraftCreate: vi.fn(),
  mockContentItemCreate: vi.fn(),
  mockContentItemFindUnique: vi.fn(),
  mockContentItemUpdate: vi.fn(),
  mockContentMetricCreate: vi.fn(),
  mockDbTransaction: vi.fn(),
  mockFactoryPlanCreate: vi.fn(),
  mockFactoryPlanFindFirst: vi.fn(),
  mockIdeaCreate: vi.fn(),
  mockIdeaFindFirst: vi.fn(),
  mockLogActivity: vi.fn(),
  mockMonetizationLinkCreate: vi.fn(),
  mockPublishingTargetCreate: vi.fn(),
  mockPublishingTargetFindFirst: vi.fn(),
  mockPublishingTargetFindUnique: vi.fn(),
  mockPublishingTargetUpdate: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockTaskCreate: vi.fn(),
  mockTaskFindMany: vi.fn(),
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: mockLogActivity,
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mockDbTransaction,
    contentItem: {
      create: mockContentItemCreate,
      findUnique: mockContentItemFindUnique,
    },
    contentMetric: {
      create: mockContentMetricCreate,
    },
    monetizationLink: {
      create: mockMonetizationLinkCreate,
    },
    publishingTarget: {
      findUnique: mockPublishingTargetFindUnique,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import {
  createContentItem,
  createProductionPacket,
  createProductionTasks,
  markPublishingTargetPublished,
  recordContentMetric,
  saveContentBrief,
  saveContentDraft,
  saveMonetizationLink,
  savePublishingTarget,
} from "@/app/content/actions";

const txMock = {
  contentBrief: {
    upsert: mockContentBriefUpsert,
  },
  contentDraft: {
    count: mockContentDraftCount,
    create: mockContentDraftCreate,
  },
  contentItem: {
    update: mockContentItemUpdate,
  },
  factoryPlan: {
    create: mockFactoryPlanCreate,
    findFirst: mockFactoryPlanFindFirst,
  },
  idea: {
    create: mockIdeaCreate,
    findFirst: mockIdeaFindFirst,
  },
  publishingTarget: {
    create: mockPublishingTargetCreate,
    findFirst: mockPublishingTargetFindFirst,
    update: mockPublishingTargetUpdate,
  },
  task: {
    create: mockTaskCreate,
    findMany: mockTaskFindMany,
  },
};

function form(entries: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }

  return formData;
}

describe("content pipeline actions", () => {
  beforeEach(() => {
    mockContentBriefUpsert.mockReset();
    mockContentDraftCount.mockReset();
    mockContentDraftCreate.mockReset();
    mockContentItemCreate.mockReset();
    mockContentItemFindUnique.mockReset();
    mockContentItemUpdate.mockReset();
    mockContentMetricCreate.mockReset();
    mockDbTransaction.mockReset();
    mockFactoryPlanCreate.mockReset();
    mockFactoryPlanFindFirst.mockReset();
    mockIdeaCreate.mockReset();
    mockIdeaFindFirst.mockReset();
    mockLogActivity.mockReset();
    mockMonetizationLinkCreate.mockReset();
    mockPublishingTargetCreate.mockReset();
    mockPublishingTargetFindFirst.mockReset();
    mockPublishingTargetFindUnique.mockReset();
    mockPublishingTargetUpdate.mockReset();
    mockRevalidatePath.mockReset();
    mockTaskCreate.mockReset();
    mockTaskFindMany.mockReset();
    mockDbTransaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
    );
  });

  it("creates a content item and logs activity", async () => {
    mockContentItemCreate.mockResolvedValue({
      id: "content-1",
      primaryPlatform: "YOUTUBE",
      title: "Launch clip",
    });

    await createContentItem(form({
      audience: "Solo creators",
      coreIdea: "Show the workflow",
      format: "SHORT_VIDEO",
      primaryPlatform: "YOUTUBE",
      tags: "launch",
      title: "Launch clip",
    }));

    expect(mockContentItemCreate).toHaveBeenCalledWith({
      data: {
        audience: "Solo creators",
        coreIdea: "Show the workflow",
        format: "SHORT_VIDEO",
        primaryPlatform: "YOUTUBE",
        tags: "launch",
        title: "Launch clip",
      },
    });
    expect(mockLogActivity).toHaveBeenCalledWith({
      entityId: "content-1",
      entityType: "content",
      eventType: "content_created",
      metadata: {
        platform: "YOUTUBE",
        title: "Launch clip",
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/content");
  });

  it("saves a brief and advances an idea-stage content item", async () => {
    mockContentItemFindUnique.mockResolvedValue({
      id: "content-1",
      status: "IDEA",
      title: "Launch clip",
    });

    await saveContentBrief(form({
      angle: "Practical demo",
      contentItemId: "content-1",
      objective: "Explain the MVP",
      outline: "Hook\nSteps\nCTA",
      promise: "Ship faster",
    }));

    expect(mockContentBriefUpsert).toHaveBeenCalledWith({
      where: { contentItemId: "content-1" },
      create: expect.objectContaining({
        contentItemId: "content-1",
        objective: "Explain the MVP",
      }),
      update: expect.objectContaining({
        objective: "Explain the MVP",
      }),
    });
    expect(mockContentItemUpdate).toHaveBeenCalledWith({
      where: { id: "content-1" },
      data: { status: "BRIEFED" },
    });
  });

  it("saves a first draft version and moves content into drafting", async () => {
    mockContentItemFindUnique.mockResolvedValue({
      id: "content-1",
      status: "BRIEFED",
      title: "Launch clip",
    });
    mockContentDraftCount.mockResolvedValue(0);
    mockContentDraftCreate.mockResolvedValue({
      id: "draft-1",
      version: 1,
    });

    await saveContentDraft(form({
      contentItemId: "content-1",
      draftBody: "Draft body",
      draftStatus: "DRAFT",
      draftTitle: "Draft title",
    }));

    expect(mockContentDraftCreate).toHaveBeenCalledWith({
      data: {
        body: "Draft body",
        contentItemId: "content-1",
        status: "DRAFT",
        title: "Draft title",
        version: 1,
      },
    });
    expect(mockContentItemUpdate).toHaveBeenCalledWith({
      where: { id: "content-1" },
      data: { status: "DRAFTING" },
    });
  });

  it("creates a production packet as a ready draft version", async () => {
    mockContentItemFindUnique.mockResolvedValue({
      audience: "Solo creators",
      brief: {
        angle: "Practical demo",
        cta: "Save the workflow",
        keywords: "creator workflow",
        notes: "",
        objective: "Explain the run",
        outline: "Hook\nBrief\nManual publish",
        promise: "Create a stable content run",
      },
      coreIdea: "Show the workflow",
      drafts: [],
      format: "SHORT_VIDEO",
      id: "content-1",
      primaryPlatform: "YOUTUBE",
      status: "BRIEFED",
      tags: "creator",
      title: "Launch clip",
    });
    mockContentDraftCount.mockResolvedValue(1);
    mockContentDraftCreate.mockResolvedValue({
      id: "draft-2",
      version: 2,
    });

    await createProductionPacket(form({
      contentItemId: "content-1",
    }));

    expect(mockContentDraftCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contentItemId: "content-1",
        status: "READY",
        title: "Production Packet",
        version: 2,
      }),
    });
    expect(mockContentDraftCreate.mock.calls[0][0].data.body).toContain("## Music Brief");
    expect(mockContentDraftCreate.mock.calls[0][0].data.body).toContain("## Image Prompts");
    expect(mockContentDraftCreate.mock.calls[0][0].data.body).toContain("## Video Assembly Plan");
    expect(mockContentItemUpdate).toHaveBeenCalledWith({
      where: { id: "content-1" },
      data: { status: "EDITING" },
    });
    expect(mockLogActivity).toHaveBeenCalledWith({
      entityId: "content-1",
      entityType: "content",
      eventType: "production_packet_created",
      metadata: {
        title: "Launch clip",
        version: 2,
      },
    });
  });

  it("creates the stable manual production task set without duplicating existing tasks", async () => {
    mockContentItemFindUnique.mockResolvedValue({
      audience: "Solo creators",
      brief: null,
      coreIdea: "Show the workflow",
      drafts: [
        {
          body: "# Production Packet: Launch clip\n\n## Music Brief\nManual only.",
        },
      ],
      format: "SHORT_VIDEO",
      id: "content-1",
      primaryPlatform: "YOUTUBE",
      status: "EDITING",
      tags: "creator",
      title: "Launch clip",
    });
    mockIdeaFindFirst.mockResolvedValue(null);
    mockIdeaCreate.mockResolvedValue({
      id: "idea-1",
    });
    mockFactoryPlanFindFirst.mockResolvedValue(null);
    mockFactoryPlanCreate.mockResolvedValue({
      id: "plan-1",
    });
    mockTaskFindMany.mockResolvedValue([
      {
        title: "Finalize concept",
      },
    ]);
    mockTaskCreate.mockResolvedValue({
      id: "task-1",
    });

    await createProductionTasks(form({
      contentItemId: "content-1",
    }));

    expect(mockIdeaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: "Content Production",
        tags: "creator-run-v0.1, content-item:content-1",
        title: "Creator Run: Launch clip",
      }),
    });
    expect(mockFactoryPlanCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "APPROVED",
        title: "Creator Run v0.1: Launch clip",
      }),
    });
    expect(mockTaskCreate).toHaveBeenCalledTimes(10);
    expect(mockTaskCreate.mock.calls.map((call) => call[0].data.title)).toEqual([
      "Finalize script",
      "Prepare music prompt",
      "Create/select music manually",
      "Prepare image prompts",
      "Create/select images manually",
      "Assemble video manually",
      "Review final video",
      "Prepare caption/hashtags",
      "Publish manually",
      "Record metrics snapshot",
    ]);
    expect(mockLogActivity).toHaveBeenCalledWith({
      entityId: "plan-1",
      entityType: "plan",
      eventType: "production_tasks_created",
      metadata: {
        contentItemId: "content-1",
        taskCount: 10,
        title: "Launch clip",
      },
    });
  });

  it("creates publishing prep and marks content ready", async () => {
    mockContentItemFindUnique.mockResolvedValue({
      id: "content-1",
      status: "DRAFTING",
      title: "Launch clip",
    });
    mockPublishingTargetFindFirst.mockResolvedValue(null);

    await savePublishingTarget(form({
      caption: "Watch this workflow",
      checklist: "Thumbnail ready",
      contentItemId: "content-1",
      hashtags: "#buildinpublic",
      platform: "YOUTUBE",
    }));

    expect(mockPublishingTargetCreate).toHaveBeenCalledWith({
      data: {
        caption: "Watch this workflow",
        checklist: "Thumbnail ready",
        contentItemId: "content-1",
        hashtags: "#buildinpublic",
        platform: "YOUTUBE",
        scheduledAt: null,
        status: "READY",
      },
    });
    expect(mockContentItemUpdate).toHaveBeenCalledWith({
      where: { id: "content-1" },
      data: { status: "READY_TO_PUBLISH" },
    });
  });

  it("marks a publishing target as published", async () => {
    mockPublishingTargetFindUnique.mockResolvedValue({
      contentItemId: "content-1",
      contentItem: {
        id: "content-1",
        title: "Launch clip",
      },
      platform: "YOUTUBE",
    });

    await markPublishingTargetPublished(form({
      publishedAt: "2026-05-11",
      publishingTargetId: "target-1",
      publishUrl: "https://example.com/video",
    }));

    expect(mockPublishingTargetUpdate).toHaveBeenCalledWith({
      where: { id: "target-1" },
      data: {
        publishedAt: new Date("2026-05-11"),
        publishUrl: "https://example.com/video",
        status: "PUBLISHED",
      },
    });
    expect(mockContentItemUpdate).toHaveBeenCalledWith({
      where: { id: "content-1" },
      data: { status: "PUBLISHED" },
    });
  });

  it("records manual metrics", async () => {
    mockContentItemFindUnique.mockResolvedValue({
      id: "content-1",
      status: "PUBLISHED",
      title: "Launch clip",
    });

    await recordContentMetric(form({
      clicks: "12",
      comments: "3",
      contentItemId: "content-1",
      likes: "40",
      metricPlatform: "YOUTUBE",
      saves: "9",
      shares: "5",
      views: "1000",
    }));

    expect(mockContentMetricCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clicks: 12,
        comments: 3,
        contentItemId: "content-1",
        likes: 40,
        platform: "YOUTUBE",
        saves: 9,
        shares: 5,
        views: 1000,
      }),
    });
  });

  it("saves monetization values as cents", async () => {
    mockContentItemFindUnique.mockResolvedValue({
      id: "content-1",
      status: "PUBLISHED",
      title: "Launch clip",
    });

    await saveMonetizationLink(form({
      actualRevenue: "19.99",
      contentItemId: "content-1",
      currency: "USD",
      expectedValue: "50",
      method: "AFFILIATE",
      offerName: "Creator kit",
      offerUrl: "https://example.com/offer",
    }));

    expect(mockMonetizationLinkCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actualRevenueCents: 1999,
        contentItemId: "content-1",
        currency: "USD",
        expectedValueCents: 5000,
        method: "AFFILIATE",
        offerName: "Creator kit",
      }),
    });
  });
});
