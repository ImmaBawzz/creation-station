import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("aiProvider test mode", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.AI_PROVIDER;
    delete process.env.OLLAMA_MODEL;
    delete process.env.OLLAMA_BASE_URL;
  });

  it("returns a deterministic initial plan in test mode", async () => {
    process.env.AI_PROVIDER = "test";

    const { generateFactoryPlan } = await import("@/lib/aiProvider");

    await expect(
      generateFactoryPlan({
        title: "Playwright Core Workflow",
        rawText: "Create a reliable workflow test.",
        category: "Music",
        tags: "e2e,workflow",
        priority: "MEDIUM",
        potential: "MEDIUM",
        promptPresets: {
          factory: "",
          revision: "",
        },
        priorPlan: null,
      }),
    ).resolves.toEqual({
      title: "Factory Plan: Playwright Core Workflow",
      summary: "Initial test plan for Playwright Core Workflow.",
      concept:
        "Initial concept for Playwright Core Workflow built from the submitted idea.",
      requiredAssets:
        "Creative brief for Playwright Core Workflow\nReference assets tagged e2e,workflow\nApproval checklist for Music",
      risks: "Low risk in test provider mode.",
      nextActions:
        "Draft creative brief for Playwright Core Workflow\nCollect reference assets for Playwright Core Workflow\nSchedule review for Playwright Core Workflow",
    });
  });

  it("returns a deterministic revised plan in test mode", async () => {
    process.env.AI_PROVIDER = "test";

    const { generateFactoryPlan } = await import("@/lib/aiProvider");

    await expect(
      generateFactoryPlan({
        title: "Playwright Core Workflow",
        rawText: "Create a reliable workflow test.",
        category: "Music",
        tags: "e2e,workflow",
        priority: "MEDIUM",
        potential: "MEDIUM",
        promptPresets: {
          factory: "",
          revision: "",
        },
        priorPlan: {
          summary: "Initial test plan for Playwright Core Workflow.",
          concept: "Initial concept for Playwright Core Workflow.",
          nextActions: "Draft creative brief for Playwright Core Workflow",
          revisionNotes: "Make the concept brighter and more specific.",
        },
      }),
    ).resolves.toEqual({
      title: "Revised Factory Plan: Playwright Core Workflow",
      summary:
        "Revised test plan for Playwright Core Workflow. Revision focus: Make the concept brighter and more specific.",
      concept:
        "Updated concept for Playwright Core Workflow using revision guidance: Make the concept brighter and more specific.",
      requiredAssets:
        "Creative brief for Playwright Core Workflow\nReference assets tagged e2e,workflow\nApproval checklist for Music",
      risks: "Low risk in test provider mode.",
      nextActions:
        "Apply revision notes for Playwright Core Workflow\nRefresh concept brief for Playwright Core Workflow\nApprove revised execution checklist for Playwright Core Workflow",
    });
  });
});