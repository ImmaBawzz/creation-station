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
