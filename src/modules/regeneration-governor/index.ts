import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { readQualityReport } from "@/modules/quality-director";
import { evaluateCostProtection } from "@/modules/regeneration-governor/costProtector";
import { evaluateEscalations, hasBlockingEscalation } from "@/modules/regeneration-governor/escalationRules";
import { buildAllFallbacks } from "@/modules/regeneration-governor/fallbackDecision";
import { buildFailureMemory, getSceneFailureRecord } from "@/modules/regeneration-governor/failureMemory";
import { contributeToGlobalPatterns, readGlobalPatternMemory } from "@/modules/regeneration-governor/patternMemory";
import { buildFailureMemoryReport } from "@/modules/regeneration-governor/preventionRecommendations";
import { extractPromptFailures, mergePromptFailures } from "@/modules/regeneration-governor/promptFailurePatterns";
import { calculateProviderScores, mergeProviderScores } from "@/modules/regeneration-governor/providerScoring";
import { buildAllStrategies } from "@/modules/regeneration-governor/regenerationStrategy";
import { checkProjectRetryBudget, getAllSceneLimits } from "@/modules/regeneration-governor/retryLimiter";
import type {
  FailureMemoryReport,
  ProjectFailureSummary,
  RegenerationReport,
  RegenerationVerdict,
} from "@/modules/regeneration-governor/types";
import { extractVisualFailures, mergeVisualFailures } from "@/modules/regeneration-governor/visualFailurePatterns";
import { writeGlobalPatternMemory } from "@/modules/regeneration-governor/patternMemory";
import { getVisualProjectAssetFolders } from "@/modules/visual-engine/paths";

const REGENERATION_REPORT_FILE = "regenerationReport.json";
const FAILURE_MEMORY_FILE = "failureMemory.json";
const FAILURE_MEMORY_REPORT_FILE = "failureMemoryReport.json";
const QUALITY_DIR = "quality";

type GovernorError = Error & {
  details?: string[];
  statusCode?: number;
};

function createGovernorError(message: string, statusCode = 400, details?: string[]): GovernorError {
  const error = new Error(message) as GovernorError;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function getQualityDirectory(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).exports, "..", QUALITY_DIR);
}

function getReportPath(projectId: string): string {
  return path.join(getQualityDirectory(projectId), REGENERATION_REPORT_FILE);
}

function getMemoryPath(projectId: string): string {
  return path.join(getQualityDirectory(projectId), FAILURE_MEMORY_FILE);
}

function getMemoryReportPath(projectId: string): string {
  return path.join(getQualityDirectory(projectId), FAILURE_MEMORY_REPORT_FILE);
}

