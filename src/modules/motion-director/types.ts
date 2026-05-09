export type MotionTemplateKey = "emotional" | "performance" | "battle" | "reveal" | "atmospheric" | "high-energy" | "dreamlike";

export type MotionIntensityLabel = "low" | "medium" | "high" | "extreme";
export type LoopSuitability = "high" | "medium" | "low";

export type ProviderCompatibilityTag =
  | "universal-static-anchor"
  | "wan-safe-drift"
  | "wan-impact-cut"
  | "ltx-loop-safe"
  | "ltx-parallax-ready"
  | "kling-emotive-closeup"
  | "kling-performance-ready";

export type MotionTemplate = {
  cameraMovement: string;
  environmentalMovement: string;
  key: MotionTemplateKey;
  subjectMovement: string;
};

export type SceneMotionPlanItem = {
  cameraMovement: string;
  duration: number;
  endFrameStrategy: string;
  environmentalMovement: string;
  motionIntensity: MotionIntensityLabel;
  pacingScore: number;
  providerCompatibilityTags: ProviderCompatibilityTag[];
  sceneId: string;
  sourceImage: string;
  startFrameStrategy: string;
  subjectMovement: string;
  templateKey: MotionTemplateKey;
  transitionType: string;
  loopSuitability: LoopSuitability;
};

export type SceneMotionPlan = {
  createdAt: string;
  projectId: string;
  scenes: SceneMotionPlanItem[];
  sourceManifests: {
    sceneAssets: string;
    sceneMotionPlan: string;
    scenePlan: string;
  };
  updatedAt: string;
};