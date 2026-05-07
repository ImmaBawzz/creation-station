"use server";

import { generateFactoryPlan } from "@/lib/aiProvider";
import { logAnalyticsEvent } from "@/lib/analytics";
import { buildMusicVideoPipelinePlan } from "@/lib/creative-execution";
import { db } from "@/lib/db";
import { serializeTaskLabels, taskLabelsForApprovedAction } from "@/lib/task-labels";
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

const allowedTaskStatuses = [
  "TODO",
  "DOING",
  "BLOCKED",
  "BACKLOG",
  "DONE",
  "ARCHIVED",
] as const;

type TaskStatus = (typeof allowedTaskStatuses)[number];

const allowedTaskStatusSet = new Set<string>(allowedTaskStatuses);

const allowedTaskStatusTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
  TODO: ["DOING", "BLOCKED", "BACKLOG", "DONE", "ARCHIVED"],
  DOING: ["TODO", "BLOCKED", "BACKLOG", "DONE", "ARCHIVED"],
  BLOCKED: ["TODO", "DOING", "BACKLOG", "DONE", "ARCHIVED"],
  BACKLOG: ["TODO", "DONE", "ARCHIVED"],
  DONE: ["TODO", "BACKLOG", "ARCHIVED"],
  ARCHIVED: ["TODO", "BACKLOG", "DONE"],
};

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

  const idea = await db.idea.create({
    data: {
      title,
      rawText,
      category: category || "Uncategorized",
      tags,
      status: "RAW",
    },
  });

  await logAnalyticsEvent("idea_created", {
    ideaId: idea.id,
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

    const plan = await db.factoryPlan.create({
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

    await logAnalyticsEvent("idea_converted", {
      ideaId: idea.id,
      projectId: plan.id,
    });
    await logAnalyticsEvent("project_created", {
      ideaId: idea.id,
      projectId: plan.id,
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

  if (!planId) {
    throw new Error("Plan approval is invalid.");
  }

  const createdTaskMetadata = await db.$transaction(async (tx) => {
    const plan = await tx.factoryPlan.findUnique({
      where: { id: planId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!plan) {
      throw new Error("Plan not found.");
    }

    if (plan._count.tasks > 0) {
      return null;
    }

    if (plan.status !== "REVIEW_PENDING") {
      throw new Error("Only plans waiting for review can be approved.");
    }

    const approval = await tx.factoryPlan.updateMany({
      where: {
        id: planId,
        status: "REVIEW_PENDING",
      },
      data: { status: "APPROVED" },
    });

    if (approval.count !== 1) {
      return null;
    }

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

    const createdTasks = await Promise.all(
      taskTitles.map((title, index) =>
        tx.task.create({
          data: {
        planId,
        title,
        description: `${plan.summary}`,
        labels: serializeTaskLabels(
          taskLabelsForApprovedAction({
            actionIndex: index,
            totalActions: taskTitles.length,
          }),
        ),
        status: "TODO",
        priority: "MEDIUM",
          },
        }),
      ),
    );

    await tx.idea.update({
      where: { id: plan.ideaId },
      data: { status: "TASKED" },
    });

    return {
      ideaId: plan.ideaId,
      taskIds: createdTasks.map((task) => task.id),
    };
  });

  if (createdTaskMetadata) {
    await Promise.all(
      createdTaskMetadata.taskIds.map((taskId) =>
        logAnalyticsEvent("task_created", {
          ideaId: createdTaskMetadata.ideaId,
          projectId: planId,
          taskId,
        }),
      ),
    );
  }

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

export async function createMusicVideoPipeline(formData: FormData) {
  const title = clean(formData.get("title"));
  const concept = clean(formData.get("concept"));
  const genre = clean(formData.get("genre"));
  const mood = clean(formData.get("mood"));
  const styleReferences = clean(formData.get("styleReferences"));
  const durationSeconds = Number(clean(formData.get("durationSeconds")));

  if (!title || !concept) {
    throw new Error("Music video title and concept are required.");
  }

  const pipelinePlan = buildMusicVideoPipelinePlan({
    concept,
    durationSeconds,
    genre,
    mood,
    styleReferences,
    title,
  });

  const idea = await db.idea.create({
    data: {
      category: "Music",
      rawText: [
        concept,
        genre ? `Genre: ${genre}` : "",
        mood ? `Mood: ${mood}` : "",
        styleReferences ? `Style references: ${styleReferences}` : "",
      ].filter(Boolean).join("\n"),
      status: "PLAN_READY",
      summary: pipelinePlan.summary,
      tags: "music video, v2.5, creative execution",
      title,
    },
  });

  const plan = await db.factoryPlan.create({
    data: {
      concept: pipelinePlan.concept,
      ideaId: idea.id,
      nextActions: pipelinePlan.nextActions,
      requiredAssets: pipelinePlan.requiredAssets,
      risks: pipelinePlan.risks,
      status: "REVIEW_PENDING",
      summary: pipelinePlan.summary,
      title: pipelinePlan.title,
    },
  });

  await logAnalyticsEvent("idea_created", {
    ideaId: idea.id,
  });
  await logAnalyticsEvent("project_created", {
    ideaId: idea.id,
    projectId: plan.id,
  });

  revalidatePath("/");
  revalidatePath("/execution");
  const params = new URLSearchParams({
    factorySuccess: "Music video pipeline created. Review the prompt pack and execution steps below.",
    pipeline: "music",
  });
  redirect(`/?${params.toString()}#review-inbox`);
}

export async function updateTaskStatus(formData: FormData) {
  const taskId = clean(formData.get("taskId"));
  const nextStatus = clean(formData.get("nextStatus"));

  if (!taskId || !allowedTaskStatusSet.has(nextStatus)) {
    throw new Error("Task status update is invalid.");
  }

  const statusChange = await db.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id: taskId },
      select: { planId: true, status: true },
    });

    if (!task || !allowedTaskStatusSet.has(task.status)) {
      throw new Error("Task status update is invalid.");
    }

    if (task.status === nextStatus) {
      return null;
    }

    const allowedNextStatuses =
      allowedTaskStatusTransitions[task.status as TaskStatus];

    if (!allowedNextStatuses.includes(nextStatus as TaskStatus)) {
      throw new Error("That task status change is not allowed.");
    }

    await tx.task.update({
      where: { id: taskId },
      data: { status: nextStatus },
    });

    return {
      previousStatus: task.status,
      projectId: task.planId,
    };
  });

  if (statusChange && nextStatus === "DONE") {
    await logAnalyticsEvent("task_completed", {
      previousStatus: statusChange.previousStatus,
      projectId: statusChange.projectId,
      taskId,
    });
  }

  if (statusChange && nextStatus === "ARCHIVED") {
    await logAnalyticsEvent("task_archived", {
      previousStatus: statusChange.previousStatus,
      projectId: statusChange.projectId,
      taskId,
    });
  }

  revalidatePath("/");
}

export async function updateTaskBlocker(formData: FormData) {
  const taskId = clean(formData.get("taskId"));
  const blockerTaskId = clean(formData.get("blockerTaskId"));
  const operation = clean(formData.get("operation"));

  if (!taskId || !["add", "remove"].includes(operation)) {
    throw new Error("Task blocker update is invalid.");
  }

  if (!blockerTaskId || blockerTaskId === taskId) {
    throw new Error("A task cannot wait on itself.");
  }

  await db.$transaction(async (tx) => {
    const [task, blockerTask] = await Promise.all([
      tx.task.findUnique({
        where: { id: taskId },
        select: { id: true },
      }),
      tx.task.findUnique({
        where: { id: blockerTaskId },
        select: { id: true },
      }),
    ]);

    if (!task || !blockerTask) {
      throw new Error("Task blocker update is invalid.");
    }

    if (operation === "remove") {
      await tx.taskBlocker.deleteMany({
        where: {
          blockerTaskId,
          taskId,
        },
      });

      return;
    }

    await tx.taskBlocker.upsert({
      where: {
        taskId_blockerTaskId: {
          blockerTaskId,
          taskId,
        },
      },
      create: {
        blockerTaskId,
        taskId,
      },
      update: {},
    });
  });

  revalidatePath("/");
}

export async function createAutonomyRun(formData: FormData) {
  const goal = clean(formData.get("autonomyGoal"));
  const revision = clean(formData.get("autonomyRevision"));

  if (!goal) {
    throw new Error("Autonomy preview goal is required.");
  }

  const { persistAutonomyRun } = await import("@/lib/autonomy/execution-store");
  const result = await persistAutonomyRun({
    goal,
    revision,
  });
  const params = new URLSearchParams({
    autonomyRunId: result.runId,
  });

  if (result.duplicateBlocked) {
    params.set("autonomyDuplicate", "1");
  }

  revalidatePath("/");
  redirect(`/?${params.toString()}#autonomy-preview`);
}

export async function decideAutonomyApproval(formData: FormData) {
  const approvalId = clean(formData.get("approvalId"));
  const decision = clean(formData.get("decision"));

  if (!approvalId || (decision !== "approve" && decision !== "reject")) {
    throw new Error("Approval decision is invalid.");
  }

  const { updateApprovalDecision } = await import("@/lib/autonomy/execution-store");
  const runId = await updateApprovalDecision({
    approvalId,
    decision,
  });

  revalidatePath("/");
  redirect(`/?autonomyRunId=${encodeURIComponent(runId)}#autonomy-preview`);
}

export async function releaseAutonomyLocks(formData: FormData) {
  const runId = clean(formData.get("runId"));

  if (!runId) {
    throw new Error("Run id is required to release locks.");
  }

  const { releaseRunLocks } = await import("@/lib/autonomy/execution-store");
  await releaseRunLocks(runId);
  revalidatePath("/");
  redirect(`/?autonomyRunId=${encodeURIComponent(runId)}#autonomy-preview`);
}

export async function expireAutonomyLocks() {
  const { markExpiredLocks } = await import("@/lib/autonomy/execution-store");

  await markExpiredLocks();
  revalidatePath("/");
  redirect("/#autonomy-preview");
}

export async function restoreRollbackSnapshot(formData: FormData) {
  const snapshotId = clean(formData.get("snapshotId"));

  if (!snapshotId) {
    throw new Error("Rollback snapshot id is required.");
  }

  const { restoreTaskRollbackSnapshotById } = await import("@/lib/autonomy/execution-store");
  const runId = await restoreTaskRollbackSnapshotById(snapshotId);
  revalidatePath("/");
  redirect(`/?autonomyRunId=${encodeURIComponent(runId)}#autonomy-preview`);
}

export async function submitSampleExecutionRequest() {
  const { createExecutionRequest } = await import("@/lib/autonomy/execution-request-store");

  await createExecutionRequest({
    actionType: "file_write",
    payload: {
      content: "Creation Station worker output\n",
      path: "output/worker-live-output.txt",
    },
    taskId: "ui-sample",
  });

  revalidatePath("/");
  redirect("/?autonomyGoal=Build%20v2.1%20adapter%20layer#autonomy-preview");
}

export async function runExecutionWorkerOnce() {
  const { processNextExecutionRequest } = await import("@/lib/autonomy/execution-worker");

  await processNextExecutionRequest({
    workerId: "creation-station-ui-worker",
  });

  revalidatePath("/");
  redirect("/?autonomyGoal=Build%20v2.1%20adapter%20layer#autonomy-preview");
}
