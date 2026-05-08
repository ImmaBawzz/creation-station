import { expect, test } from "@playwright/test";

test.describe("core workflow e2e", () => {
  test("creates, revises, re-plans, approves, and tasks an idea", async ({ page }) => {
    const ideaTitle = "Playwright Core Workflow Idea";
    const ideaText =
      "Create a deterministic end-to-end test for the core Creation Station workflow.";
    const revisionNotes = "Make the concept brighter and more specific.";
    const initialPlanTitle = `Factory Plan: ${ideaTitle}`;
    const revisedPlanTitle = `Revised Factory Plan: ${ideaTitle}`;
    const revisedTaskTitle = `Apply revision notes for ${ideaTitle}`;

    await page.goto("/");

    await page.getByPlaceholder("Idea title").fill(ideaTitle);
    await page
      .getByPlaceholder("Write the raw idea here...")
      .fill(ideaText);
    await page.getByRole("button", { name: "Save to Inbox" }).click();

    const ideaCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: ideaTitle }),
    });

    await expect(ideaCard).toBeVisible();
    await expect(ideaCard).toContainText("Raw Idea");

    await ideaCard.getByRole("button", { name: "Convert in Factory" }).click();

    await expect(page.getByText("Factory Planner ready")).toBeVisible();

    const reviewInbox = page.locator("#review-inbox");
    const initialPlanCard = reviewInbox.locator("article").filter({
      has: page.getByRole("heading", { name: initialPlanTitle }),
    });

    await expect(initialPlanCard).toBeVisible();
    await expect(initialPlanCard).toContainText(`From idea: ${ideaTitle}`);
    await expect(initialPlanCard).toContainText("Initial test plan for Playwright Core Workflow Idea.");

    await initialPlanCard
      .getByPlaceholder("Describe what should change in the next AI draft...")
      .fill(revisionNotes);
    await initialPlanCard.getByRole("button", { name: "Request Revision" }).click();

    await expect(initialPlanCard).toContainText("Revision requested.");
    await expect(initialPlanCard).toContainText(revisionNotes);

    await expect(ideaCard.getByRole("button", { name: "Convert Revised Plan" })).toBeVisible();
    await ideaCard.getByRole("button", { name: "Convert Revised Plan" }).click();

    await expect(page.getByText("Factory Planner ready")).toBeVisible();

    const revisedPlanCard = reviewInbox.locator("article").filter({
      has: page.getByRole("heading", { name: revisedPlanTitle }),
    });

    await expect(revisedPlanCard).toBeVisible();
    await expect(revisedPlanCard).toContainText(
      `Revision focus: ${revisionNotes}`,
    );

    await revisedPlanCard
      .getByRole("button", { name: "Approve + Create Tasks" })
      .click();

    const taskBoard = page.locator("#task-board");

    await expect(
      taskBoard.locator("p").filter({ hasText: revisedTaskTitle }).first(),
    ).toBeVisible();
    await expect(ideaCard.getByRole("link", { name: "Open Tasks" })).toBeVisible();
  });
});