# Decisions

Last updated: 2026-05-11T14:20:00Z

## 2026-05-11 - Add A Dedicated Content Pipeline Layer

Decision: add explicit content pipeline models and a `/content` cockpit instead of repurposing the existing Idea/FactoryPlan/Task workflow.

Rationale:
- The existing creative workflow is stable and should remain intact.
- Content publishing, metrics, and monetization require lifecycle concepts that do not belong cleanly inside FactoryPlan or Task.
- A dedicated layer is clearer for future AI-assisted drafting, platform repurposing, and revenue reporting.

## 2026-05-11 - Keep Publishing And Monetization Manual In MVP

Decision: store publishing prep, published URLs/dates, performance metrics, and monetization values as manual local records only.

Rationale:
- This satisfies the MVP without credentials, external API risk, or scope expansion.
- Manual records are enough to validate whether the workflow fits the creator pipeline.
- Integrations can be added later from a stable data model.

## 2026-05-11 - Apply Content Migration Directly To dev.db

Decision: apply the additive content migration to local `dev.db` with `better-sqlite3`.

Rationale:
- Direct `prisma db push` is a known schema-engine blocker in this repo.
- The migration only creates new content tables and indexes.
- Localhost verification needs the current dev database to contain those tables.

## Prior Decisions Preserved

- Playwright smoke setup uses a guarded test-only SQLite bootstrap instead of `prisma db push`.
- Task status changes log `task_status_changed` activity events after real allowed transitions.
