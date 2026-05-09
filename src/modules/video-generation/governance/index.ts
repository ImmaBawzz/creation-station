import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { TimelinePlan, TimelineSceneSequenceItem } from "@/modules/timeline-director/types";
import {
  buildProviderCompatibilityReasons,
  filterCompatibleProviders,
  recommendedPrimaryByExample,
} from "@/modules/video-generation/governance/providerCompatibility";
import { estimateSceneCost, scoreCost } from "@/modules/video-generation/governance/providerCostRules";
import { getFallbackProviders } from "@/modules/video-generation/governance/providerFallbackMatrix";
import { PROVIDER_HEALTH, scoreProviderHealth } from "@/modules/video-generation/governance/providerHealth";
import { deriveScenePolicySignals, buildPolicyNotes } from "@/modules/video-generation/governance/providerPolicies";
import { scoreProviderCapabilities } from "@/modules/video-generation/governance/providerCapabilities";
import { PROVIDER_REGISTRY } from "@/modules/video-generation/governance/providerRegistry";
import type {
  ProviderExecutionPlan,
  ProviderExecutionPlanScene,
  RankedProviderCandidate,
  TimelineProviderInput,
  VideoProviderId,
} from "@/modules/video-generation/governance/types";
import { relativeProjectPath } from "@/modules/visual-engine/manifest";
import { getVisualProjectAssetFolders } from "@/modules/visual-engine/paths";

const PROVIDER_EXECUTION_PLAN_FILE = "providerExecutionPlan.json";
const TIMELINE_PLAN_FILE = "timelinePlan.json";

type ProviderGovernanceError = Error & {
  details?: string[];
  statusCode?: number;
};

function createProviderGovernanceError(message: string, statusCode = 400, details?: string[]): ProviderGovernanceError {
  const error = new Error(message) as ProviderGovernanceError;
  error.details = details;
  error.statusCode = statusCode;
  return error;
}

function getProviderExecutionPlanPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, PROVIDER_EXECUTION_PLAN_FILE);
}

function getTimelinePlanPath(projectId: string): string {
  return path.join(getVisualProjectAssetFolders(projectId).lyrics, TIMELINE_PLAN_FILE);
}

function normalizePlan(plan: Omit<ProviderExecutionPlan, "updatedAt"> & { updatedAt?: string }): ProviderExecutionPlan {
  return {
    ...plan,
    updatedAt: new Date().toISOString(),
  };
}

export async function readProviderExecutionPlan(projectId: string): Promise<ProviderExecutionPlan | null> {
  try {
    const source = await readFile(getProviderExecutionPlanPath(projectId), "utf8");
    const payload = JSON.parse(source) as ProviderExecutionPlan;

    if (!payload || typeof payload !== "object" || !Array.isArray(payload.scenePlans)) {
      return null;
    }

    return normalizePlan(payload);
  } catch {
    return null;
  }
}

