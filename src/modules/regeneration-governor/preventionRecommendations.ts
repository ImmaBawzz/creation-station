import type {
  FailureMemoryReport,
  GlobalPatternMemory,
  PreventionRecommendation,
  ProjectFailureSummary,
  ProviderReliabilityRecord,
} from "@/modules/regeneration-governor/types";
import { getTopPatterns } from "@/modules/regeneration-governor/patternMemory";
import { calculateProviderScores, getUnreliableProviders } from "@/modules/regeneration-governor/providerScoring";
import { extractPromptFailures } from "@/modules/regeneration-governor/promptFailurePatterns";
import { extractVisualFailures } from "@/modules/regeneration-governor/visualFailurePatterns";

/**
 * Generate prevention recommendations from global patterns and project data.
 */
export function generatePreventionRecommendations(
  globalMemory: GlobalPatternMemory,
  projectMemory: ProjectFailureSummary,
  providerScores: ProviderReliabilityRecord[],
): PreventionRecommendation[] {
  const recommendations: PreventionRecommendation[] = [];

  // 1. Unreliable provider warnings
  const unreliable = getUnreliableProviders(providerScores);

  for (const provider of unreliable) {
    recommendations.push({
      action: `Avoid provider "${provider.provider}" for future generations (reliability: ${provider.reliabilityScore}%).`,
      category: "provider",
      confidence: Math.min(1, provider.totalAttempts / 5),
      reason: `${provider.provider} has a ${provider.reliabilityScore}% reliability score across ${provider.totalAttempts} attempts.`,
      relatedPatterns: [`provider:${provider.provider}`],
    });
  }

  // 2. Recurring global failure patterns
  const topPatterns = getTopPatterns(globalMemory, 5);

  for (const pattern of topPatterns) {
    if (pattern.frequency >= 3) {
      recommendations.push({
        action: `Address recurring "${pattern.pattern}" failures before next generation cycle.`,
        category: pattern.category,
        confidence: Math.min(1, pattern.frequency / 10),
        reason: `"${pattern.pattern}" has occurred ${pattern.frequency} times across ${pattern.projectIds.length} project(s).`,
        relatedPatterns: [pattern.pattern],
      });
    }
  }

  // 3. Prompt instability warnings
  const promptFailures = extractPromptFailures(projectMemory);

  for (const pf of promptFailures) {
    if (pf.failureCount >= 2) {
      recommendations.push({
        action: `Avoid prompt phrase "${pf.phrase}" in future scene descriptions.`,
        category: "prompt",
        confidence: Math.min(1, pf.failureCount / 5),
        reason: `"${pf.phrase}" has caused ${pf.failureCount} failure(s).`,
        relatedPatterns: [pf.phrase],
      });
    }
  }

  // 4. Visual pattern warnings
  const visualFailures = extractVisualFailures(projectMemory);

  for (const vf of visualFailures) {
    if (vf.failureCount >= 2) {
      recommendations.push({
        action: `Mitigate "${vf.pattern}" by adjusting scene planning or provider selection.`,
        category: "visual",
        confidence: Math.min(1, vf.failureCount / 5),
        reason: `"${vf.pattern}" has affected ${vf.affectedSceneCount} scene(s) across ${vf.failureCount} occurrence(s).`,
        relatedPatterns: [vf.pattern],
      });
    }
  }

  // Sort by confidence (highest first)
  return recommendations.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Build a complete failure memory report for a project.
 */
export function buildFailureMemoryReport(
  projectId: string,
  globalMemory: GlobalPatternMemory,
  projectMemory: ProjectFailureSummary,
): FailureMemoryReport {
  const providerScores = calculateProviderScores(globalMemory, projectMemory);
  const preventionRecommendations = generatePreventionRecommendations(
    globalMemory,
    projectMemory,
    providerScores,
  );

  const topPatterns = getTopPatterns(globalMemory, 10);
  const promptFailures = extractPromptFailures(projectMemory);
  const visualFailures = extractVisualFailures(projectMemory);

  const totalFailuresTracked = globalMemory.failurePatterns.reduce(
    (sum, p) => sum + p.frequency,
    0,
  );

  const totalCostWaste = globalMemory.failurePatterns.reduce(
    (sum, p) => sum + p.totalCostUnits,
    0,
  );

  const recoveryRates = globalMemory.failurePatterns
    .filter((p) => p.recoveryRate > 0)
    .map((p) => p.recoveryRate);
  const averageRecoveryRate =
    recoveryRates.length > 0
      ? recoveryRates.reduce((sum, r) => sum + r, 0) / recoveryRates.length
      : 0;

  return {
    createdAt: new Date().toISOString(),
    globalPatternCount: globalMemory.failurePatterns.length,
    preventionRecommendations,
    projectId,
    providerScores,
    summary: {
      averageRecoveryRate: Number(averageRecoveryRate.toFixed(3)),
      mostCommonFailures: topPatterns.slice(0, 5).map((p) => ({
        count: p.frequency,
        pattern: p.pattern,
      })),
      totalCostWaste,
      totalFailuresTracked,
    },
    topPromptFailures: promptFailures.slice(0, 5),
    topVisualFailures: visualFailures.slice(0, 5),
  };
}
