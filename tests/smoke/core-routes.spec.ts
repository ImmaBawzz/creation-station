import { expect, test } from "@playwright/test";

test.describe("core route smoke", () => {
  test("renders the main app surfaces", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Creation Station" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /Review Inbox/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Task Board" })).toBeVisible();

    await page.goto("/factory");
    await expect(
      page.getByRole("heading", { level: 1, name: "Factory Planner" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Ideas Ready for Planning" }),
    ).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Command Overview" })).toBeVisible();

    await page.goto("/content");
    await expect(page.getByRole("heading", { name: "Content Pipeline MVP" })).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "AI Provider Controls" })).toBeVisible();

    await page.goto("/release");
    await expect(page.getByRole("heading", { name: "v1.0 Release Readiness" })).toBeVisible();
  });

  test("returns the backup export shape", async ({ request }) => {
    const response = await request.get("/api/export");

    expect(response.ok()).toBeTruthy();

    const payload = await response.json();

    expect(payload).toHaveProperty("ideas");
    expect(payload).toHaveProperty("factoryPlans");
    expect(payload).toHaveProperty("tasks");
    expect(payload).toHaveProperty("taskBlockers");
    expect(payload).toHaveProperty("contentItems");
    expect(payload).toHaveProperty("contentBriefs");
    expect(payload).toHaveProperty("contentDrafts");
    expect(payload).toHaveProperty("publishingTargets");
    expect(payload).toHaveProperty("contentMetrics");
    expect(payload).toHaveProperty("monetizationLinks");
    expect(payload).toHaveProperty("settings");
  });
});