export async function readTimelinePlanForGovernance(projectId: string): Promise<TimelinePlan | null> {
  try {
    const source = await readFile(getTimelinePlanPath(projectId), "utf8");
    const payload = JSON.parse(source) as TimelinePlan;

    if (!payload || typeof payload !== "object" || !Array.isArray(payload.sceneSequencing)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function toProviderInput(scene: TimelineSceneSequenceItem): TimelineProviderInput {
  return {
    adjustedDuration: scene.adjustedDuration,
    cameraMovement: scene.cameraMovement,
    climaxAssigned: scene.climaxAssigned,
    motionIntensity: scene.motionIntensity,
    pacingScore: scene.pacingScore,
    sceneId: scene.sceneId,
    sourceImage: scene.sourceImage,
    transitionStyle: scene.transitionStyle,
  };
}

function rankProvidersForScene(scene: TimelineSceneSequenceItem): ProviderExecutionPlanScene {
  const input = toProviderInput(scene);
  const policySignals = deriveScenePolicySignals(input);
  const preferred = new Set(recommendedPrimaryByExample(input));
  const rankedProviders: RankedProviderCandidate[] = filterCompatibleProviders(PROVIDER_REGISTRY, input)
    .map((provider) => {
      const capability = scoreProviderCapabilities(provider, policySignals, input);
      const health = PROVIDER_HEALTH[provider.id];
      const healthScore = scoreProviderHealth(provider, health);
      const costScore = scoreCost(provider);
      const preferredBonus = preferred.has(provider.id) ? 0.08 : 0;
      const total = Number((
        capability.realism * 0.18
        + capability.motion * 0.18
        + capability.camera * 0.16
        + capability.environment * 0.12
        + capability.facial * 0.12
        + capability.duration * 0.08
        + capability.stylization * 0.08
        + costScore * 0.04
        + healthScore * 0.04
        + preferredBonus
      ).toFixed(3));

      return {
        breakdown: {
          camera: Number(capability.camera.toFixed(3)),
          cost: Number(costScore.toFixed(3)),
          duration: Number(capability.duration.toFixed(3)),
          environment: Number(capability.environment.toFixed(3)),
          facial: Number(capability.facial.toFixed(3)),
          health: Number(healthScore.toFixed(3)),
          motion: Number(capability.motion.toFixed(3)),
          realism: Number(capability.realism.toFixed(3)),
          stylization: Number(capability.stylization.toFixed(3)),
          total,
        },
        estimatedCost: estimateSceneCost(provider, input),
        fallbackProviders: getFallbackProviders(provider.id),
        health,
        policyNotes: buildPolicyNotes(input, provider.id),
        providerId: provider.id,
        providerName: provider.name,
      } satisfies RankedProviderCandidate;
    })
    .sort((left, right) => right.breakdown.total - left.breakdown.total);

  const [primary] = rankedProviders;

  if (!primary) {
    throw createProviderGovernanceError(`No compatible provider candidates were available for ${scene.sceneId}.`, 500);
  }

  return {
    estimatedCost: primary.estimatedCost,
    fallbackProviders: primary.fallbackProviders,
    healthStatus: primary.health.status,
    primaryProvider: primary.providerId,
    rankedProviders,
    reasons: buildProviderCompatibilityReasons(
      PROVIDER_REGISTRY.find((provider) => provider.id === primary.providerId) ?? PROVIDER_REGISTRY[0],
      input,
    ),
    sceneId: scene.sceneId,
    sourceImage: scene.sourceImage,
  };
}

function buildProviderAllocation(scenePlans: ProviderExecutionPlanScene[]) {
  const grouped = new Map<VideoProviderId, { estimatedCost: number; sceneIds: string[] }>();

  for (const scene of scenePlans) {
    const current = grouped.get(scene.primaryProvider) ?? { estimatedCost: 0, sceneIds: [] };
    current.estimatedCost = Number((current.estimatedCost + scene.estimatedCost).toFixed(2));
    current.sceneIds.push(scene.sceneId);
    grouped.set(scene.primaryProvider, current);
  }

  return [...grouped.entries()].map(([providerId, allocation]) => ({
    estimatedCost: allocation.estimatedCost,
    providerId,
    sceneIds: allocation.sceneIds,
  }));
}

export async function generateProviderExecutionPlan(projectId: string): Promise<ProviderExecutionPlan> {
  const timelinePlan = await readTimelinePlanForGovernance(projectId);

  if (!timelinePlan) {
    throw createProviderGovernanceError(
      "Timeline plan not found. Generate a timeline plan before simulating provider execution.",
      404,
      ["timelinePlan.json missing"],
    );
  }

  if (timelinePlan.sceneSequencing.length === 0) {
    throw createProviderGovernanceError("Timeline plan has no scenes to simulate.", 400);
  }

  const scenePlans = timelinePlan.sceneSequencing.map(rankProvidersForScene);
  const providerAllocation = buildProviderAllocation(scenePlans);
  const estimatedTotalCost = Number(scenePlans.reduce((sum, scene) => sum + scene.estimatedCost, 0).toFixed(2));
  const createdAt = new Date().toISOString();

  const plan = normalizePlan({
    createdAt,
    estimatedTotalCost,
    projectId,
    providerAllocation,
    scenePlans,
    sourceManifests: {
      providerExecutionPlan: relativeProjectPath(getProviderExecutionPlanPath(projectId)),
      timelinePlan: relativeProjectPath(getTimelinePlanPath(projectId)),
    },
    updatedAt: createdAt,
  });

  await mkdir(path.dirname(getProviderExecutionPlanPath(projectId)), { recursive: true });
  await writeFile(getProviderExecutionPlanPath(projectId), `${JSON.stringify(plan, null, 2)}\n`, "utf8");

  return plan;
}

export { PROVIDER_HEALTH, PROVIDER_REGISTRY };