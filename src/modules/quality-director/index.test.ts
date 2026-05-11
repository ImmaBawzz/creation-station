import { describe, expect, it } from "vitest";

import { evaluateEmotionalArc } from "@/modules/quality-director/emotionalArcEvaluator";
import { evaluateExportReadiness } from "@/modules/quality-director/exportApproval";
import { evaluateLyricSync } from "@/modules/quality-director/lyricSyncEvaluator";
import { evaluatePacing } from "@/modules/quality-director/pacingEvaluator";
import { detectRepetition } from "@/modules/quality-director/repetitionDetector";
import { generateRetryRecommendations } from "@/modules/quality-director/retryRecommendations";
import { evaluateTransitions } from "@/modules/quality-director/transitionEvaluator";
import { evaluateVisualConsistency } from "@/modules/quality-director/visualConsistencyEvaluator";
import type { QualityEvaluationInput, QualityIssue, QualityReport } from "@/modules/quality-director/types";
import type { FinalAssemblyState } from "@/modules/final-assembly/types";
import type { TimelinePlan } from "@/modules/timeline-director/types";
import type { ScenePlan } from "@/modules/scene-planner";
import type { SceneMotionPlan } from "@/modules/motion-director/types";
import type { SceneVideoState } from "@/modules/video-generation/types";

