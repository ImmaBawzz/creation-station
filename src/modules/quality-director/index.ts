import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { readFinalAssemblyState } from "@/modules/final-assembly";
import { evaluateEmotionalArc } from "@/modules/quality-director/emotionalArcEvaluator";
import { evaluateExportReadiness } from "@/modules/quality-director/exportApproval";
import { evaluateLyricSync } from "@/modules/quality-director/lyricSyncEvaluator";
import { evaluatePacing } from "@/modules/quality-director/pacingEvaluator";
import { detectRepetition } from "@/modules/quality-director/repetitionDetector";
import { generateRetryRecommendations } from "@/modules/quality-director/retryRecommendations";
import { evaluateTransitions } from "@/modules/quality-director/transitionEvaluator";
import type { QualityCategoryScores, QualityEvaluationInput, QualityIssue, QualityReport, QualityVerdict } from "@/modules/quality-director/types";
import { evaluateVisualConsistency } from "@/modules/quality-director/visualConsistencyEvaluator";
import { readSceneMotionPlan } from "@/modules/motion-director";
import { readScenePlan } from "@/modules/scene-planner";
import { readTimelinePlan } from "@/modules/timeline-director";
import { readSceneVideoState } from "@/modules/video-generation/sceneVideoManifest";
import { getVisualProjectAssetFolders } from "@/modules/visual-engine/paths";

const QUALITY_REPORT_FILE = "qualityReport.json";
const QUALITY_DIR = "quality";

const CATEGORY_WEIGHTS: Record<keyof QualityCategoryScores, number> = {
  emotionalStorytelling: 0.15,
  lyricSync: 0.15,
  originality: 0.15,
  pacing: 0.2,
  transitionQuality: 0.15,
  visualQuality: 0.2,
};

const APPROVED_THRESHOLD = 80;
const REQUIRES_FIXES_THRESHOLD = 50;

type QualityDirectorError = Error & {
  details?: string[];
  statusCode?: number;
};

function createQualityDirectorError(message: string, statusCode = 400, details?: string[]): QualityDirectorError {
  const error = new Error(message) as QualityDirectorError;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function getQualityDirectory(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).exports, "..", QUALITY_DIR);
}

function getQualityReportPath(projectId: string): string {
  return path.join(getQualityDirectory(projectId), QUALITY_REPORT_FILE);
}

function computeVerdict(overallScore: number, criticalCount: number): QualityVerdict {
  if (criticalCount === 0 && overallScore >= APPROVED_THRESHOLD) {
    return "approved";
  }

  if (overallScore >= REQUIRES_FIXES_THRESHOLD) {
    return "requires-fixes";
  }

  return "critical-issues";
}

