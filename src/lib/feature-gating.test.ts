import { describe, expect, it } from "vitest";

import {
  canAccessFeature,
  getReleaseStageLabel,
  getVisibleFeatureGates,
  normalizeReleaseStage,
  normalizeUserAccessLevel,
  parseFeatureFlags,
  type FeatureGateContext,
} from "./feature-gating";

const publicMvpContext: FeatureGateContext = {
  featureFlags: {},
  releaseStage: "stage3_public_mvp",
  userAccessLevel: "public_user",
};

describe("feature gating", () => {
  it("normalizes unknown stage and access values to internal defaults", () => {
    expect(normalizeReleaseStage("unknown")).toBe("stage0_internal");
    expect(normalizeUserAccessLevel("unknown")).toBe("internal");
  });

  it("allows public MVP features while withholding private, partner, and advanced features", () => {
    expect(canAccessFeature("idea_inbox", publicMvpContext)).toBe(true);
    expect(canAccessFeature("content_pipeline_manual", publicMvpContext)).toBe(true);
    expect(canAccessFeature("creator_run_production_packet", publicMvpContext)).toBe(false);
    expect(canAccessFeature("content_manual_monetization", publicMvpContext)).toBe(false);
    expect(canAccessFeature("music_video_builder", publicMvpContext)).toBe(false);
    expect(canAccessFeature("autonomy_worker_execution", publicMvpContext)).toBe(false);
    expect(canAccessFeature("release_controls", publicMvpContext)).toBe(false);
  });

  it("lets internal users inspect release-ready features without exposing not-ready work by default", () => {
    const internalContext: FeatureGateContext = {
      featureFlags: {},
      releaseStage: "stage0_internal",
      userAccessLevel: "internal",
    };

    expect(canAccessFeature("music_video_builder", internalContext)).toBe(true);
    expect(canAccessFeature("creator_run_production_packet", internalContext)).toBe(true);
    expect(canAccessFeature("external_publishing_integrations", internalContext)).toBe(false);
  });

  it("allows production packets for private creator workflows", () => {
    expect(
      canAccessFeature("creator_run_production_packet", {
        featureFlags: {},
        releaseStage: "stage1_private_creator",
        userAccessLevel: "private_creator",
      }),
    ).toBe(true);
  });

  it("supports explicit feature flag opt-in and opt-out", () => {
    expect(parseFeatureFlags("content_pipeline_manual=false,music_video_builder,!release_controls")).toEqual({
      content_pipeline_manual: false,
      music_video_builder: true,
      release_controls: false,
    });

    expect(
      canAccessFeature("content_pipeline_manual", {
        ...publicMvpContext,
        featureFlags: { content_pipeline_manual: false },
      }),
    ).toBe(false);

    expect(
      canAccessFeature("external_publishing_integrations", {
        featureFlags: { external_publishing_integrations: true },
        releaseStage: "stage6_full_platform",
        userAccessLevel: "internal",
      }),
    ).toBe(true);
  });

  it("returns only visible features for the active context", () => {
    const visibleFeatureIds = getVisibleFeatureGates(publicMvpContext).map(
      (feature) => feature.id,
    );

    expect(visibleFeatureIds).toContain("dashboard");
    expect(visibleFeatureIds).toContain("content_manual_metrics");
    expect(visibleFeatureIds).not.toContain("creator_run_production_packet");
    expect(visibleFeatureIds).not.toContain("content_manual_monetization");
    expect(visibleFeatureIds).not.toContain("provider_runtime_governance");
  });

  it("returns readable release stage labels", () => {
    expect(getReleaseStageLabel("stage4_partner_agency")).toBe(
      "Stage 4: Partner/agency release",
    );
  });
});
