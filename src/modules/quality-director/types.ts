import type { FinalAssemblyScene, FinalAssemblyState, FinalAssemblySubtitleCue } from "@/modules/final-assembly/types";
import type { SceneMotionPlan } from "@/modules/motion-director/types";
import type { ScenePlan } from "@/modules/scene-planner";
import type { TimelinePlan } from "@/modules/timeline-director/types";
import type { SceneVideoState } from "@/modules/video-generation/types";

export type QualityVerdict = "approved" | "requires-fixes" | "critical-issues";

export type QualityIssueSeverity = "info" | "warning" | "critical";

export type QualityCategoryScores = {
  emotionalStorytelling: number;
  lyricSync: number;
  originality: number;
  pacing: number;
  transitionQuality: number;
  visualQuality: number;
};

export type QualityIssue = {
  evaluator: string;
  message: string;
  recommendation: string;
  sceneId?: string;
  severity: QualityIssueSeverity;
};

export type RetryAction =
  | "regenerate-scene"
  | "shorten-clip"
  | "replace-transition"
  | "re-sequence"
  | "adjust-pacing";

export type RetryPriority = "low" | "medium" | "high";

export type RetryRecommendation = {
  action: RetryAction;
  priority: RetryPriority;
  reason: string;
  targetSceneId?: string;
};

export type QualityReport = {
  categoryScores: QualityCategoryScores;
  evaluatedAt: string;
  issues: QualityIssue[];
  overallScore: number;
  overrideApproved?: boolean;
  projectId: string;
  retryRecommendations: RetryRecommendation[];
  sceneCount: number;
  totalDuration: number;
  verdict: QualityVerdict;
};

export type QualityEvaluationInput = {
  finalAssemblyState: FinalAssemblyState;
  projectId: string;
  sceneMotionPlan: SceneMotionPlan;
  scenePlan: ScenePlan;
  sceneVideoState: SceneVideoState;
  subtitleCues: FinalAssemblySubtitleCue[];
  timelinePlan: TimelinePlan;
};

export type QualityEvaluatorResult = {
  issues: QualityIssue[];
  score: number;
};

export type ExportApprovalDecision = {
  approved: boolean;
  blockers: string[];
  canOverride: boolean;
  verdict: QualityVerdict;
};

export type { FinalAssemblyScene, FinalAssemblySubtitleCue };
