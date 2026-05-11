export type FeatureReleaseClass =
  | "Advanced Release"
  | "Internal Only"
  | "Not Needed Yet"
  | "Not Ready"
  | "Partner Release"
  | "Private Beta"
  | "Public MVP";

export const RELEASE_STAGE_DEFINITIONS = [
  {
    id: "stage0_internal",
    label: "Stage 0: Internal use only",
    order: 0,
    summary: "Local operator validation before external users depend on the system.",
  },
  {
    id: "stage1_private_creator",
    label: "Stage 1: Private creator workflow tool",
    order: 1,
    summary: "One trusted creator uses the product for real work with manual review.",
  },
  {
    id: "stage2_invite_beta",
    label: "Stage 2: Invite-only beta",
    order: 2,
    summary: "Small cohort testing with controlled onboarding and feedback loops.",
  },
  {
    id: "stage3_public_mvp",
    label: "Stage 3: Limited public MVP",
    order: 3,
    summary: "Public-safe creator workflow without high-impact automation.",
  },
  {
    id: "stage4_partner_agency",
    label: "Stage 4: Partner/agency release",
    order: 4,
    summary: "Higher-trust collaboration and production workflows for vetted partners.",
  },
  {
    id: "stage5_advanced_automation",
    label: "Stage 5: Advanced automation release",
    order: 5,
    summary: "Audited automation for proven workflows with strict approval controls.",
  },
  {
    id: "stage6_full_platform",
    label: "Stage 6: Full platform release",
    order: 6,
    summary: "Scaled platform release after safety, trust, and ecosystem controls mature.",
  },
] as const;

export type ReleaseStageId = (typeof RELEASE_STAGE_DEFINITIONS)[number]["id"];

export const USER_ACCESS_LEVELS = [
  "public_user",
  "private_creator",
  "beta_user",
  "partner",
  "advanced_operator",
  "platform_admin",
  "internal",
] as const;

export type UserAccessLevel = (typeof USER_ACCESS_LEVELS)[number];

export type FeatureGateDefinition = {
  classification: FeatureReleaseClass;
  defaultEnabled: boolean;
  description: string;
  id: string;
  internalOnly?: boolean;
  label: string;
  minAccessLevel: UserAccessLevel;
  minStage: ReleaseStageId;
  publicMvpSafe: boolean;
};

