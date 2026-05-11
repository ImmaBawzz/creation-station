export type CreativeStrategyReport = {
  contrastRecommendations: ContrastRecommendation[];
  createdAt: string;
  emotionalPeaks: EmotionalPeakPlan[];
  hookOptimizations: HookOptimization[];
  payoffEvaluation: PayoffEvaluation;
  platformStrategies: PlatformStrategy[];
  projectId: string;
  replayMoments: ReplayMoment[];
  retentionAnalysis: RetentionAnalysis;
};

export type RetentionWarning = {
  reason: string;
  recommendedAction: string;
  sceneId: string;
  severity: "low" | "medium" | "high";
  timeWindow: [number, number];
};

export type RetentionAnalysis = {
  firstTenSecondsScore: number;
  overallRetentionScore: number;
  pacingRepetitionWarnings: RetentionWarning[];
  weakOpeningsDetected: boolean;
};

export type EmotionalPeakPlan = {
  buildupStartTime: number;
  intensity: number; // 0-100
  peakEndTime: number;
  peakStartTime: number;
  recommendedVisualTone: string;
  relatedSceneIds: string[];
};

export type ReplayMoment = {
  description: string;
  endTime: number;
  reason: string;
  sceneId: string;
  startTime: number;
  viralPotentialScore: number; // 0-100
};

export type HookOptimization = {
  improvedHookDescription: string;
  originalSceneId: string;
  reason: string;
  targetAudienceSegment: string;
  timeWindow: [number, number];
};

export type ContrastRecommendation = {
  contrastType: "color" | "motion" | "scale" | "brightness";
  description: string;
  fromSceneId: string;
  reason: string;
  toSceneId: string;
};

export type PlatformVariant = "tiktok" | "shorts" | "reels" | "youtube-longform" | "lyric-video";

export type PlatformStrategy = {
  bestPerformingAspectRatio: string;
  callToActionTiming: number;
  idealLength: number;
  pacingMultiplier: number; // e.g. 1.2x for faster pacing
  platform: PlatformVariant;
  recommendedTextOverlays: string[];
};

export type PayoffEvaluation = {
  buildUpToPayoffRatio: number;
  satisfactionScore: number; // 0-100
  strongestPayoffSceneId: string;
  weakestPayoffSceneId: string;
};
