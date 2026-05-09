export type FinalAssemblyStatus = "idle" | "assembling" | "rendering" | "completed" | "failed";

export type FinalAssemblyStage =
  | "scene-assembly"
  | "subtitle-prep"
  | "audio-sync"
  | "render-master"
  | "export-profiles";

export type FinalAssemblyTransition =
  | "hard-cut"
  | "cinematic-fade"
  | "flash-cut"
  | "beat-synced"
  | "atmospheric-dissolve";

export type SubtitleMode = "karaoke" | "cinematic" | "lyric-highlight";

export type ExportProfileId =
  | "youtube-16-9"
  | "tiktok-9-16"
  | "instagram-reels"
  | "lyric-only"
  | "teaser-trailer";

export type FinalAssemblyClipSourceKind = "scene-video" | "fallback-image";

export type FinalAssemblyWarningCode =
  | "duplicate-scene-removed"
  | "missing-scene-fallback"
  | "corrupted-clip-fallback"
  | "duration-mismatch-corrected"
  | "audio-sync-extended-last-scene"
  | "audio-sync-trimmed-last-scene";

export type FinalAssemblyWarning = {
  code: FinalAssemblyWarningCode;
  message: string;
  sceneId?: string;
};

export type FinalAssemblyScene = {
  correctedDuration: number;
  expectedDuration: number;
  fallbackReason?: string;
  isFallback: boolean;
  providerId: string;
  sceneId: string;
  sourceKind: FinalAssemblyClipSourceKind;
  sourcePath: string;
  timelineOrder: number;
  transition: FinalAssemblyTransition;
};

export type FinalAssemblySubtitleCue = {
  end: number;
  lineIndex: number;
  safeZoneMarginV: number;
  start: number;
  text: string;
  words: Array<{
    end: number;
    start: number;
    text: string;
  }>;
};

export type FinalAssemblySubtitleArtifact = {
  mode: SubtitleMode;
  outputPath: string;
  safeZoneMarginV: number;
};

export type FinalAssemblyRenderProfile = {
  clipDurationLimit?: number;
  height: number;
  id: ExportProfileId;
  label: string;
  lyricOnly: boolean;
  subtitleMode: SubtitleMode;
  width: number;
};

export type FinalAssemblyExportArtifact = {
  profileId: ExportProfileId;
  relativePath: string;
};

export type FinalAssemblyArtifacts = {
  assembledVideoPath?: string;
  exportArtifacts: FinalAssemblyExportArtifact[];
  subtitleArtifacts: FinalAssemblySubtitleArtifact[];
};

export type FinalAssemblyState = {
  artifacts: FinalAssemblyArtifacts;
  createdAt: string;
  currentStage: FinalAssemblyStage;
  error?: string;
  projectId: string;
  scenes: FinalAssemblyScene[];
  sourceManifests: {
    audio: string;
    finalAssembly: string;
    lyrics: string;
    providerExecutionPlan: string;
    sceneExecutionManifest: string;
    timelinePlan: string;
  };
  status: FinalAssemblyStatus;
  subtitleCues: FinalAssemblySubtitleCue[];
  updatedAt: string;
  warnings: FinalAssemblyWarning[];
};

export type FinalAssemblyResult = {
  duration: string;
  exportPaths: Record<ExportProfileId, string>;
  outputPath: string;
  packagePath: string;
  primaryExportProfile: ExportProfileId;
  projectId: string;
  renderPath: string;
  status: FinalAssemblyStatus;
  success: boolean;
  usedAudio: string;
  usedImage: string;
};