"use server";

import { generateFactoryPlan } from "@/lib/aiProvider";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function getFactoryReturnPath(value: string): "/" | "/factory" {
  return value === "/factory" ? "/factory" : "/";
}

function buildFactoryMessagePath(
  path: "/" | "/factory",
  key: "factoryError" | "factorySuccess",
  message: string,
): string {
  const params = new URLSearchParams({ [key]: message });
  return `${path}?${params.toString()}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Something went wrong while making the AI plan. Please try again.";
}

async function getPromptPresetCookie(name: string): Promise<string> {
  const cookieStore = await cookies();
  const value = cookieStore.get(name)?.value.trim() ?? "";

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function createIdea(formData: FormData) {
  const title = clean(formData.get("title"));
  const rawText = clean(formData.get("rawText"));
  const category = clean(formData.get("category"));
  const tags = clean(formData.get("tags"));

  if (!title || !rawText) {
    throw new Error("Title and raw idea text are required.");
  }

  await db.idea.create({
    data: {
      title,
      rawText,
      category: category || "Uncategorized",
      tags,
      status: "RAW",
    },
  });

  revalidatePath("/");
}

export async function sendToFactory(formData: FormData) {
  const returnTo = getFactoryReturnPath(clean(formData.get("returnTo")));
  const ideaId = clean(formData.get("ideaId"));

  try {
    const idea = await db.idea.findUnique({
      where: { id: ideaId },
      include: {
        plans: {
          where: { status: "REVISION_REQUESTED" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!idea) {
      throw new Error("That idea could not be found. Refresh the page and try again.");
    }

    const priorRevision = idea.plans[0] ?? null;

    const generatedPlan = await generateFactoryPlan({
      title: idea.title,
      rawText: idea.rawText,
      category: idea.category,
      tags: idea.tags,
      priority: idea.priority,
      potential: idea.potential,
      promptPresets: {
        factory: await getPromptPresetCookie("creation_station_factory_preset"),
        revision: await getPromptPresetCookie("creation_station_revision_preset"),
      },
      priorPlan: priorRevision
        ? {
            summary: priorRevision.summary,
            concept: priorRevision.concept,
            nextActions: priorRevision.nextActions,
            revisionNotes: priorRevision.revisionNotes,
          }
        : null,
    });

    await db.factoryPlan.create({
      data: {
        ideaId: idea.id,
        ...generatedPlan,
        status: "REVIEW_PENDING",
      },
    });

    await db.idea.update({
      where: { id: idea.id },
      data: {
        status: "PLAN_READY",
        summary: generatedPlan.summary,
      },
    });
  } catch (error) {
    redirect(
      buildFactoryMessagePath(returnTo, "factoryError", getErrorMessage(error)),
    );
  }

  revalidatePath("/");
  revalidatePath("/factory");
  redirect(
    buildFactoryMessagePath(
      returnTo,
      "factorySuccess",
      "AI plan saved. Read it below, then review or approve it next.",
    ),
  );
}

export async function approvePlan(formData: FormData) {
  const planId = clean(formData.get("planId"));

  const plan = await db.factoryPlan.findUnique({
    where: { id: planId },
    include: { idea: true },
  });

  if (!plan) {
    throw new Error("Plan not found.");
  }

  await db.factoryPlan.update({
    where: { id: planId },
    data: { status: "APPROVED" },
  });

  const parsedActions = plan.nextActions
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 10);

  const taskTitles =
    parsedActions.length > 0
      ? parsedActions
      : [
          "Clarify MVP scope",
          "Create project brief",
          "Define first prototype",
          "Collect required assets",
          "Prepare execution checklist",
        ];

  await db.task.createMany({
    data: taskTitles.map((title) => ({
      planId,
      title,
      description: `${plan.summary}`,
      status: "TODO",
      priority: "MEDIUM",
    })),
  });

  await db.idea.update({
    where: { id: plan.ideaId },
    data: { status: "TASKED" },
  });

  revalidatePath("/");
}

export async function requestRevision(formData: FormData) {
  const planId = clean(formData.get("planId"));
  const revisionNotes = clean(formData.get("revisionNotes"));

  const plan = await db.factoryPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error("Plan not found.");
  }

  await db.factoryPlan.update({
    where: { id: planId },
    data: {
      status: "REVISION_REQUESTED",
      revisionNotes,
    },
  });

  await db.idea.update({
    where: { id: plan.ideaId },
    data: { status: "NEEDS_REVISION" },
  });

  revalidatePath("/");
}

export async function archiveIdea(formData: FormData) {
  const ideaId = clean(formData.get("ideaId"));

  await db.idea.update({
    where: { id: ideaId },
    data: { status: "ARCHIVED" },
  });

  revalidatePath("/");
}

export async function updateTaskStatus(formData: FormData) {
  const taskId = clean(formData.get("taskId"));
  const nextStatus = clean(formData.get("nextStatus"));
  const allowedStatuses = new Set([
    "TODO",
    "DOING",
    "BLOCKED",
    "BACKLOG",
    "DONE",
    "ARCHIVED",
  ]);

  if (!taskId || !allowedStatuses.has(nextStatus)) {
    throw new Error("Task status update is invalid.");
  }

  await db.task.update({
    where: { id: taskId },
    data: { status: nextStatus },
  });

  revalidatePath("/");
}
