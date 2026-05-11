# Creation Station Staged Release Roadmap

Last updated: 2026-05-11

## Current Status

Creation Station has a local-first creative workflow with idea capture, AI Factory planning, review/revision, task creation, task controls, activity logging, backup/restore, local analytics, and a newer manual content pipeline. It also contains more powerful media, provider runtime, and autonomy modules that should not be publicly exposed all at once.

The roadmap now tracks two dimensions:

- Product phase: what capability is being built.
- Release stage: who is allowed to use it and under what controls.

## Release Stages

| Stage | Name | Product posture |
| --- | --- | --- |
| 0 | Internal use only | Validate core workflow, classify features, keep all high-impact work internal. |
| 1 | Private creator workflow tool | One trusted creator uses the manual workflow for real work. |
| 2 | Invite-only beta | Small cohort tests private/beta surfaces with structured feedback. |
| 3 | Limited public MVP | Public-safe manual workflow only. |
| 4 | Partner/agency release | Vetted users access production/media/provider tooling. |
| 5 | Advanced automation release | Audited automation with approvals, logs, locks, and rollback. |
| 6 | Full platform release | Scaled platform after integrations, trust, safety, compliance, and support mature. |

## Status Labels

### Done

- Next.js 16, React 19, TypeScript, Prisma 7, SQLite, Vitest, and Playwright are in place.
- Idea inbox, Factory Planner, Review Inbox, revision loop, approval, and task board are implemented.
- Local AI planning works through Ollama or the deterministic test provider.
- Activity events and local analytics exist.
- Manual JSON backup/restore exists.
- Manual content pipeline exists for content item, brief, draft, publishing prep, metrics, and monetization notes.
- Creator Run v0.1 exists as an internal/private bridge that creates a deterministic production packet draft and manual production task set from a content item.
- Basic feature-gating registry exists with release stages, access levels, feature flags, and sidebar navigation filtering.
- Local reachable Git history has been rewritten to remove `dev.db`; local verification shows no database artifacts in history, tracked files, or the local `v1.6.0` tag tree.

### In Progress

- Staged release strategy and gate foundation.
- Internal/private Creator Run v0.1 validation on a real first content run.
- v1.8 operator UX pass and activity-event coverage.
- Remote repository safety cleanup for `dev.db` history before `v1.7.0-alpha.2` release prep resumes.

### Missing Before Public MVP

- Route-level gates.
- API route gates.
- Server-action gates.
- Public MVP gate-context smoke matrix.
- Public copy review for manual workflow, user-entered metrics, and no direct publishing.
- Stronger restore confirmation or public hiding.

### Blocked

- `v1.7.0-alpha.2` release preparation is blocked until owner-approved remote force-push/tag rewrite removes the old `dev.db` history from GitHub and existing release archive risk is rechecked.
- Direct `npx prisma db push` still fails with a Prisma schema-engine error.
- External publishing, imported analytics, affiliate APIs, payment integrations, and cloud/team features require future credentials, policy review, and explicit approval.

### Not Needed Yet

- Marketplace, public automation, team accounts, cloud sync, direct publishing, payment integrations, automated revenue import, and multi-user permissions.

## Release-Aware Roadmap

| Order | Product phase | Release stage | Objective | Features to build or harden | Technical controls | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Release planning | Stage 0 | Define staged release contract | Release strategy, public MVP scope, private beta plan, ecosystem impact, feature audit | Docs and central gate registry | Every major feature is classified and staged. |
| 2 | Gate foundation | Stage 0 | Make staged release enforceable in code | Feature registry, flags, access levels, navigation gates | `src/lib/feature-gating.ts`, tests | Gate tests pass and sidebar filters by stage/access. |
| 3 | Private creator workflow | Stage 1 | Stabilize one real creator workflow | Core workflow, content pipeline, backup, settings, manual monetization notes | Private creator access, backup discipline | One creator can complete real workflows without data loss. |
| 3a | Creator Run v0.1 | Stage 1 | Bridge content items to production-ready packets and task-board execution | Production packet draft, manual music/image/video plan, production tasks, markdown export | Private creator gate, no provider credentials, no publishing automation | One content item can become a packet and manual task sequence. |
| 4 | Invite beta | Stage 2 | Validate workflow with small cohort | Beta onboarding, feedback loops, beta-only monetization/analytics notes | Beta access, feature flags, issue triage | Beta users can onboard and complete workflows with known limitations. |
| 5 | Public MVP hardening | Stage 3 | Prepare limited public release | Public-safe workflow, route/action/API gates, public copy, smoke matrix | Public access, public stage env, hidden private/partner/advanced features | Public users see only Public MVP-safe features and checks pass. |
| 6 | Partner readiness | Stage 4 | Prepare vetted production workflows | Music-video builder, visual engine, provider governance, workflow certification | Partner access, cost/rate controls, provider readiness gates | Partner workflows are auditable, bounded, and not public. |
| 7 | Advanced automation readiness | Stage 5 | Release controlled automation | Worker execution, advanced media orchestration, approval/rollback controls | Advanced access, approvals, logs, locks, stop conditions | Automated actions are auditable and recoverable. |
| 8 | Full platform planning | Stage 6 | Scale only after trust controls mature | Integrations, payments, teams, marketplace, cloud sync | Compliance, consent, data isolation, quotas, abuse prevention | Full-platform launch has governance, support, and safety plans. |

## Strict Next Execution Plan

| Order | Priority | Task | Stage | Reason |
| --- | --- | --- | --- | --- |
| 1 | P0 | Keep release docs and feature audit current | Stages 0-6 | Prevents accidental scope expansion. |
| 2 | P1 | Add route-level page gates | Stage 3 | Navigation gating alone is insufficient for public release. |
| 3 | P1 | Add server-action and API gates | Stage 3 | Hidden workflows must not be callable directly. |
| 4 | P1 | Add gate-context smoke tests | Stages 1-4 | Ensures staged release behavior does not regress. |
| 5 | P1 | Gate `/content` monetization controls separately | Stages 2-3 | Public MVP can include manual content workflow without beta monetization exposure. |
| 6 | P1 | Validate Creator Run v0.1 with one real internal content run | Stage 1 | Confirms the packet/task bridge works before public exposure. |
| 7 | P2 | Add public MVP copy pass | Stage 3 | Reduces trust and ecosystem confusion. |
| 8 | P2 | Harden partner provider controls | Stage 4 | Cost/runtime/provider risks need controls before partner release. |
| 9 | P2 | Harden automation approvals and rollback | Stage 5 | Automation should not ship without audit and recovery. |

## Assumptions

- The app remains local-first until a future release explicitly approves cloud or team architecture.
- Publishing means manual status/URL/date tracking until external publishing is approved.
- Metrics remain user-entered until imported analytics are approved.
- Monetization values are notes until financial integrations and reporting language are reviewed.
- Internal users may inspect future release-ready work, but public users must not see private, partner, advanced, not-ready, or not-needed features.
