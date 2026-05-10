import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { readScenePlan } from "@/modules/scene-planner";
import { readTimelinePlan } from "@/modules/timeline-director";
import { getVisualProjectAssetFolders } from "@/modules/visual-engine/paths";

import { generateContrastRecommendations } from "@/modules/creative-strategy/contrastEngine";
import { planEmotionalPeaks } from "@/modules/creative-strategy/emotionalPeakPlanner";
import { optimizeHook } from "@/modules/creative-strategy/hookOptimizer";
import { evaluatePayoff } from "@/modules/creative-strategy/payoffEvaluator";
import { generatePlatformStrategies } from "@/modules/creative-strategy/platformStrategy";
import { planReplayMoments } from "@/modules/creative-strategy/replayMomentPlanner";
import { analyzeRetention } from "@/modules/creative-strategy/retentionAnalyzer";
import type { CreativeStrategyReport } from "@/modules/creative-strategy/types";

const REPORT_FILE = "creativeStrategyReport.json";
const QUALITY_DIR = "quality";

type StrategyError = Error & {
  details?: string[];
  statusCode?: number;
};

function createStrategyError(message: string, statusCode = 400, details?: string[]): StrategyError {
  const error = new Error(message) as StrategyError;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function getQualityDirectory(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).exports, "..", QUALITY_DIR);
}

function getReportPath(projectId: string): string {
  return path.join(getQualityDirectory(projectId), REPORT_FILE);
}

/**
 * Generates the creative strategy report.
 */
export async function generateCreativeStrategyReport(projectId: string): Promise<CreativeStrategyReport> {
  const scenePlan = await readScenePlan(projectId);
  if (!scenePlan) {
    throw createStrategyError("Scene plan not found. Run scene planner first.", 404);
  }

  const timelinePlan = await readTimelinePlan(projectId);
  if (!timelinePlan) {
    throw createStrategyError("Timeline plan not found. Run timeline director first.", 404);
  }

  const retentionAnalysis = analyzeRetention(scenePlan, timelinePlan);
  const emotionalPeaks = planEmotionalPeaks(scenePlan, timelinePlan);
  const replayMoments = planReplayMoments(scenePlan, timelinePlan);
  const hookOptimizations = optimizeHook(scenePlan, timelinePlan);
  const contrastRecommendations = generateContrastRecommendations(scenePlan, timelinePlan);
  const platformStrategies = generatePlatformStrategies(timelinePlan.totalRuntime);
  const payoffEvaluation = evaluatePayoff(scenePlan, timelinePlan);

  const report: CreativeStrategyReport = {
    contrastRecommendations,
    createdAt: new Date().toISOString(),
    emotionalPeaks,
    hookOptimizations,
    payoffEvaluation,
    platformStrategies,
    projectId,
    replayMoments,
    retentionAnalysis,
  };

  const dir = getQualityDirectory(projectId);
  await mkdir(dir, { recursive: true });
  await writeFile(getReportPath(projectId), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return report;
}

/**
 * Reads an existing creative strategy report.
 */
export async function readCreativeStrategyReport(projectId: string): Promise<CreativeStrategyReport | null> {
  try {
    const source = await readFile(getReportPath(projectId), "utf8");
    const payload = JSON.parse(source) as CreativeStrategyReport;

    if (!payload || typeof payload !== "object" || payload.projectId !== projectId) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export type { CreativeStrategyReport } from "@/modules/creative-strategy/types";
