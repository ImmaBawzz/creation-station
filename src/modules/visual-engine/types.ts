export type VisualEngineProjectKind = "lyric_video" | "music_video" | "visualizer";

export type VisualEngineProjectStatus =
  | "draft"
  | "assets_missing"
  | "ready"
  | "rendering"
  | "completed"
  | "failed";

export type VisualEngineProjectManifest = {
  audioFile: string | null;
  createdAt: string;
  id: string;
  imageFiles: string[];
  kind: VisualEngineProjectKind | string;
  lyricsFile: string | null;
  name: string;
  outputFolder: string;
  status: VisualEngineProjectStatus | string;
  updatedAt: string;
  videoFiles: string[];
};

export type VisualEngineProjectValidationResult = {
  errors: string[];
  projectId: string;
  valid: boolean;
  warnings: string[];
};

export type VisualEngineRenderQualityCheck = {
  audioCodec: string | null;
  durationSeconds: number;
  expectedDurationSeconds: number;
  hasAudioStream: boolean;
  hasVideoStream: boolean;
  height: number | null;
  videoCodec: string | null;
  width: number | null;
};

export type VisualEngineRenderResult = {
  duration: string;
  outputPath: string;
  packagePath: string;
  projectId: string;
  qualityCheck?: VisualEngineRenderQualityCheck;
  renderPath: string;
  success: boolean;
  usedAudio: string;
  usedImage: string;
};

export type VisualEnginePackageResult = {
  files: string[];
  metadataPath: string;
  packagePath: string;
  projectId: string;
};

export type VisualEngineLyricsWord = {
  end: number;
  start: number;
  text: string;
};

export type VisualEngineLyricsLine = {
  end: number;
  index: number;
  start: number;
  text: string;
  words: VisualEngineLyricsWord[];
};

export type VisualEngineLyricsArtifacts = {
  assPath: string;
  jsonPath: string;
  lineCount: number;
  lines: VisualEngineLyricsLine[];
  projectId: string;
  srtPath: string;
  wordCount: number;
  words: VisualEngineLyricsWord[];
};
