import type {
  CostProtectorStatus,
  ProjectFailureSummary,
} from "@/modules/regeneration-governor/types";

// One "cost unit" = one regeneration attempt (provider-agnostic abstraction)
export const DEFAULT_MAX_BUDGET_UNITS = 20;
const COST_PER_ATTEMPT = 1;
const COST_PER_PROVIDER_SWAP = 2; // Provider swaps cost double

export function estimateCostUnits(memory: ProjectFailureSummary): number {
  let total = 0;

  for (const record of memory.sceneRecords) {
    // Base cost: one unit per attempt
    total += record.totalAttempts * COST_PER_ATTEMPT;

    // Extra cost: each provider swap (tracked by how many different providers tried)
    const swaps = Math.max(0, record.providersTriedCount - 1);
    total += swaps * COST_PER_PROVIDER_SWAP;
  }

  return total;
}

/**
 * Evaluate whether the project is still within its regeneration budget.
 */
export function evaluateCostProtection(
  memory: ProjectFailureSummary,
  maxBudgetUnits = DEFAULT_MAX_BUDGET_UNITS,
): CostProtectorStatus {
  const estimatedCostUnits = estimateCostUnits(memory);
  const remainingBudgetUnits = Math.max(0, maxBudgetUnits - estimatedCostUnits);
  const budgetExceeded = estimatedCostUnits >= maxBudgetUnits;

  const succeeded = memory.sceneRecords.reduce((sum, r) => {
    const lastAttempt = r.attempts.at(-1);
    return sum + (lastAttempt && r.recurringIssueKinds.length === 0 ? 0 : 0);
  }, 0);

  const failed = memory.sceneRecords.filter((r) => r.totalAttempts > 0).length;
  const awaitingRetry = memory.sceneRecords.filter(
    (r) => r.totalAttempts > 0 && r.totalAttempts < 3,
  ).length;

  return {
    budgetExceeded,
    estimatedCostUnits,
    maxBudgetUnits,
    projectId: memory.projectId,
    remainingBudgetUnits,
    sceneCounts: {
      awaitingRetry,
      failed,
      succeeded,
      total: memory.sceneRecords.length,
    },
  };
}
