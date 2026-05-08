import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCookies,
  mockFactoryPlanCreate,
  mockGenerateFactoryPlan,
  mockIdeaFindUnique,
  mockIdeaUpdate,
  mockLogAnalyticsEvent,
  mockRedirect,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
  })),
  mockFactoryPlanCreate: vi.fn(),
  mockGenerateFactoryPlan: vi.fn(),
  mockIdeaFindUnique: vi.fn(),
  mockIdeaUpdate: vi.fn(),
  mockLogAnalyticsEvent: vi.fn(),
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/aiProvider", () => ({
  generateFactoryPlan: mockGenerateFactoryPlan,
}));

vi.mock("@/lib/analytics", () => ({
  logAnalyticsEvent: mockLogAnalyticsEvent,
}));

vi.mock("@/lib/db", () => ({
  db: {
    factoryPlan: {
      create: mockFactoryPlanCreate,
    },
    idea: {
      findUnique: mockIdeaFindUnique,
      update: mockIdeaUpdate,
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

import { sendToFactory } from "@/app/actions";

describe("sendToFactory", () => {
  beforeEach(() => {
    mockCookies.mockClear();
    mockFactoryPlanCreate.mockReset();
    mockGenerateFactoryPlan.mockReset();
    mockIdeaFindUnique.mockReset();
    mockIdeaUpdate.mockReset();
    mockLogAnalyticsEvent.mockReset();
    mockRedirect.mockClear();
    mockRevalidatePath.mockClear();
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
    expect(mockLogAnalyticsEvent).not.toHaveBeenCalled();
  });
});