async function readFailureMemory(projectId: string): Promise<ProjectFailureSummary | null> {
  try {
    const source = await readFile(getMemoryPath(projectId), "utf8");
    const payload = JSON.parse(source) as ProjectFailureSummary;

    if (!payload || typeof payload !== "object" || payload.projectId !== projectId) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function writeFailureMemory(memory: ProjectFailureSummary): Promise<void> {
  const dir = getQualityDirectory(memory.projectId);
  await mkdir(dir, { recursive: true });
  await writeFile(getMemoryPath(memory.projectId), `${JSON.stringify(memory, null, 2)}\n`, "utf8");
}

async function writeReport(report: RegenerationReport): Promise<void> {
  const dir = getQualityDirectory(report.projectId);
  await mkdir(dir, { recursive: true });
  await writeFile(getReportPath(report.projectId), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function writeMemoryReport(report: FailureMemoryReport): Promise<void> {
  const dir = getQualityDirectory(report.projectId);
  await mkdir(dir, { recursive: true });
  await writeFile(getMemoryReportPath(report.projectId), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function computeVerdict(
  budgetExceeded: boolean,
  hasBlockers: boolean,
  hasHumanReview: boolean,
  hasHaltActions: boolean,
  totalAttempts: number,
): RegenerationVerdict {
  if (hasHaltActions) {
    return "pipeline-halted";
  }

  if (hasHumanReview) {
    return "human-review-required";
  }

  if (budgetExceeded) {
    return "budget-exceeded";
  }

  if (hasBlockers) {
    return "retries-consumed";
  }

  if (totalAttempts === 0) {
    return "clean";
  }

  return "retries-consumed";
}

/**
 * Run the regeneration governor against the latest quality report.
 * Reads the existing failure memory, incorporates new failures,
 * contributes to global pattern memory, and produces reports.
 */
export async function runRegenerationGovernor(projectId: string): Promise<RegenerationReport> {
  const qualityReport = await readQualityReport(projectId);

  if (!qualityReport) {
    throw createGovernorError(
      "No quality report found. Run a quality check before the regeneration governor.",
      404,
      ["qualityReport.json missing"],
    );
  }

  // Load existing failure memory and merge new failures
  const existingMemory = await readFailureMemory(projectId);
  const memory = buildFailureMemory(projectId, qualityReport.issues, existingMemory);

  // Persist updated failure memory
  await writeFailureMemory(memory);

  // Contribute to global pattern memory (cross-project learning)
  let globalMemory = await contributeToGlobalPatterns(memory);

  // Extract and merge prompt/visual failure patterns
  const promptFailures = extractPromptFailures(memory);
  globalMemory = mergePromptFailures(globalMemory, promptFailures, projectId);

  const visualFailures = extractVisualFailures(memory);
  globalMemory = mergeVisualFailures(globalMemory, visualFailures, projectId);

  // Calculate and merge provider scores
  const providerScores = calculateProviderScores(globalMemory, memory);
  globalMemory = mergeProviderScores(globalMemory, providerScores);

  // Persist updated global memory
  await writeGlobalPatternMemory(globalMemory);

  // Evaluate limits, costs, escalations
  const projectBudget = checkProjectRetryBudget(memory);
  const sceneLimits = getAllSceneLimits(memory);
  const escalations = evaluateEscalations(memory);
  const costStatus = evaluateCostProtection(memory);

  // Build strategies and fallback decisions
  const sceneStrategies = buildAllStrategies(memory, sceneLimits, escalations, costStatus);
  const fallbackDecisions = buildAllFallbacks(sceneStrategies, escalations, memory);

  // Compute summary counts
  const scenesRetryAllowed = sceneStrategies.filter((s) => s.action === "retry-scene" || s.action === "swap-provider-and-retry").length;
  const scenesEscalated = sceneStrategies.filter((s) => s.action === "swap-provider-and-retry").length;
  const scenesFlagged = sceneStrategies.filter((s) => s.action === "flag-for-human-review").length;
  const scenesHalted = sceneStrategies.filter((s) => s.action === "halt-pipeline").length;

  // Determine verdict
  const hasBlockers = hasBlockingEscalation(escalations);
  const hasHumanReview = scenesFlagged > 0;
  const hasHaltActions = scenesHalted > 0 || !projectBudget.allowFurtherRetries;

  const verdict = computeVerdict(
    costStatus.budgetExceeded,
    hasBlockers,
    hasHumanReview,
    hasHaltActions,
    memory.totalProjectAttempts,
  );

  const report: RegenerationReport = {
    budgetStatus: costStatus,
    createdAt: new Date().toISOString(),
    escalations,
    fallbackDecisions,
    projectId,
    sceneStrategies,
    summary: {
      scenesEscalated,
      scenesFlagged,
      scenesHalted,
      scenesRetryAllowed,
      totalScenes: memory.sceneRecords.length,
    },
    verdict,
  };

  await writeReport(report);

  return report;
}

/**
 * Generate a failure memory report for a project.
 * Combines global pattern memory with project-specific failure data.
 */
export async function generateMemoryReport(projectId: string): Promise<FailureMemoryReport> {
  const projectMemory = await readFailureMemory(projectId);

  if (!projectMemory) {
    throw createGovernorError(
      "No failure memory found. Run the regeneration governor before generating a memory report.",
      404,
      ["failureMemory.json missing"],
    );
  }

  const globalMemory = await readGlobalPatternMemory();
  const report = buildFailureMemoryReport(projectId, globalMemory, projectMemory);

  await writeMemoryReport(report);

  return report;
}

/**
 * Read an existing failure memory report from disk.
 */
export async function readMemoryReport(projectId: string): Promise<FailureMemoryReport | null> {
  try {
    const source = await readFile(getMemoryReportPath(projectId), "utf8");
    const payload = JSON.parse(source) as FailureMemoryReport;

    if (!payload || typeof payload !== "object" || !payload.projectId) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Read an existing regeneration report from disk.
 */
export async function readRegenerationReport(projectId: string): Promise<RegenerationReport | null> {
  try {
    const source = await readFile(getReportPath(projectId), "utf8");
    const payload = JSON.parse(source) as RegenerationReport;

    if (!payload || typeof payload !== "object" || !payload.projectId) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Apply a manual override, marking the report as human-approved and
 * resetting the verdict to allow continued pipeline execution.
 */
export async function applyManualOverride(projectId: string): Promise<RegenerationReport> {
  const report = await readRegenerationReport(projectId);

  if (!report) {
    throw createGovernorError(
      "No regeneration report found. Run the regeneration governor before applying an override.",
      404,
    );
  }

  if (report.verdict === "pipeline-halted") {
    throw createGovernorError(
      "Pipeline is fully halted. A hard-stop cannot be overridden here — address the underlying failures first.",
      400,
    );
  }

  const updated: RegenerationReport = {
    ...report,
    manualOverrideApplied: true,
    verdict: "clean",
  };

  await writeReport(updated);

  return updated;
}

/**
 * Reset the failure memory for a project (used after successful regeneration).
 */
export async function resetFailureMemory(projectId: string): Promise<void> {
  const fresh: ProjectFailureSummary = {
    firstAttemptAt: new Date().toISOString(),
    lastAttemptAt: new Date().toISOString(),
    projectId,
    sceneRecords: [],
    totalProjectAttempts: 0,
  };

  await writeFailureMemory(fresh);
}

/**
 * Get the failure record for a specific scene (for UI display).
 */
export async function getSceneStatus(projectId: string, sceneId: string) {
  const memory = await readFailureMemory(projectId);

  if (!memory) {
    return null;
  }

  return getSceneFailureRecord(memory, sceneId);
}

export type {
  FailureMemoryReport,
  RegenerationReport,
  RegenerationVerdict,
  ProjectFailureSummary,
} from "@/modules/regeneration-governor/types";
