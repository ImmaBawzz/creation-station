# Creation Station Release-Stage Execution Plan

Last updated: 2026-05-11

## Active Milestone: Staged Release Strategy and Gate Foundation

The project is shifting from pure product buildout to controlled staged release. Future work must be planned by both product phase and release stage.

Current release posture:

- Stage 0 internal validation remains the safest default.
- Stage 1 private creator workflow is the next operating target.
- Stage 3 public MVP must expose only public-safe manual workflows.
- Partner, advanced, not-ready, and not-needed features must stay gated.

## Current Task Queue

| Priority | Task | Product phase | Release stage | Files or areas affected | Completion criteria |
| --- | --- | --- | --- | --- | --- |
| P0 | Wait for v1.7.0-alpha.2 release PR CI rerun | Release preparation | Stage 1 | GitHub PR #1, GitHub Actions, `package-lock.json` | CI reruns after the npm 10 lockfile synchronization fix and finishes before merge, tag, or release decisions. |
| P0 | Preserve rewritten local cleanup state | Engineering hygiene | All stages | Git status/diff | Current local cleanup commits remain intact and no database artifacts are reintroduced. |
| P0 | Maintain staged release docs | Release planning | Stages 0-6 | `RELEASE_STRATEGY.md`, `PUBLIC_MVP_SCOPE.md`, `PRIVATE_BETA_PLAN.md`, `ECOSYSTEM_IMPACT.md` | Docs define goals, included/withheld features, risks, controls, and exit criteria. |
| P0 | Maintain feature audit | Release planning | Stages 0-6 | `FEATURE_GATING.md`, `src/lib/feature-gating.ts` | Every major feature has a release classification and gate id where applicable. |
| P1 | Enforce navigation gates | Gate foundation | Stages 0-6 | `src/app/components/AppSidebar.tsx` | Sidebar shows only features allowed by active stage/access context. |
| P1 | Add public MVP route/action/API gates | Public readiness | Stage 3 | App pages, API routes, server actions | Public users cannot directly reach private, partner, advanced, internal, or not-ready workflows. |
| P1 | Add gate-context smoke matrix | Public readiness | Stages 1-4 | Playwright config/tests | Smoke tests run under private creator, beta, public MVP, and partner gate contexts. |
| P1 | Split `/content` subfeature visibility | Public readiness | Stages 2-3 | `src/app/content/page.tsx`, content actions | Monetization and beta-only controls hide for public users while manual public MVP content workflow remains available. |
| P1 | Validate Creator Run v0.1 on first real content run | Private creator workflow | Stage 1 | `/content`, task board, production packet markdown export | One content item produces a packet, manual production tasks, publishing prep, and metrics reminder without external providers. |
| P1 | Review public MVP copy | Trust and ecosystem | Stage 3 | UI copy, release docs | Copy describes drafts, review, manual publishing, and user-entered metrics accurately. |
| P2 | Harden backup restore confirmation | Data safety | Stages 1-3 | Settings restore UI/actions | Restore remains private/beta or requires stronger confirmation before public release. |
| P2 | Partner provider controls | Partner readiness | Stage 4 | Provider runtime, visual engine, music-video builder | Provider cost, readiness, certification, and payload checks are documented and gated. |
| P2 | Automation approval hardening | Advanced readiness | Stage 5 | Autonomy, worker, execution queue | Advanced automation requires approvals, locks, logs, stop conditions, and rollback evidence. |

## Product Phase To Release Stage Map

| Product phase | Main outcome | Earliest release stage | Notes |
| --- | --- | --- | --- |
| Core workflow | Idea -> Factory Planner -> Review -> Tasks | Stage 0 internal, Stage 3 public MVP | Public-safe when human-reviewed. |
| Private creator content workflow | Manual content brief, draft, prep, metrics, monetization notes | Stage 1 private creator | Monetization notes remain private/beta until copy and reporting semantics mature. |
| Creator Run v0.1 | Production packet and manual music/image/video task bridge | Stage 1 private creator | Internal/private only; no external media generation, direct publishing, or imported analytics. |
| Invite beta feedback loop | Cohort feedback and beta-only workflow refinement | Stage 2 invite beta | No open signup or direct publishing. |
| Limited public MVP | Public-safe manual creator workflow | Stage 3 public MVP | Requires route/API/action gates before real deployment. |
| Partner production tooling | Music video, visual engine, provider governance | Stage 4 partner/agency | Requires vetted users, cost limits, and workflow certification. |
| Advanced automation | Worker execution and media orchestration | Stage 5 advanced automation | Requires approval gates and audit trail. |
| Full platform | Integrations, payments, teams, marketplace, scale | Stage 6 full platform | Requires compliance, support, abuse prevention, and data isolation. |

## Done

- Updated README positioning and added CI/release docs for the `v1.7.0-alpha.2` Creator Run pre-release candidate.
- Ran release-prep validation successfully: Prisma generate/validate, typecheck, lint, tests, build, and unsafe tracked-file scan.
- Synchronized `package-lock.json` with npm 10.8.2 after the first PR CI runs failed at `npm ci`.
- Opened release-prep PR #1 without creating a tag or GitHub release.
- Force-pushed the approved rewritten remote branches and tags, verified a fresh remote clone has no database artifacts, and verified the downloaded `v1.6.0` source archive contains no database artifacts.
- Rewrote local reachable Git history with `git-filter-repo` to remove `dev.db` and verified local history, local tracked files, and local `v1.6.0` tag tree no longer contain database artifacts.
- Added content pipeline roadmap, schema, actions, UI, backup coverage, and tests in the prior content MVP slice.
- Added staged release documents.
- Added basic feature-gating registry, stage definitions, access levels, feature flags, and tests.
- Wired sidebar navigation through feature gates.
- Added Creator Run v0.1 production packet draft creation, production task creation, and markdown export as an internal/private creator workflow.

## Deferred

- Direct publishing APIs.
- Imported analytics.
- Payment, affiliate, or sponsorship integrations.
- External media provider integrations and autonomous music/image/video generation.
- Cloud sync, team accounts, marketplace, or multi-tenant administration.
- Public route/API/action gate enforcement.
- Public MVP gate-context smoke matrix.
- Full platform trust/safety/compliance processes.

## Current Blockers

- Direct `npx prisma db push` still fails with a Prisma schema-engine error. Use migrations, `npx prisma validate`, `npx prisma generate`, and guarded Playwright DB setup for validation.
- `npm audit` reports 7 dependency findings, 5 moderate and 2 high; dependency remediation is deferred unless it blocks release approval.
- External integrations require credentials, provider/platform policy review, and explicit approval.
- Public deployment must not proceed until route/API/action gates match `FEATURE_GATING.md`.