function computeOverallScore(categoryScores: QualityCategoryScores): number {
  let weighted = 0;

  for (const [key, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    weighted += (categoryScores[key as keyof QualityCategoryScores] ?? 0) * weight;
  }

  return Math.round(Math.max(0, Math.min(100, weighted)));
}

async function buildEvaluationInput(projectId: string): Promise<QualityEvaluationInput> {
  const finalAssemblyState = await readFinalAssemblyState(projectId);

  if (!finalAssemblyState) {
    throw createQualityDirectorError(
      "Final assembly state not found. Assemble the video before running quality checks.",
      404,
      ["finalAssembly.json missing"],
    );
  }

  const timelinePlan = await readTimelinePlan(projectId);

  if (!timelinePlan) {
    throw createQualityDirectorError(
      "Timeline plan not found. Generate a timeline plan before running quality checks.",
      404,
      ["timelinePlan.json missing"],
    );
  }

  const scenePlan = await readScenePlan(projectId);

  if (!scenePlan) {
    throw createQualityDirectorError(
      "Scene plan not found. Generate a scene plan before running quality checks.",
      404,
      ["scenePlan.json missing"],
    );
  }

  const sceneMotionPlan = await readSceneMotionPlan(projectId);

  if (!sceneMotionPlan) {
    throw createQualityDirectorError(
      "Scene motion plan not found. Generate a motion plan before running quality checks.",
      404,
      ["sceneMotionPlan.json missing"],
    );
  }

  const sceneVideoState = await readSceneVideoState(projectId);

  if (!sceneVideoState) {
    throw createQualityDirectorError(
      "Scene video state not found. Generate scene videos before running quality checks.",
      404,
      ["sceneVideos.json missing"],
    );
  }

  return {
    finalAssemblyState,
    projectId,
    sceneMotionPlan,
    scenePlan,
    sceneVideoState,
    subtitleCues: finalAssemblyState.subtitleCues,
    timelinePlan,
  };
}

export async function runQualityCheck(projectId: string): Promise<QualityReport> {
  const input = await buildEvaluationInput(projectId);

  // Run all evaluators
  const [
    pacingResult,
    repetitionResult,
    transitionResult,
    lyricSyncResult,
    visualConsistencyResult,
    emotionalArcResult,
  ] = await Promise.all([
    Promise.resolve(evaluatePacing(input)),
    Promise.resolve(detectRepetition(input)),
    Promise.resolve(evaluateTransitions(input)),
    Promise.resolve(evaluateLyricSync(input)),
    Promise.resolve(evaluateVisualConsistency(input)),
    Promise.resolve(evaluateEmotionalArc(input)),
  ]);

  // Aggregate scores
  const categoryScores: QualityCategoryScores = {
    emotionalStorytelling: emotionalArcResult.score,
    lyricSync: lyricSyncResult.score,
    originality: repetitionResult.score,
    pacing: pacingResult.score,
    transitionQuality: transitionResult.score,
    visualQuality: visualConsistencyResult.score,
  };

  // Aggregate issues
  const allIssues: QualityIssue[] = [
    ...pacingResult.issues,
    ...repetitionResult.issues,
    ...transitionResult.issues,
    ...lyricSyncResult.issues,
    ...visualConsistencyResult.issues,
    ...emotionalArcResult.issues,
  ];

  const overallScore = computeOverallScore(categoryScores);
  const criticalCount = allIssues.filter((issue) => issue.severity === "critical").length;
  const verdict = computeVerdict(overallScore, criticalCount);
  const retryRecommendations = generateRetryRecommendations(allIssues);

  const totalDuration = input.finalAssemblyState.scenes.reduce(
    (sum, scene) => sum + scene.correctedDuration,
    0,
  );

  const report: QualityReport = {
    categoryScores,
    evaluatedAt: new Date().toISOString(),
    issues: allIssues,
    overallScore,
    projectId,
    retryRecommendations,
    sceneCount: input.finalAssemblyState.scenes.length,
    totalDuration: Number(totalDuration.toFixed(2)),
    verdict,
  };

  // Write report to disk
  const qualityDir = getQualityDirectory(projectId);
  await mkdir(qualityDir, { recursive: true });
  await writeFile(getQualityReportPath(projectId), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return report;
}

export async function readQualityReport(projectId: string): Promise<QualityReport | null> {
  try {
    const source = await readFile(getQualityReportPath(projectId), "utf8");
    const payload = JSON.parse(source) as QualityReport;

    if (!payload || typeof payload !== "object" || typeof payload.overallScore !== "number") {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function approveOverride(projectId: string): Promise<QualityReport> {
  const report = await readQualityReport(projectId);

  if (!report) {
    throw createQualityDirectorError(
      "No quality report found. Run a quality check before approving an override.",
      404,
    );
  }

  const decision = evaluateExportReadiness(report);

  if (decision.blockers.length > 0) {
    throw createQualityDirectorError(
      `Cannot override: ${decision.blockers.join(" ")}`,
      400,
      decision.blockers,
    );
  }

  const updatedReport: QualityReport = {
    ...report,
    overrideApproved: true,
    verdict: "approved",
  };

  await writeFile(getQualityReportPath(projectId), `${JSON.stringify(updatedReport, null, 2)}\n`, "utf8");

  return updatedReport;
}

export type { QualityReport, QualityVerdict, QualityEvaluationInput } from "@/modules/quality-director/types";
