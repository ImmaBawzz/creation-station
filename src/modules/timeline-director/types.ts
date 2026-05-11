export type TimelineSectionKind = "slow" | "build" | "drop" | "emotional-peak" | "cooldown";

export type TimelineTransition = {
  cutTiming: number;
  fadeTiming: number;
  fromSceneId: string;
  overlapTiming: number;
  toSceneId: string;
  transitionStyle: string;
};

export type TimelinePacingEntry = {
  duration: number;
  endTime: number;
  pacingScore: number;
  sceneId: string;
  sectionKind: TimelineSectionKind;
  startTime: number;
};

export type TimelineClimaxEntry = {
  reason: string;
  sceneId: string;
  strength: number;
};

export type TimelineSceneSequenceItem = {
  adjustedDuration: number;
  cameraMovement: string;
  climaxAssigned: boolean;
  endTime: number;
  motionIntensity: string;
  originalDuration: number;
  pacingScore: number;
  sceneId: string;
  sectionKind: TimelineSectionKind;
  sourceImage: string;
  startTime: number;
  transitionStyle: string;
};

export type TimelinePlan = {
  climaxMap: TimelineClimaxEntry[];
  createdAt: string;
  pacingMap: TimelinePacingEntry[];
  projectId: string;
  runtimeBalanceStrategy: "compressed-lower-priority" | "extended-strongest-scenes" | "balanced";
  sceneSequencing: TimelineSceneSequenceItem[];
  sourceManifests: {
    lyricsTiming: string;
    sceneMotionPlan: string;
    scenePlan: string;
    sceneVideos: string;
    timelinePlan: string;
  };
  totalRuntime: number;
  transitions: TimelineTransition[];
  updatedAt: string;
};