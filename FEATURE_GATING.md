# Feature Gating

Last updated: 2026-05-11

## Purpose

Feature gating keeps Creation Station from releasing the full platform surface at once. The gate model separates release stage, user access level, and feature flags so internal work can continue while public users see only the safest subset.

The first implementation lives in `src/lib/feature-gating.ts` and is wired into sidebar navigation. It is intentionally small and testable. Route, API, and server-action enforcement must be added before real public deployment.

## Gate Model

Release stages:

- `stage0_internal`
- `stage1_private_creator`
- `stage2_invite_beta`
- `stage3_public_mvp`
- `stage4_partner_agency`
- `stage5_advanced_automation`
- `stage6_full_platform`

User access levels:

- `public_user`
- `private_creator`
- `beta_user`
- `partner`
- `advanced_operator`
- `platform_admin`
- `internal`

Feature classifications:

- Internal Only
- Private Beta
- Public MVP
- Partner Release
- Advanced Release
- Not Ready
- Not Needed Yet

Environment controls:

```env
CREATION_STATION_RELEASE_STAGE=stage0_internal
CREATION_STATION_USER_ACCESS_LEVEL=internal
CREATION_STATION_FEATURE_FLAGS=content_manual_monetization=false,music_video_builder
```

Rules:

- Internal users can inspect release-ready features for development and QA.
- `Not Ready` and `Not Needed Yet` features remain off unless explicitly flagged on for internal inspection.
- Public users should receive only Public MVP-safe features.
- Feature flags can disable a feature immediately.
- Feature flags do not replace stage/access policy for public release.

## Current App Feature Audit

| Major feature | Current app surface | Classification | Gate id | Release treatment |
| --- | --- | --- | --- | --- |
| Dashboard overview | `/dashboard` | Public MVP | `dashboard` | Safe for public MVP as read-only workflow status. |
| Idea inbox, capture, archive, filters | `/` | Public MVP | `idea_inbox` | Core public-safe workflow. |
| Factory Planner | `/factory`, `sendToFactory` | Public MVP | `factory_planner` | Allowed only with human review; no silent publishing. |
| Review, revision, approval | `/` review inbox | Public MVP | `review_task_board` | Core workflow; must stay human-controlled. |
| Task board, task statuses, blockers | `/`, `TaskBoard` | Public MVP | `review_task_board` | Core workflow; safe when local and reversible. |
| Backup export | `/api/export`, sidebar backup card | Public MVP | `backup_export` | Public-safe data portability. |
| Backup restore | `/settings`, `restoreWorkspaceBackup` | Private Beta | `backup_restore` | Withhold from public until stronger confirmation UX exists because it overwrites local state. |
| Settings, provider health, prompt presets | `/settings` | Private Beta | `settings_provider_health` | Useful for private/local users; not public-safe in hosted form because it exposes runtime configuration concepts. |
| Activity log and local analytics | home/settings analytics | Private Beta | `activity_analytics` | Keep beta until event naming and dashboard semantics are stable. |
| Intelligence recommendations, routing, prioritization | home recommendations, `src/lib/intelligence` | Private Beta | `intelligence_layer` | Useful but can steer users incorrectly if surfaced too broadly too early. |
| Manual content idea, brief, draft, publishing prep | `/content` | Public MVP | `content_pipeline_manual` | Public MVP-safe because it is manual and reviewable. |
| Creator Run production packet and manual production task bridge | `/content`, `/api/content/[id]/production-packet/markdown` | Private Beta | `creator_run_production_packet` | Internal/private creator only; creates local markdown drafts and manual task-board records without provider calls or publishing automation. |
| Manual content metrics | `/content` | Public MVP | `content_manual_metrics` | Safe if clearly labeled as user-entered, not imported or verified platform analytics. |
| Manual monetization tracking | `/content` | Private Beta | `content_manual_monetization` | Keep beta until copy and reporting semantics avoid financial overclaiming. |
| Release checklist and stage controls | `/release`, release docs | Internal Only | `release_controls` | Internal planning and readiness surface. |
| Media project manifest viewer | `/media` | Partner Release | `visual_engine_media` | Useful for vetted production users; not part of public MVP. |
| Music-video pipeline planner | `/execution`, `createMusicVideoPipeline` | Partner Release | `music_video_builder` | Hold for partners because it implies higher production complexity and asset handling. |
| End-to-end music-video builder | `/execution/MusicVideoBuilderPanel`, `/api/music-video-builder` | Partner Release | `music_video_builder` | Requires local media handling, FFmpeg, packaging, and stronger QA before broader release. |
| Visual engine render, lyrics, packaging | `/api/visual-engine/*`, `src/modules/visual-engine` | Partner Release | `visual_engine_media` | Partner-only until project/artifact lifecycle is hardened. |
| Comfy workflow validation, queue, image generation | `/api/comfy/*`, `src/modules/comfy` | Partner Release | `provider_runtime_governance` | Provider/runtime dependency should stay behind partner gates. |
| Provider runtime readiness, health, payload inspection, certification | `/api/provider-runtime/*`, `src/modules/provider-runtime` | Partner Release | `provider_runtime_governance` | Requires trusted users because cost, provider policy, and operational state are involved. |
| Scene planner, scene execution, timeline, motion, quality, regeneration, final assembly | `/api/scene-*`, `/api/timeline-*`, `/api/motion-*`, `/api/quality-check`, `/api/final-assembly`, `src/modules/*-director` | Advanced Release | `advanced_media_orchestration` | Hold until automation, cost, quality, and artifact failure modes are controlled. |
| Creative strategy reports | `/api/creative-strategy/*`, `src/modules/creative-strategy` | Advanced Release | `advanced_media_orchestration` | Can shape production direction; release after validation and explanatory UX. |
| Autonomy preview, approvals, locks, rollback snapshots | home autonomy panels, `src/lib/autonomy` | Internal Only | `autonomy_preview` | Internal lab surface only. |
| Worker daemon and execution request queue | `scripts/worker-daemon.mjs`, `/api/worker/tick`, autonomy execution stores | Advanced Release | `autonomy_worker_execution` | Not public until approval, audit, rollback, and stop controls are proven. |
| Direct publishing integrations | Not implemented | Not Ready | `external_publishing_integrations` | Withhold until consent, platform terms, rate limits, and human approval are designed. |
| Imported analytics integrations | Not implemented | Not Ready | `imported_analytics` | Withhold until privacy, scopes, data provenance, and platform API stability are handled. |
| Payment, affiliate, sponsorship API integrations | Not implemented | Not Ready | `payment_affiliate_integrations` | Requires financial/compliance review before implementation. |
| Marketplace, multi-tenant accounts, team/cloud sync | Not implemented | Not Needed Yet | `marketplace_multi_tenant` | Defer until core creator and partner workflows prove durable. |

## Implementation Notes

Implemented:

- Central release stage definitions.
- Central access level definitions.
- Feature registry with classifications.
- Feature flag parser.
- `canAccessFeature` and `getVisibleFeatureGates`.
- Sidebar navigation filtering through feature gates.
- Focused Vitest coverage in `src/lib/feature-gating.test.ts`.

Deferred before public release:

- Route-level guards for pages.
- API route and server-action enforcement.
- User/session-derived access levels.
- Admin UI for inspecting active gates.
- Tests that run the app under public, beta, partner, and advanced gate contexts.

## New Feature Rule

Every new major feature must be assigned:

- Release classification.
- Minimum release stage.
- Minimum access level.
- Public MVP safety status.
- Whether it requires a feature flag.
- A rollback or disable path.
