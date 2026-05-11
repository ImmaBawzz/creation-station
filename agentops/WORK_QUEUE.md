# Work Queue

Last updated: 2026-05-11T14:20:00Z

## Ready

- Review and separate the current dirty worktree into focused commits before merging.
- Investigate direct `npx prisma db push` schema-engine failure as a standalone Prisma tooling issue.
- Add AI-assisted content brief/draft generation as Phase 2, using the deterministic test provider first.
- Add content filters and dashboard summaries once real content volume exists.
- Reconcile activity event naming in docs/code, especially `tasks_generated` versus planned `tasks_created`.
- Inspect the untracked `.codex/.codex/` path and decide whether to ignore or track it.

## Deferred

- Direct publishing APIs.
- Imported analytics.
- Payment, affiliate, or sponsorship integrations.
- Automated content execution.
- Review Inbox filters and broader v1.8 UI polish not directly tied to the content MVP.

## Done

- Added content pipeline roadmap docs.
- Added additive Prisma schema, migration, generated client, and local dev DB content tables.
- Added `/content` route and sidebar navigation.
- Added server actions for content item creation, brief saving, draft versioning, publishing prep, published state, metrics, and monetization.
- Added backup/export coverage for content pipeline records.
- Added focused action/backup tests and Playwright E2E coverage for the content MVP.
