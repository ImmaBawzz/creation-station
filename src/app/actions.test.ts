import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCookies,
  mockDbTransaction,
  mockFactoryPlanCreate,
  mockFactoryPlanFindUnique,
  mockFactoryPlanUpdate,
  mockFactoryPlanUpdateMany,
  mockGenerateFactoryPlan,
  mockIdeaCreate,
  mockIdeaFindUnique,
  mockIdeaUpdate,
  mockLogActivity,
  mockLogAnalyticsEvent,
  mockRedirect,
  mockRevalidatePath,
  mockTaskCreate,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
  })),
  mockDbTransaction: vi.fn(),
  mockFactoryPlanCreate: vi.fn(),
  mockFactoryPlanFindUnique: vi.fn(),
  mockFactoryPlanUpdate: vi.fn(),
  mockFactoryPlanUpdateMany: vi.fn(),
  mockGenerateFactoryPlan: vi.fn(),
  mockIdeaCreate: vi.fn(),
  mockIdeaFindUnique: vi.fn(),
  mockIdeaUpdate: vi.fn(),
  mockLogActivity: vi.fn(),
  mockLogAnalyticsEvent: vi.fn(),
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  mockRevalidatePath: vi.fn(),
  mockTaskCreate: vi.fn(),
}));

vi.mock("@/lib/aiProvider", () => ({
  generateFactoryPlan: mockGenerateFactoryPlan,
}));

