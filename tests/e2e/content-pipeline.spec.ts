import { expect, test } from "@playwright/test";

test.describe("content pipeline e2e", () => {
  test("creates, briefs, drafts, prepares, publishes, measures, and monetizes content", async ({ page }) => {
    const title = "Playwright Content Pipeline Clip";

    await page.goto("/content");
    await expect(page.getByRole("heading", { name: "Content Pipeline MVP" })).toBeVisible();

    await page.getByPlaceholder("Content title").fill(title);
    await page.getByPlaceholder("Core idea, hook, or concept").fill("Show the content workflow from idea to revenue.");
    await page.getByPlaceholder("Audience").fill("Solo creators");
    await page.getByPlaceholder("Tags").fill("workflow, monetization");
    await page.getByRole("button", { name: "Save Content" }).click();

    let item = page.locator("article").filter({
      has: page.getByRole("heading", { name: title }),
    });

    await expect(item).toBeVisible();
    await expect(item).toContainText("Idea");

    await item.getByPlaceholder("Objective").fill("Explain the MVP workflow");
    await item.getByPlaceholder("Angle").fill("Practical build log");
    await item.getByPlaceholder("Promise").fill("Create content faster");
    await item.getByPlaceholder("Outline").fill("Hook\nBrief\nDraft\nPublish\nMeasure");
    await item.getByRole("button", { name: "Save Brief" }).click();
    await expect(item).toContainText("Briefed");

    await item.getByPlaceholder("Draft content").fill("This is the first end-to-end content draft.");
    await item.getByRole("button", { name: "Save Draft Version" }).click();
    await expect(item).toContainText("Drafting");

    await item.getByRole("button", { name: "Create Production Packet" }).click();
    await expect(item).toContainText("Latest packet: version 2");
    await expect(item.getByRole("link", { name: "Export Packet Markdown" })).toBeVisible();

    await item.getByRole("button", { name: "Create Production Tasks" }).click();
    await page.goto("/");
    await page.locator("#task-board summary").filter({ hasText: "Assets Needed" }).first().click();
    await expect(
      page.locator("#task-board p").filter({ hasText: "Prepare music prompt" }).first(),
    ).toBeVisible();

    await page.goto("/content");
    item = page.locator("article").filter({
      has: page.getByRole("heading", { name: title }),
    });
    await expect(item).toBeVisible();

    await item.getByPlaceholder("Caption or description").fill("A quick walkthrough of the content pipeline.");
    await item.getByPlaceholder("Hashtags").fill("#content #creator");
    await item.getByPlaceholder("Publishing checklist").fill("Thumbnail ready\nCTA checked");
    await item.getByRole("button", { name: "Save Publishing Prep" }).click();
    await expect(item).toContainText("Ready to publish");
    await expect(item).toContainText("READY");

    await item.getByPlaceholder("Published URL").fill("https://example.com/content-pipeline");
    await item.getByRole("button", { name: "Mark Published" }).click();
    await expect(item).toContainText("Published");

    await item.getByPlaceholder("views").fill("1000");
    await item.getByPlaceholder("likes").fill("50");
    await item.getByPlaceholder("clicks").fill("12");
    await item.getByRole("button", { name: "Record Metrics" }).click();
    await expect(item).toContainText("1000");

    await item.getByPlaceholder("Offer or sponsor").fill("Creator kit");
    await item.getByPlaceholder("Revenue $").fill("19.99");
    await item.getByRole("button", { name: "Save Monetization" }).click();
    await expect(item).toContainText("$19.99");
  });
});