export const FEATURE_GATES = [
  {
    classification: "Public MVP",
    defaultEnabled: true,
    description: "Read-only workspace counts, recent work, and local workflow overview.",
    id: "dashboard",
    label: "Dashboard overview",
    minAccessLevel: "public_user",
    minStage: "stage0_internal",
    publicMvpSafe: true,
  },
  {
    classification: "Public MVP",
    defaultEnabled: true,
    description: "Local idea capture, search, archive, and pipeline filtering.",
    id: "idea_inbox",
    label: "Idea inbox",
    minAccessLevel: "public_user",
    minStage: "stage0_internal",
    publicMvpSafe: true,
  },
  {
    classification: "Public MVP",
    defaultEnabled: true,
    description: "Human-reviewed factory planning flow using configured local AI provider.",
    id: "factory_planner",
    label: "Factory planner",
    minAccessLevel: "public_user",
    minStage: "stage0_internal",
    publicMvpSafe: true,
  },
  {
    classification: "Public MVP",
    defaultEnabled: true,
    description: "Plan review, revision, approval, task creation, blockers, and task status changes.",
    id: "review_task_board",
    label: "Review and task board",
    minAccessLevel: "public_user",
    minStage: "stage0_internal",
    publicMvpSafe: true,
  },
  {
    classification: "Public MVP",
    defaultEnabled: true,
    description: "Manual local JSON backup export for user-controlled data portability.",
    id: "backup_export",
    label: "Backup export",
    minAccessLevel: "public_user",
    minStage: "stage0_internal",
    publicMvpSafe: true,
  },
  {
    classification: "Private Beta",
    defaultEnabled: true,
    description: "Restore local workspace data from JSON backup with validation.",
    id: "backup_restore",
    label: "Backup restore",
    minAccessLevel: "private_creator",
    minStage: "stage1_private_creator",
    publicMvpSafe: false,
  },
  {
    classification: "Private Beta",
    defaultEnabled: true,
    description: "AI provider health, local model settings, and prompt preset controls.",
    id: "settings_provider_health",
    label: "Settings and provider health",
    minAccessLevel: "private_creator",
    minStage: "stage1_private_creator",
    publicMvpSafe: false,
  },
  {
    classification: "Public MVP",
    defaultEnabled: true,
    description: "Manual content idea, brief, draft, publishing prep, and published-state tracking.",
    id: "content_pipeline_manual",
    label: "Manual content pipeline",
    minAccessLevel: "public_user",
    minStage: "stage1_private_creator",
    publicMvpSafe: true,
  },
  {
    classification: "Private Beta",
    defaultEnabled: true,
    description: "Creator Run v0.1 production packets and manual production task bridge.",
    id: "creator_run_production_packet",
    label: "Creator Run production packet",
    minAccessLevel: "private_creator",
    minStage: "stage1_private_creator",
    publicMvpSafe: false,
  },
  {
    classification: "Public MVP",
    defaultEnabled: true,
    description: "Manual performance snapshots for published content.",
    id: "content_manual_metrics",
    label: "Manual content metrics",
    minAccessLevel: "public_user",
    minStage: "stage3_public_mvp",
    publicMvpSafe: true,
  },
  {
    classification: "Private Beta",
    defaultEnabled: true,
    description: "Manual monetization notes, offer links, and revenue attribution.",
    id: "content_manual_monetization",
    label: "Manual monetization tracking",
    minAccessLevel: "private_creator",
    minStage: "stage2_invite_beta",
    publicMvpSafe: false,
  },
  {
    classification: "Private Beta",
    defaultEnabled: true,
    description: "Local activity events, analytics summaries, and workflow history.",
    id: "activity_analytics",
    label: "Activity and analytics",
    minAccessLevel: "private_creator",
    minStage: "stage1_private_creator",
    publicMvpSafe: false,
  },
  {
    classification: "Private Beta",
    defaultEnabled: true,
    description: "AI recommendations, route detection, staleness signals, and task prioritization.",
    id: "intelligence_layer",
    label: "Intelligence layer",
    minAccessLevel: "private_creator",
    minStage: "stage1_private_creator",
    publicMvpSafe: false,
  },
  {
    classification: "Partner Release",
    defaultEnabled: true,
    description: "Music-video prompt packs, upload workflow, FFmpeg packaging, and local builder UI.",
    id: "music_video_builder",
    label: "Music video builder",
    minAccessLevel: "partner",
    minStage: "stage4_partner_agency",
    publicMvpSafe: false,
  },
  {
    classification: "Partner Release",
    defaultEnabled: true,
    description: "Visual project manifests, render validation, lyric artifacts, and media project browsing.",
    id: "visual_engine_media",
    label: "Visual engine media",
    minAccessLevel: "partner",
    minStage: "stage4_partner_agency",
    publicMvpSafe: false,
  },
  {
    classification: "Partner Release",
    defaultEnabled: true,
    description: "Provider readiness, payload inspection, workflow certification, cost rules, and health checks.",
    id: "provider_runtime_governance",
    label: "Provider runtime governance",
    minAccessLevel: "partner",
    minStage: "stage4_partner_agency",
    publicMvpSafe: false,
  },
  {
    classification: "Advanced Release",
    defaultEnabled: true,
    description: "Scene, motion, timeline, quality, regeneration, and final assembly orchestration.",
    id: "advanced_media_orchestration",
    label: "Advanced media orchestration",
    minAccessLevel: "advanced_operator",
    minStage: "stage5_advanced_automation",
    publicMvpSafe: false,
  },
  {
    classification: "Internal Only",
    defaultEnabled: true,
    description: "Autonomy preview, approval queues, rollback snapshots, locks, and execution simulation.",
    id: "autonomy_preview",
    internalOnly: true,
    label: "Autonomy preview",
    minAccessLevel: "internal",
    minStage: "stage0_internal",
    publicMvpSafe: false,
  },
  {
    classification: "Advanced Release",
    defaultEnabled: true,
    description: "Worker daemon, execution request queue, live unlock, and controlled execution routing.",
    id: "autonomy_worker_execution",
    label: "Autonomy worker execution",
    minAccessLevel: "advanced_operator",
    minStage: "stage5_advanced_automation",
    publicMvpSafe: false,
  },
  {
    classification: "Internal Only",
    defaultEnabled: true,
    description: "Release checklist, release staging docs, and gate inspection surfaces.",
    id: "release_controls",
    internalOnly: true,
    label: "Release controls",
    minAccessLevel: "internal",
    minStage: "stage0_internal",
    publicMvpSafe: false,
  },
  {
    classification: "Not Ready",
    defaultEnabled: false,
    description: "Direct publishing APIs and unattended posting to external platforms.",
    id: "external_publishing_integrations",
    label: "External publishing integrations",
    minAccessLevel: "platform_admin",
    minStage: "stage6_full_platform",
    publicMvpSafe: false,
  },
  {
    classification: "Not Ready",
    defaultEnabled: false,
    description: "Imported analytics from social, video, newsletter, or ad platforms.",
    id: "imported_analytics",
    label: "Imported analytics",
    minAccessLevel: "platform_admin",
    minStage: "stage6_full_platform",
    publicMvpSafe: false,
  },
  {
    classification: "Not Ready",
    defaultEnabled: false,
    description: "Payment, affiliate, sponsorship, and revenue API integrations.",
    id: "payment_affiliate_integrations",
    label: "Payment and affiliate integrations",
    minAccessLevel: "platform_admin",
    minStage: "stage6_full_platform",
    publicMvpSafe: false,
  },
  {
    classification: "Not Needed Yet",
    defaultEnabled: false,
    description: "Marketplace, team accounts, cloud sync, and multi-tenant platform administration.",
    id: "marketplace_multi_tenant",
    label: "Marketplace and multi-tenant platform",
    minAccessLevel: "platform_admin",
    minStage: "stage6_full_platform",
    publicMvpSafe: false,
  },
] as const satisfies readonly FeatureGateDefinition[];