vi.mock("@/lib/analytics", () => ({
  logAnalyticsEvent: mockLogAnalyticsEvent,
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: mockLogActivity,
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mockDbTransaction,
    factoryPlan: {
      create: mockFactoryPlanCreate,
      findUnique: mockFactoryPlanFindUnique,
      update: mockFactoryPlanUpdate,
    },
    idea: {
      create: mockIdeaCreate,
      findUnique: mockIdeaFindUnique,
      update: mockIdeaUpdate,
    },
    task: {
      create: mockTaskCreate,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { approvePlan, createIdea, requestRevision, sendToFactory } from "@/app/actions";

describe("sendToFactory", () => {
  beforeEach(() => {
    mockCookies.mockClear();
    mockDbTransaction.mockReset();
    mockFactoryPlanCreate.mockReset();
    mockFactoryPlanFindUnique.mockReset();
    mockFactoryPlanUpdate.mockReset();
    mockFactoryPlanUpdateMany.mockReset();
    mockGenerateFactoryPlan.mockReset();
    mockIdeaCreate.mockReset();
    mockIdeaFindUnique.mockReset();
    mockIdeaUpdate.mockReset();
    mockLogActivity.mockReset();
    mockLogAnalyticsEvent.mockReset();
    mockRedirect.mockClear();
    mockRevalidatePath.mockClear();
    mockTaskCreate.mockReset();
  });

  it("logs activity when an idea is created", async () => {
    mockIdeaCreate.mockResolvedValue({
      category: "Music",
      id: "idea-1",
      title: "Signal Fire",
    });
    mockLogActivity.mockResolvedValue(undefined);
    mockLogAnalyticsEvent.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("title", "Signal Fire");
    formData.set("rawText", "Hook and release plan");
    formData.set("category", "Music");
    formData.set("tags", "song");

    await createIdea(formData);

    expect(mockLogActivity).toHaveBeenCalledWith({
      entityId: "idea-1",
      entityType: "idea",
      eventType: "idea_created",
      metadata: {
        category: "Music",
        title: "Signal Fire",
      },
    });
  });

  it("redirects with a notice instead of creating a duplicate pending plan", async () => {
    mockIdeaFindUnique.mockResolvedValue({
      category: "Music",
      id: "idea-1",
      plans: [
        {
          createdAt: new Date("2026-05-08T12:00:00.000Z"),
          status: "REVIEW_PENDING",
          title: "Existing plan",
        },
      ],
      potential: "MEDIUM",
      priority: "MEDIUM",
      rawText: "Hook and release plan",
      tags: "song",
      title: "Signal Fire",
    });

    const formData = new FormData();
    formData.set("ideaId", "idea-1");
    formData.set("returnTo", "/");

    await expect(sendToFactory(formData)).rejects.toThrow(
      "REDIRECT:/?factoryNotice=Existing+plan+is+already+waiting+for+review.+Open+Review+Inbox+before+creating+another+plan.",
    );

    expect(mockGenerateFactoryPlan).not.toHaveBeenCalled();
    expect(mockFactoryPlanCreate).not.toHaveBeenCalled();
    expect(mockIdeaUpdate).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
    expect(mockLogAnalyticsEvent).not.toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/factory");
  });

  it("still re-plans from the latest revision request when no pending plan exists", async () => {
    mockIdeaFindUnique.mockResolvedValue({
      category: "Music",
      id: "idea-1",
      plans: [
        {
          concept: "Prior concept",
          createdAt: new Date("2026-05-08T11:00:00.000Z"),
          nextActions: "Revise hook\nPolish chorus",
          revisionNotes: "Make it brighter.",
          status: "REVISION_REQUESTED",
          summary: "Prior summary",
        },
      ],
      potential: "MEDIUM",
      priority: "HIGH",
      rawText: "Hook and release plan",
      status: "NEEDS_REVISION",
      tags: "song",
      title: "Signal Fire",
    });
    mockGenerateFactoryPlan.mockResolvedValue({
      concept: "New concept",
      nextActions: "Draft promo\nSchedule post",
      requiredAssets: "Cover art",
      risks: "Low",
      summary: "Fresh summary",
      title: "Fresh plan",
    });
    mockFactoryPlanCreate.mockResolvedValue({ id: "plan-2" });
    mockIdeaUpdate.mockResolvedValue({});
    mockLogAnalyticsEvent.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("ideaId", "idea-1");
    formData.set("returnTo", "/factory");

    await expect(sendToFactory(formData)).rejects.toThrow(
      "REDIRECT:/factory?factorySuccess=AI+plan+saved.+Read+it+below%2C+then+review+or+approve+it+next.",
    );

    expect(mockGenerateFactoryPlan).toHaveBeenCalledWith({
      category: "Music",
      potential: "MEDIUM",
      priorPlan: {
        concept: "Prior concept",
        nextActions: "Revise hook\nPolish chorus",
        revisionNotes: "Make it brighter.",
        summary: "Prior summary",
      },
      priority: "HIGH",
      promptPresets: {
        factory: "",
        revision: "",
      },
      rawText: "Hook and release plan",
      tags: "song",
      title: "Signal Fire",
    });
    expect(mockFactoryPlanCreate).toHaveBeenCalledWith({
      data: {
        concept: "New concept",
        ideaId: "idea-1",
        nextActions: "Draft promo\nSchedule post",
        requiredAssets: "Cover art",
        risks: "Low",
        status: "REVIEW_PENDING",
        summary: "Fresh summary",
        title: "Fresh plan",
      },
    });
    expect(mockIdeaUpdate).toHaveBeenNthCalledWith(1, {
      data: { status: "IN_FACTORY" },
      where: { id: "idea-1" },
    });
    expect(mockIdeaUpdate).toHaveBeenNthCalledWith(2, {
      data: {
        status: "PLAN_READY",
        summary: "Fresh summary",
      },
      where: { id: "idea-1" },
    });
    expect(mockLogActivity).toHaveBeenCalledWith({
      entityId: "idea-1",
      entityType: "idea",
      eventType: "sent_to_factory",
      metadata: {
        planTitle: "Fresh plan",
        title: "Signal Fire",
      },
    });
  });

  it("restores the prior idea status when factory plan generation fails", async () => {
    mockIdeaFindUnique.mockResolvedValue({
      category: "Music",
      id: "idea-1",
      plans: [],
      potential: "MEDIUM",
      priority: "MEDIUM",
      rawText: "Hook and release plan",
      status: "RAW",
      tags: "song",
      title: "Signal Fire",
    });
    mockGenerateFactoryPlan.mockRejectedValue(new Error("Ollama is unavailable."));
    mockIdeaUpdate.mockResolvedValue({});

    const formData = new FormData();
    formData.set("ideaId", "idea-1");
    formData.set("returnTo", "/factory");

    await expect(sendToFactory(formData)).rejects.toThrow(
      "REDIRECT:/factory?factoryError=Ollama+is+unavailable.",
    );

    expect(mockIdeaUpdate).toHaveBeenNthCalledWith(1, {
      data: { status: "IN_FACTORY" },
      where: { id: "idea-1" },
    });
    expect(mockIdeaUpdate).toHaveBeenNthCalledWith(2, {
      data: { status: "RAW" },
      where: { id: "idea-1" },
    });
    expect(mockFactoryPlanCreate).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
    expect(mockLogAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("logs revision requests against the current plan", async () => {
    mockFactoryPlanFindUnique.mockResolvedValue({
      ideaId: "idea-1",
      id: "plan-1",
      title: "Signal Fire plan",
    });
    mockFactoryPlanUpdate.mockResolvedValue({});
    mockIdeaUpdate.mockResolvedValue({});
    mockLogActivity.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.set("planId", "plan-1");
    formData.set("revisionNotes", "Tighten the hook and brighten the chorus.");

    await requestRevision(formData);

    expect(mockLogActivity).toHaveBeenCalledWith({
      entityId: "plan-1",
      entityType: "plan",
      eventType: "revision_requested",
      metadata: {
        notesPreview: "Tighten the hook and brighten the chorus.",
        title: "Signal Fire plan",
      },
    });
  });

  it("logs plan approval and task generation once tasks are created", async () => {
    mockFactoryPlanFindUnique.mockResolvedValue({
      _count: { tasks: 0 },
      idea: { title: "Signal Fire" },
      ideaId: "idea-1",
      nextActions: "Draft promo\nSchedule post",
      status: "REVIEW_PENDING",
      summary: "Fresh summary",
      title: "Fresh plan",
    });
    mockFactoryPlanUpdateMany.mockResolvedValue({ count: 1 });
    mockTaskCreate
      .mockResolvedValueOnce({ id: "task-1", title: "Draft promo" })
      .mockResolvedValueOnce({ id: "task-2", title: "Schedule post" });
    mockIdeaUpdate.mockResolvedValue({});
    mockLogActivity.mockResolvedValue(undefined);
    mockLogAnalyticsEvent.mockResolvedValue(undefined);
    mockDbTransaction.mockImplementation(async (callback: (tx: typeof dbMockTx) => Promise<unknown>) =>
      callback(dbMockTx),
    );

    const formData = new FormData();
    formData.set("planId", "plan-1");

    await approvePlan(formData);

    expect(mockLogActivity).toHaveBeenNthCalledWith(1, {
      entityId: "plan-1",
      entityType: "plan",
      eventType: "plan_approved",
      metadata: {
        ideaTitle: "Signal Fire",
        title: "Fresh plan",
      },
    });
    expect(mockLogActivity).toHaveBeenNthCalledWith(2, {
      entityId: "plan-1",
      entityType: "plan",
      eventType: "tasks_generated",
      metadata: {
        taskCount: 2,
        title: "Fresh plan",
        topTask: "Draft promo",
      },
    });
  });
});

const dbMockTx = {
  factoryPlan: {
    findUnique: mockFactoryPlanFindUnique,
    updateMany: mockFactoryPlanUpdateMany,
  },
  idea: {
    update: mockIdeaUpdate,
  },
  task: {
    create: mockTaskCreate,
  },
};