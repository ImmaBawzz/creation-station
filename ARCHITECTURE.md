# Creation Station Architecture

## Current System

Creation Station is a local-first Next.js App Router application backed by Prisma and SQLite. The existing core workflow is:

`Idea -> FactoryPlan -> Review/Revision -> Task`

Supporting layers include:

- `src/app`: App Router pages, server actions, and API routes.
- `src/lib`: shared workflow, AI provider, backup, analytics, activity, and intelligence logic.
- `src/modules`: specialized media, provider, autonomy, quality, and execution modules.
- `prisma/schema.prisma`: local SQLite persistence model.
- `tests`: Vitest unit tests and Playwright smoke/e2e tests.

## Content Pipeline Extension

The content pipeline is additive. It does not replace the current creative workflow or task board.

New core flow:

`ContentItem -> ContentBrief -> ContentDraft -> PublishingTarget -> ContentMetric -> MonetizationLink`

Design rules:

- Keep content work local-first and manually controlled.
- Store publishing and revenue data as user-entered records.
- Do not add external publishing, analytics, affiliate, or payment APIs in the MVP.
- Use activity events for important workflow changes.
- Keep backup/export coverage aligned with persisted content data.

## Data Ownership

- `ContentItem` owns the main lifecycle status, audience, format, platform, and tags.
- `ContentBrief` stores one structured planning brief per content item.
- `ContentDraft` stores versioned drafts so editing does not overwrite prior work.
- `PublishingTarget` stores platform prep, checklist text, scheduled/published dates, and URL.
- `ContentMetric` stores manual performance snapshots.
- `MonetizationLink` stores manual revenue attribution and offer/method notes.

## Runtime Boundaries

- Server actions own writes.
- Server components render database state.
- API routes remain for existing export/analytics/media workflows.
- No secrets are required for the content MVP.
- Local SQLite remains the source of truth.

## Validation Strategy

- Unit/action tests cover validation and write behavior.
- Playwright smoke covers route availability and backup shape.
- Full validation uses `npm run test`, `npm run lint`, `npx tsc --noEmit`, `npx prisma validate`, `npx prisma generate`, and `npm run test:smoke`.
