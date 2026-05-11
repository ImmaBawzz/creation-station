# Public MVP Scope

Last updated: 2026-05-11

## Release Stage

Public MVP maps to Stage 3: Limited public MVP.

Public deployment should use:

```env
CREATION_STATION_RELEASE_STAGE=stage3_public_mvp
CREATION_STATION_USER_ACCESS_LEVEL=public_user
```

## Goal

Release a limited, trustworthy creator workflow that helps users move from idea to reviewed plan, task execution, and manual content preparation without exposing high-impact automation or ecosystem-facing integrations.

## Target Users

- Individual creators.
- Small creator/operators evaluating a structured local-first workflow.
- Users comfortable with manual review and manual publishing.

## Included

- Dashboard overview.
- Idea capture, search, filtering, and archive.
- Factory Planner with human review.
- Review Inbox, revision notes, and approve-to-task flow.
- Task board with status changes, blockers, backlog, done, and archive.
- Manual content idea, brief, draft, and publishing preparation.
- Manual published status and URL/date tracking.
- Manual performance snapshots clearly labeled as user-entered.
- Backup export.
- Public documentation that explains the product as a workflow assistant, not an autonomous publishing system.

## Excluded

- Direct publishing APIs.
- Imported social/video/newsletter analytics.
- Payment, affiliate, sponsorship, or revenue APIs.
- Agency queues and partner provider tooling.
- Music-video builder and visual engine production tooling.
- Comfy/provider runtime governance dashboards.
- Scene/timeline/motion/quality/final-assembly automation.
- Autonomy preview and worker execution.
- Marketplace, teams, cloud sync, and multi-tenant administration.
- Claims of guaranteed performance, revenue, virality, or platform compliance.

## Public UX Rules

- Generated plans are drafts for review, not publish-ready truth.
- Publishing remains manual.
- Metrics are user-entered unless a future integration explicitly states otherwise.
- Monetization copy must avoid financial advice or income promises.
- Advanced automation should not appear in public navigation.
- Empty states should guide users to the next manual step, not suggest unavailable automation.

## Technical Controls Required Before Public Launch

- Sidebar navigation gated to Public MVP features.
- Route-level gates for hidden pages.
- API route gates for partner, advanced, internal, and not-ready endpoints.
- Server-action gates for hidden workflows.
- Smoke tests under `stage3_public_mvp` and `public_user`.
- Backup export verified.
- Restore either hidden or protected with stronger confirmation.
- Public copy reviewed against ecosystem and trust constraints.

## Success Criteria

- A new public user can complete the core idea -> plan -> review -> task flow.
- A new public user can manually create and prepare one content item.
- Public users cannot access internal, private beta, partner, advanced, not-ready, or not-needed features through navigation.
- Product language consistently describes manual review and user control.
- No public workflow requires external credentials.

## Exit Criteria Before Partner Release

- Public MVP stability issues are triaged.
- Support burden is understood.
- Partner-only surfaces are gated at route/API/action level.
- Provider cost/rate controls are defined.
- Partner onboarding and responsibility boundaries are documented.
