import type { ExportApprovalDecision, QualityReport } from "@/modules/quality-director/types";

const APPROVED_THRESHOLD = 80;
const OVERRIDE_THRESHOLD = 40;

export function evaluateExportReadiness(report: QualityReport): ExportApprovalDecision {
  const blockers: string[] = [];
  const criticalIssues = report.issues.filter((issue) => issue.severity === "critical");

  if (report.overallScore < OVERRIDE_THRESHOLD) {
    blockers.push(`Overall quality score (${report.overallScore}) is below minimum threshold (${OVERRIDE_THRESHOLD}).`);
  }

  if (criticalIssues.length > 5) {
    blockers.push(`Too many critical issues (${criticalIssues.length}). Address at least some before export.`);
  }

  for (const [category, score] of Object.entries(report.categoryScores)) {
    if (score < 20) {
      blockers.push(`${formatCategoryName(category)} score is critically low (${score}/100).`);
    }
  }

  const approved = report.overallScore >= APPROVED_THRESHOLD && criticalIssues.length === 0;
  const canOverride = !approved && blockers.length === 0;

  return {
    approved: approved || Boolean(report.overrideApproved),
    blockers,
    canOverride,
    verdict: report.verdict,
  };
}

function formatCategoryName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
