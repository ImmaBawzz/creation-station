export type VideoProviderId = "wan" | "kling" | "ltx" | "runway" | "pika" | "local-mock";
export type ProviderCostTier = "low" | "medium" | "high" | "premium";
export type ProviderHealthStatus = "online" | "offline" | "maintenance" | "deprecated" | "overloaded";

export type ProviderProfile = {
  apiReadiness: number;
  cameraScore: number;
  costTier: ProviderCostTier;
  environmentComplexitySupport: number;
  failureRate: number;
  id: VideoProviderId;
  maxDuration: number;
  motionScore: number;
  name: string;
  offlineLocalSupport: boolean;
  portraitSupport: number;
  queueSpeed: number;
  queueStability: number;
  realismScore: number;
};

export type ProviderHealthState = {
  notes?: string;
  queueLoad: number;
  status: ProviderHealthStatus;
};

export type TimelineProviderInput = {
  adjustedDuration: number;
  cameraMovement: string;
  climaxAssigned: boolean;
  motionIntensity: string;
  pacingScore: number;
  sceneId: string;
  sourceImage: string;
  transitionStyle: string;
};

export type ProviderScoreBreakdown = {
  camera: number;
  cost: number;
  duration: number;
  environment: number;
  facial: number;
  health: number;
  motion: number;
  realism: number;
  stylization: number;
  total: number;
};

export type RankedProviderCandidate = {
  breakdown: ProviderScoreBreakdown;
  estimatedCost: number;
  fallbackProviders: VideoProviderId[];
  health: ProviderHealthState;
  policyNotes: string[];
  providerId: VideoProviderId;
  providerName: string;
};

export type ProviderExecutionPlanScene = {
  estimatedCost: number;
  fallbackProviders: VideoProviderId[];
  healthStatus: ProviderHealthStatus;
  primaryProvider: VideoProviderId;
  rankedProviders: RankedProviderCandidate[];
  reasons: string[];
  sceneId: string;
  sourceImage: string;
};

export type ProviderExecutionPlan = {
  createdAt: string;
  estimatedTotalCost: number;
  projectId: string;
  providerAllocation: Array<{
    estimatedCost: number;
    providerId: VideoProviderId;
    sceneIds: string[];
  }>;
  scenePlans: ProviderExecutionPlanScene[];
  sourceManifests: {
    providerExecutionPlan: string;
    timelinePlan: string;
  };
  updatedAt: string;
};