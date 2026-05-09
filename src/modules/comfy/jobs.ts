import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { ComfyError } from "@/modules/comfy/client";
import type { SupportedComfyWorkflowType } from "@/modules/comfy/queue";

export type ComfyJobStatus = "queued" | "running" | "importing" | "completed" | "failed" | "timeout";

export type ComfyTrackedJob = {
  completedAt?: string;
  createdAt: string;
  error?: string;
  imagePath?: string;
  jobId: string;
  manifestPath?: string;
  projectId: string;
  promptId: string;
  status: ComfyJobStatus;
  timeoutMs: number;
  updatedAt: string;
  workflowType: SupportedComfyWorkflowType;
};

const COMFY_JOB_ROOT = path.join(process.cwd(), "output", "temp", "comfy-jobs");
const COMFY_JOB_LOCK_ROOT = path.join(COMFY_JOB_ROOT, "locks");

function getJobPath(jobId: string): string {
  return path.join(COMFY_JOB_ROOT, `${jobId}.json`);
}

function getProjectLockPath(projectId: string): string {
  return path.join(COMFY_JOB_LOCK_ROOT, `${projectId}.json`);
}

function isTerminalStatus(status: ComfyJobStatus): boolean {
  return status === "completed" || status === "failed" || status === "timeout";
}

async function ensureJobDirectories(): Promise<void> {
  await mkdir(COMFY_JOB_LOCK_ROOT, { recursive: true });
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const source = await readFile(filePath, "utf8");
    return JSON.parse(source) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await ensureJobDirectories();
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function releaseProjectLock(projectId: string, jobId?: string): Promise<void> {
  const lockPath = getProjectLockPath(projectId);

  if (!jobId) {
    await rm(lockPath, { force: true });
    return;
  }

  const lock = await readJsonFile<{ jobId?: string }>(lockPath);
  if (!lock?.jobId || lock.jobId === jobId) {
    await rm(lockPath, { force: true });
  }
}

export async function readComfyJob(jobId: string): Promise<ComfyTrackedJob | null> {
  return readJsonFile<ComfyTrackedJob>(getJobPath(jobId));
}

export async function createComfyJob({
  projectId,
  promptId,
  timeoutMs,
  workflowType,
}: {
  projectId: string;
  promptId: string;
  timeoutMs: number;
  workflowType: SupportedComfyWorkflowType;
}): Promise<ComfyTrackedJob> {
  await ensureJobDirectories();

  const activeJob = await getActiveComfyJobForProject(projectId);
  if (activeJob) {
    throw new ComfyError(`A Comfy job is already active for project ${projectId}.`, {
      code: "COMFY_DUPLICATE_JOB",
      details: [activeJob.jobId, activeJob.status],
      statusCode: 409,
    });
  }

  const timestamp = new Date().toISOString();
  const job: ComfyTrackedJob = {
    createdAt: timestamp,
    jobId: randomUUID(),
    projectId,
    promptId,
    status: "queued",
    timeoutMs,
    updatedAt: timestamp,
    workflowType,
  };

  await writeJsonFile(getJobPath(job.jobId), job);
  await writeJsonFile(getProjectLockPath(projectId), { jobId: job.jobId, updatedAt: timestamp });

  return job;
}

export async function updateComfyJob(
  jobId: string,
  updates: Partial<Omit<ComfyTrackedJob, "jobId" | "projectId" | "promptId" | "workflowType" | "createdAt">>,
): Promise<ComfyTrackedJob> {
  const currentJob = await readComfyJob(jobId);

  if (!currentJob) {
    throw new ComfyError(`Comfy job was not found: ${jobId}`, {
      code: "COMFY_JOB_NOT_FOUND",
      statusCode: 404,
    });
  }

  const nextJob: ComfyTrackedJob = {
    ...currentJob,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (updates.status && isTerminalStatus(updates.status) && !updates.completedAt) {
    nextJob.completedAt = new Date().toISOString();
  }

  await writeJsonFile(getJobPath(jobId), nextJob);

  if (isTerminalStatus(nextJob.status)) {
    await releaseProjectLock(nextJob.projectId, nextJob.jobId);
  }

  return nextJob;
}

export async function getActiveComfyJobForProject(projectId: string): Promise<ComfyTrackedJob | null> {
  const lockPath = getProjectLockPath(projectId);
  const lock = await readJsonFile<{ jobId?: string }>(lockPath);

  if (!lock?.jobId) {
    return null;
  }

  const job = await readComfyJob(lock.jobId);
  if (!job) {
    await releaseProjectLock(projectId);
    return null;
  }

  if (isTerminalStatus(job.status)) {
    await releaseProjectLock(projectId, job.jobId);
    return null;
  }

  return job;
}

export async function comfJobFileExists(jobId: string): Promise<boolean> {
  try {
    await stat(getJobPath(jobId));
    return true;
  } catch {
    return false;
  }
}