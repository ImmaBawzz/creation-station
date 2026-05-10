import type { ProviderCost, ProviderType } from "./types";

const projectCosts = new Map<string, ProviderCost[]>();

export async function trackCost(projectId: string, provider: ProviderType, costUsd: number, creditsUsed: number = 0): Promise<void> {
  const costRecord: ProviderCost = {
    provider,
    creditsUsed,
    estimatedCostUsd: costUsd,
  };
  
  const costs = projectCosts.get(projectId) ?? [];
  costs.push(costRecord);
  projectCosts.set(projectId, costs);
  
  // In a real implementation, this would write to the database
  console.log(`[Cost Tracker] Project: ${projectId} | Provider: ${provider} | Cost: $${costUsd.toFixed(4)} | Credits: ${creditsUsed}`);
  
  return Promise.resolve();
}

export async function getProjectCostSummary(projectId: string): Promise<{ totalUsd: number; totalCredits: number }> {
  const costs = projectCosts.get(projectId) ?? [];
  const totalUsd = costs.reduce((sum, c) => sum + c.estimatedCostUsd, 0);
  const totalCredits = costs.reduce((sum, c) => sum + c.creditsUsed, 0);
  
  return { totalUsd, totalCredits };
}