function buildMockInput(overrides?: Partial<QualityEvaluationInput>): QualityEvaluationInput {
  const finalAssemblyState: FinalAssemblyState = {
    artifacts: { exportArtifacts: [], subtitleArtifacts: [] },
    createdAt: "2026-01-01T00:00:00Z",
    currentStage: "export-profiles",
    projectId: "test-project",
    scenes: [
      {
        correctedDuration: 4.0,
        expectedDuration: 4.0,
        isFallback: false,
        providerId: "mock",
        sceneId: "scene-001",
        sourceKind: "scene-video",
        sourcePath: "video/scene-001.mp4",
        timelineOrder: 0,
        transition: "hard-cut",
      },
      {
        correctedDuration: 3.5,
        expectedDuration: 3.5,
        isFallback: false,
        providerId: "mock",
        sceneId: "scene-002",
        sourceKind: "scene-video",
        sourcePath: "video/scene-002.mp4",
        timelineOrder: 1,
        transition: "cinematic-fade",
      },
      {
        correctedDuration: 5.0,
        expectedDuration: 5.0,
        isFallback: false,
        providerId: "mock",
        sceneId: "scene-003",
        sourceKind: "scene-video",
        sourcePath: "video/scene-003.mp4",
        timelineOrder: 2,
        transition: "beat-synced",
      },
      {
        correctedDuration: 3.0,
        expectedDuration: 3.0,
        isFallback: false,
        providerId: "mock",
        sceneId: "scene-004",
        sourceKind: "scene-video",
        sourcePath: "video/scene-004.mp4",
        timelineOrder: 3,
        transition: "atmospheric-dissolve",
      },
    ],
    sourceManifests: {
      audio: "audio/master.mp3",
      finalAssembly: "exports/finalAssembly.json",
      lyrics: "lyrics/lyrics.json",
      providerExecutionPlan: "lyrics/providerExecutionPlan.json",
      sceneExecutionManifest: "lyrics/sceneAssets.json",
      timelinePlan: "lyrics/timelinePlan.json",
    },
    status: "completed",
    subtitleCues: [
      { end: 3.5, lineIndex: 0, safeZoneMarginV: 10, start: 0.5, text: "First line of lyrics", words: [{ end: 1.5, start: 0.5, text: "First" }, { end: 2.5, start: 1.5, text: "line" }, { end: 3.5, start: 2.5, text: "of lyrics" }] },
      { end: 7.0, lineIndex: 1, safeZoneMarginV: 10, start: 4.0, text: "Second line of lyrics", words: [{ end: 5.0, start: 4.0, text: "Second" }, { end: 6.0, start: 5.0, text: "line" }, { end: 7.0, start: 6.0, text: "of lyrics" }] },
      { end: 12.0, lineIndex: 2, safeZoneMarginV: 10, start: 8.0, text: "Third line here", words: [{ end: 9.5, start: 8.0, text: "Third" }, { end: 10.5, start: 9.5, text: "line" }, { end: 12.0, start: 10.5, text: "here" }] },
    ],
    updatedAt: "2026-01-01T00:00:00Z",
    warnings: [],
  };

  const timelinePlan: TimelinePlan = {
    climaxMap: [{ reason: "High energy", sceneId: "scene-003", strength: 0.9 }],
    createdAt: "2026-01-01T00:00:00Z",
    pacingMap: [
      { duration: 4.0, endTime: 4.0, pacingScore: 0.4, sceneId: "scene-001", sectionKind: "slow", startTime: 0 },
      { duration: 3.5, endTime: 7.5, pacingScore: 0.6, sceneId: "scene-002", sectionKind: "build", startTime: 4.0 },
      { duration: 5.0, endTime: 12.5, pacingScore: 0.9, sceneId: "scene-003", sectionKind: "drop", startTime: 7.5 },
      { duration: 3.0, endTime: 15.5, pacingScore: 0.3, sceneId: "scene-004", sectionKind: "cooldown", startTime: 12.5 },
    ],
    projectId: "test-project",
    runtimeBalanceStrategy: "balanced",
    sceneSequencing: [
      { adjustedDuration: 4.0, cameraMovement: "slow dolly", climaxAssigned: false, endTime: 4.0, motionIntensity: "low", originalDuration: 4.0, pacingScore: 0.4, sceneId: "scene-001", sectionKind: "slow", sourceImage: "images/scene-001.png", startTime: 0, transitionStyle: "hard-cut" },
      { adjustedDuration: 3.5, cameraMovement: "tracking", climaxAssigned: false, endTime: 7.5, motionIntensity: "medium", originalDuration: 3.5, pacingScore: 0.6, sceneId: "scene-002", sectionKind: "build", sourceImage: "images/scene-002.png", startTime: 4.0, transitionStyle: "cinematic-fade" },
      { adjustedDuration: 5.0, cameraMovement: "push-in", climaxAssigned: true, endTime: 12.5, motionIntensity: "high", originalDuration: 5.0, pacingScore: 0.9, sceneId: "scene-003", sectionKind: "drop", sourceImage: "images/scene-003.png", startTime: 7.5, transitionStyle: "beat-synced" },
      { adjustedDuration: 3.0, cameraMovement: "static", climaxAssigned: false, endTime: 15.5, motionIntensity: "low", originalDuration: 3.0, pacingScore: 0.3, sceneId: "scene-004", sectionKind: "cooldown", sourceImage: "images/scene-004.png", startTime: 12.5, transitionStyle: "atmospheric-dissolve" },
    ],
    sourceManifests: {
      lyricsTiming: "lyrics/lyrics.json",
      sceneMotionPlan: "lyrics/sceneMotionPlan.json",
      scenePlan: "lyrics/scenePlan.json",
      sceneVideos: "lyrics/sceneVideos.json",
      timelinePlan: "lyrics/timelinePlan.json",
    },
    totalRuntime: 15.5,
    transitions: [
      { cutTiming: 0, fadeTiming: 0.25, fromSceneId: "scene-001", overlapTiming: 0, toSceneId: "scene-002", transitionStyle: "cinematic-fade" },
      { cutTiming: 0.08, fadeTiming: 0, fromSceneId: "scene-002", overlapTiming: 0, toSceneId: "scene-003", transitionStyle: "beat-synced" },
      { cutTiming: 0, fadeTiming: 0.35, fromSceneId: "scene-003", overlapTiming: 0, toSceneId: "scene-004", transitionStyle: "atmospheric-dissolve" },
    ],
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const scenePlan: ScenePlan = {
    scenes: [
      { cameraDirection: "Slow reveal", emotionalTone: "steady", endTime: 4.0, generationType: "intro", id: "scene-001", lyricSegment: "First line", priority: "low", startTime: 0, visualDescription: "A calm opening shot of a dark landscape", workflowType: "flux-fast-concept" },
      { cameraDirection: "Tracking shot", emotionalTone: "emotive", endTime: 7.5, generationType: "lyric", id: "scene-002", lyricSegment: "Second line", priority: "high", startTime: 4.0, visualDescription: "An expressive close-up with soft light", workflowType: "flux-dev-cinematic" },
      { cameraDirection: "Push-in", emotionalTone: "intense", endTime: 12.5, generationType: "peak", id: "scene-003", lyricSegment: "Third line", priority: "high", startTime: 7.5, visualDescription: "An explosive high-energy scene with dramatic light", workflowType: "flux-dev-cinematic" },
      { cameraDirection: "Static hold", emotionalTone: "reflective", endTime: 15.5, generationType: "outro", id: "scene-004", lyricSegment: "Final line", priority: "high", startTime: 12.5, visualDescription: "A peaceful closing frame fading to black", workflowType: "flux-dev-cinematic" },
    ],
  };

  const sceneMotionPlan: SceneMotionPlan = {
    createdAt: "2026-01-01T00:00:00Z",
    projectId: "test-project",
    scenes: [
      { cameraMovement: "slow dolly forward", duration: 4.0, endFrameStrategy: "hold", environmentalMovement: "subtle mist", loopSuitability: "medium", motionIntensity: "low", pacingScore: 0.4, providerCompatibilityTags: ["universal-static-anchor"], sceneId: "scene-001", sourceImage: "images/scene-001.png", startFrameStrategy: "fade-in", subjectMovement: "none", templateKey: "atmospheric", transitionType: "fade" },
      { cameraMovement: "medium tracking right", duration: 3.5, endFrameStrategy: "cut", environmentalMovement: "light particles", loopSuitability: "medium", motionIntensity: "medium", pacingScore: 0.6, providerCompatibilityTags: ["wan-safe-drift"], sceneId: "scene-002", sourceImage: "images/scene-002.png", startFrameStrategy: "match-previous", subjectMovement: "subtle sway", templateKey: "emotional", transitionType: "dissolve" },
      { cameraMovement: "aggressive push-in", duration: 5.0, endFrameStrategy: "flash", environmentalMovement: "debris", loopSuitability: "low", motionIntensity: "high", pacingScore: 0.9, providerCompatibilityTags: ["wan-impact-cut"], sceneId: "scene-003", sourceImage: "images/scene-003.png", startFrameStrategy: "impact", subjectMovement: "explosive", templateKey: "high-energy", transitionType: "smash-cut" },
      { cameraMovement: "static wide", duration: 3.0, endFrameStrategy: "fade-out", environmentalMovement: "none", loopSuitability: "high", motionIntensity: "low", pacingScore: 0.3, providerCompatibilityTags: ["universal-static-anchor"], sceneId: "scene-004", sourceImage: "images/scene-004.png", startFrameStrategy: "gentle", subjectMovement: "none", templateKey: "atmospheric", transitionType: "fade" },
    ],
    sourceManifests: {
      sceneAssets: "lyrics/sceneAssets.json",
      sceneMotionPlan: "lyrics/sceneMotionPlan.json",
      scenePlan: "lyrics/scenePlan.json",
    },
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const sceneVideoState: SceneVideoState = {
    approvedSceneIds: ["scene-001", "scene-002", "scene-003", "scene-004"],
    createdAt: "2026-01-01T00:00:00Z",
    jobs: [
      { cameraDirection: "slow dolly", completedAt: "2026-01-01T00:01:00Z", duration: 4.0, id: "job-1", motionPrompt: "slow reveal", motionType: "cinematic-drift", provider: "mock", sceneId: "scene-001", sourceImage: "images/scene-001.png", startedAt: "2026-01-01T00:00:30Z", status: "completed" },
      { cameraDirection: "tracking", completedAt: "2026-01-01T00:01:30Z", duration: 3.5, id: "job-2", motionPrompt: "tracking right", motionType: "cinematic-drift", provider: "mock", sceneId: "scene-002", sourceImage: "images/scene-002.png", startedAt: "2026-01-01T00:01:00Z", status: "completed" },
      { cameraDirection: "push-in", completedAt: "2026-01-01T00:02:00Z", duration: 5.0, id: "job-3", motionPrompt: "aggressive push", motionType: "pulse-cut", provider: "mock", sceneId: "scene-003", sourceImage: "images/scene-003.png", startedAt: "2026-01-01T00:01:30Z", status: "completed" },
      { cameraDirection: "static", completedAt: "2026-01-01T00:02:30Z", duration: 3.0, id: "job-4", motionPrompt: "static hold", motionType: "steady-hold", provider: "mock", sceneId: "scene-004", sourceImage: "images/scene-004.png", startedAt: "2026-01-01T00:02:00Z", status: "completed" },
    ],
    progress: { completed: 4, failed: 0, pending: 0, processed: 4, running: 0, total: 4 },
    projectId: "test-project",
    provider: "mock",
    sourceManifests: {
      sceneAssets: "lyrics/sceneAssets.json",
      scenePlan: "lyrics/scenePlan.json",
      sceneVideos: "lyrics/sceneVideos.json",
    },
    status: "completed",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  return {
    finalAssemblyState,
    projectId: "test-project",
    sceneMotionPlan,
    scenePlan,
    sceneVideoState,
    subtitleCues: finalAssemblyState.subtitleCues,
    timelinePlan,
    ...overrides,
  };
}

describe("quality-director", () => {
  describe("pacingEvaluator", () => {
    it("returns no issues for balanced scenes", () => {
      const input = buildMockInput();
      const result = evaluatePacing(input);

      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it("detects a duration outlier", () => {
      const input = buildMockInput();
      input.finalAssemblyState.scenes[2].correctedDuration = 60.0;

      const result = evaluatePacing(input);

      expect(result.issues.some((i) => i.sceneId === "scene-003")).toBe(true);
      expect(result.score).toBeLessThan(100);
    });

    it("detects a scene that is too short", () => {
      const input = buildMockInput();
      input.finalAssemblyState.scenes[0].correctedDuration = 0.3;

      const result = evaluatePacing(input);

      expect(result.issues.some((i) => i.sceneId === "scene-001" && i.message.includes("too short"))).toBe(true);
    });

    it("returns empty issues for no scenes", () => {
      const input = buildMockInput();
      input.finalAssemblyState.scenes = [];

      const result = evaluatePacing(input);

      expect(result.issues).toHaveLength(0);
      expect(result.score).toBe(100);
    });
  });

  describe("repetitionDetector", () => {
    it("returns no issues for unique scenes", () => {
      const input = buildMockInput();
      const result = detectRepetition(input);

      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it("detects duplicate source images", () => {
      const input = buildMockInput();
      input.finalAssemblyState.scenes[1].sourcePath = input.finalAssemblyState.scenes[0].sourcePath;

      const result = detectRepetition(input);

      expect(result.issues.some((i) => i.message.includes("reused"))).toBe(true);
    });

    it("detects similar visual descriptions", () => {
      const input = buildMockInput();
      input.scenePlan.scenes[1].visualDescription = input.scenePlan.scenes[0].visualDescription;

      const result = detectRepetition(input);

      expect(result.issues.some((i) => i.message.includes("similar visual descriptions"))).toBe(true);
    });
  });

  describe("transitionEvaluator", () => {
    it("returns no issues for varied transitions", () => {
      const input = buildMockInput();
      const result = evaluateTransitions(input);

      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it("detects overuse of a single transition", () => {
      const input = buildMockInput();

      for (const scene of input.finalAssemblyState.scenes) {
        scene.transition = "hard-cut";
      }

      const result = evaluateTransitions(input);

      expect(result.issues.some((i) => i.message.includes("overused"))).toBe(true);
    });
  });

  describe("lyricSyncEvaluator", () => {
    it("returns no critical issues for aligned cues", () => {
      const input = buildMockInput();
      const result = evaluateLyricSync(input);

      expect(result.issues.filter((i) => i.severity === "critical")).toHaveLength(0);
    });

    it("detects lyric cue after all scenes end", () => {
      const input = buildMockInput();
      input.subtitleCues.push({
        end: 999,
        lineIndex: 10,
        safeZoneMarginV: 10,
        start: 990,
        text: "Orphan lyric",
        words: [{ end: 999, start: 990, text: "Orphan" }],
      });

      const result = evaluateLyricSync(input);

      expect(result.issues.some((i) => i.severity === "critical" && i.message.includes("after all scenes"))).toBe(true);
    });
  });

  describe("visualConsistencyEvaluator", () => {
    it("returns no issues when all scenes use video", () => {
      const input = buildMockInput();
      const result = evaluateVisualConsistency(input);

      expect(result.issues.filter((i) => i.message.includes("fallback"))).toHaveLength(0);
    });

    it("detects high fallback ratio", () => {
      const input = buildMockInput();

      for (const scene of input.finalAssemblyState.scenes) {
        scene.isFallback = true;
        scene.sourceKind = "fallback-image";
      }

      const result = evaluateVisualConsistency(input);

      expect(result.issues.some((i) => i.severity === "critical" && i.message.includes("fallback"))).toBe(true);
    });
  });

  describe("emotionalArcEvaluator", () => {
    it("returns no major issues for a complete arc", () => {
      const input = buildMockInput();
      const result = evaluateEmotionalArc(input);

      expect(result.score).toBeGreaterThanOrEqual(60);
    });

    it("detects consecutive emotional peaks", () => {
      const input = buildMockInput();
      input.timelinePlan.sceneSequencing[1].sectionKind = "emotional-peak";
      input.timelinePlan.sceneSequencing[2].sectionKind = "emotional-peak";

      const result = evaluateEmotionalArc(input);

      expect(result.issues.some((i) => i.message.includes("Consecutive emotional peaks"))).toBe(true);
    });

    it("detects flat pacing scores", () => {
      const input = buildMockInput();

      for (const item of input.timelinePlan.sceneSequencing) {
        item.pacingScore = 0.5;
      }

      const result = evaluateEmotionalArc(input);

      expect(result.issues.some((i) => i.message.includes("flat"))).toBe(true);
    });
  });

  describe("exportApproval", () => {
    it("approves a high-scoring report", () => {
      const report: QualityReport = {
        categoryScores: { emotionalStorytelling: 90, lyricSync: 85, originality: 88, pacing: 92, transitionQuality: 87, visualQuality: 91 },
        evaluatedAt: "2026-01-01T00:00:00Z",
        issues: [],
        overallScore: 89,
        projectId: "test",
        retryRecommendations: [],
        sceneCount: 4,
        totalDuration: 15.5,
        verdict: "approved",
      };

      const decision = evaluateExportReadiness(report);

      expect(decision.approved).toBe(true);
      expect(decision.blockers).toHaveLength(0);
    });

    it("blocks a very low scoring report", () => {
      const report: QualityReport = {
        categoryScores: { emotionalStorytelling: 10, lyricSync: 5, originality: 8, pacing: 12, transitionQuality: 7, visualQuality: 10 },
        evaluatedAt: "2026-01-01T00:00:00Z",
        issues: Array.from({ length: 8 }, (_, i) => ({
          evaluator: "test",
          message: `Issue ${i}`,
          recommendation: "Fix it",
          severity: "critical" as const,
        })),
        overallScore: 9,
        projectId: "test",
        retryRecommendations: [],
        sceneCount: 4,
        totalDuration: 15.5,
        verdict: "critical-issues",
      };

      const decision = evaluateExportReadiness(report);

      expect(decision.approved).toBe(false);
      expect(decision.blockers.length).toBeGreaterThan(0);
    });
  });

  describe("retryRecommendations", () => {
    it("generates recommendations from issues", () => {
      const issues: QualityIssue[] = [
        { evaluator: "pacing", message: "scene-003 is significantly longer than average", recommendation: "Shorten it", sceneId: "scene-003", severity: "warning" },
        { evaluator: "repetition", message: "Source reused across scenes", recommendation: "Regenerate", sceneId: "scene-002", severity: "critical" },
      ];

      const recommendations = generateRetryRecommendations(issues);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].priority).toBe("high");
    });

    it("deduplicates recommendations for the same scene and action", () => {
      const issues: QualityIssue[] = [
        { evaluator: "pacing", message: "Scene longer than average", recommendation: "Shorten", sceneId: "scene-001", severity: "warning" },
        { evaluator: "pacing", message: "Scene takes too long", recommendation: "Shorten clip", sceneId: "scene-001", severity: "warning" },
      ];

      const recommendations = generateRetryRecommendations(issues);
      const scene001Recs = recommendations.filter((r) => r.targetSceneId === "scene-001" && r.action === "shorten-clip");

      expect(scene001Recs).toHaveLength(1);
    });

    it("returns empty for no issues", () => {
      const recommendations = generateRetryRecommendations([]);

      expect(recommendations).toHaveLength(0);
    });
  });
});
