import type { QualityIssue, RetryAction, RetryRecommendation } from "@/modules/quality-director/types";

type IssuePatternRule = {
  action: RetryAction;
  evaluators: string[];
  keywords: string[];
};

const PATTERN_RULES: IssuePatternRule[] = [
  {
    action: "regenerate-scene",
    evaluators: ["repetition", "visual-consistency"],
    keywords: ["reused", "fallback", "duplicate", "similar", "regenerate"],
  },
  {
    action: "shorten-clip",
    evaluators: ["pacing"],
    keywords: ["longer", "too long", "dominating", "dominates"],
  },
  {
    action: "adjust-pacing",
    evaluators: ["pacing"],
    keywords: ["shorter", "too short", "monoton", "uniform", "brief"],
  },
  {
    action: "replace-transition",
    evaluators: ["transition"],
    keywords: ["overuse", "harsh", "slow", "variety"],
  },
  {
    action: "re-sequence",
    evaluators: ["emotional-arc"],
    keywords: ["consecutive", "jump", "flat", "missing", "abrupt"],
  },
];

function matchesPattern(issue: QualityIssue, rule: IssuePatternRule): boolean {
  const evaluatorMatch = rule.evaluators.includes(issue.evaluator);
  const messageLower = issue.message.toLowerCase();
  const keywordMatch = rule.keywords.some((keyword) => messageLower.includes(keyword));

  return evaluatorMatch && keywordMatch;
}

function severityToPriority(severity: QualityIssue["severity"]): RetryRecommendation["priority"] {
  switch (severity) {
    case "critical":
      return "high";
    case "warning":
      return "medium";
    case "info":
    default:
      return "low";
  }
}

export function generateRetryRecommendations(issues: QualityIssue[]): RetryRecommendation[] {
  const recommendations: RetryRecommendation[] = [];
  const seen = new Set<string>();

  // Sort issues by severity (critical first)
  const sorted = [...issues].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  for (const issue of sorted) {
    for (const rule of PATTERN_RULES) {
      if (!matchesPattern(issue, rule)) {
        continue;
      }

      // Deduplicate by action + scene
      const dedupeKey = `${rule.action}:${issue.sceneId ?? "global"}`;

      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);

      recommendations.push({
        action: rule.action,
        priority: severityToPriority(issue.severity),
        reason: issue.recommendation,
        targetSceneId: issue.sceneId,
      });
    }
  }

  // Sort by priority (high first)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}