export type FeatureId = (typeof FEATURE_GATES)[number]["id"];

export type FeatureGateContext = {
  featureFlags: Partial<Record<FeatureId, boolean>>;
  releaseStage: ReleaseStageId;
  userAccessLevel: UserAccessLevel;
};

const DEFAULT_RELEASE_STAGE: ReleaseStageId = "stage0_internal";
const DEFAULT_USER_ACCESS_LEVEL: UserAccessLevel = "internal";

const RELEASE_STAGE_ORDER: Record<ReleaseStageId, number> = {
  stage0_internal: 0,
  stage1_private_creator: 1,
  stage2_invite_beta: 2,
  stage3_public_mvp: 3,
  stage4_partner_agency: 4,
  stage5_advanced_automation: 5,
  stage6_full_platform: 6,
};

const USER_ACCESS_LEVEL_ORDER: Record<UserAccessLevel, number> = {
  advanced_operator: 4,
  beta_user: 2,
  internal: 6,
  partner: 3,
  platform_admin: 5,
  private_creator: 1,
  public_user: 0,
};

const FEATURE_GATE_MAP: ReadonlyMap<string, FeatureGateDefinition> = new Map(
  FEATURE_GATES.map((feature) => [feature.id, feature]),
);

export function normalizeReleaseStage(value: string | null | undefined): ReleaseStageId {
  return RELEASE_STAGE_DEFINITIONS.some((stage) => stage.id === value)
    ? (value as ReleaseStageId)
    : DEFAULT_RELEASE_STAGE;
}

export function normalizeUserAccessLevel(value: string | null | undefined): UserAccessLevel {
  return USER_ACCESS_LEVELS.includes(value as UserAccessLevel)
    ? (value as UserAccessLevel)
    : DEFAULT_USER_ACCESS_LEVEL;
}

export function parseFeatureFlags(rawFlags: string | null | undefined): Partial<Record<FeatureId, boolean>> {
  if (!rawFlags) {
    return {};
  }

  return rawFlags
    .split(",")
    .map((flag) => flag.trim())
    .filter(Boolean)
    .reduce<Partial<Record<FeatureId, boolean>>>((flags, token) => {
      const isNegativePrefix = token.startsWith("!") || token.startsWith("-");
      const normalizedToken = isNegativePrefix ? token.slice(1) : token;
      const [rawFeatureId, rawValue] = normalizedToken.split("=", 2);
      const featureId = rawFeatureId.trim() as FeatureId;

      if (!FEATURE_GATE_MAP.has(featureId)) {
        return flags;
      }

      const normalizedValue = rawValue?.trim().toLowerCase();
      const enabled = isNegativePrefix
        ? false
        : normalizedValue
          ? !["0", "false", "off", "no"].includes(normalizedValue)
          : true;

      flags[featureId] = enabled;
      return flags;
    }, {});
}

export function getFeatureGateContext(
  overrides: Partial<FeatureGateContext> = {},
): FeatureGateContext {
  return {
    featureFlags:
      overrides.featureFlags ??
      parseFeatureFlags(process.env.CREATION_STATION_FEATURE_FLAGS),
    releaseStage:
      overrides.releaseStage ??
      normalizeReleaseStage(
        process.env.CREATION_STATION_RELEASE_STAGE ??
          process.env.NEXT_PUBLIC_CREATION_STATION_RELEASE_STAGE,
      ),
    userAccessLevel:
      overrides.userAccessLevel ??
      normalizeUserAccessLevel(
        process.env.CREATION_STATION_USER_ACCESS_LEVEL ??
          process.env.NEXT_PUBLIC_CREATION_STATION_USER_ACCESS_LEVEL,
      ),
  };
}

export function getFeatureGate(featureId: string): FeatureGateDefinition | null {
  return FEATURE_GATE_MAP.get(featureId) ?? null;
}

function isUnreleasedClassification(classification: FeatureReleaseClass): boolean {
  return classification === "Not Needed Yet" || classification === "Not Ready";
}

export function canAccessFeature(
  featureId: string,
  context: FeatureGateContext = getFeatureGateContext(),
): boolean {
  const feature = getFeatureGate(featureId);

  if (!feature) {
    return false;
  }

  const flagOverride = context.featureFlags[feature.id as FeatureId];

  if (flagOverride === false) {
    return false;
  }

  const isInternal = context.userAccessLevel === "internal";

  if (isUnreleasedClassification(feature.classification)) {
    return isInternal && flagOverride === true;
  }

  if (!feature.defaultEnabled && flagOverride !== true) {
    return false;
  }

  if (isInternal) {
    return true;
  }

  if (feature.internalOnly) {
    return false;
  }

  const stageAllowed =
    RELEASE_STAGE_ORDER[context.releaseStage] >= RELEASE_STAGE_ORDER[feature.minStage];
  const accessAllowed =
    USER_ACCESS_LEVEL_ORDER[context.userAccessLevel] >=
    USER_ACCESS_LEVEL_ORDER[feature.minAccessLevel];

  return stageAllowed && accessAllowed;
}

export function getVisibleFeatureGates(
  context: FeatureGateContext = getFeatureGateContext(),
): FeatureGateDefinition[] {
  return FEATURE_GATES.filter((feature) => canAccessFeature(feature.id, context));
}

export function getReleaseStageLabel(releaseStage: ReleaseStageId): string {
  return RELEASE_STAGE_DEFINITIONS.find((stage) => stage.id === releaseStage)?.label ?? releaseStage;
}
