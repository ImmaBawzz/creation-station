# Project State

Last updated: 2026-05-11T14:20:00Z

## Stack

- Next.js 16 App Router, React 19, TypeScript.
- Prisma 7 with local SQLite and generated client under `src/generated/prisma`.
- Vitest unit tests and Playwright smoke/e2e checks.
- Local-first workflow app with manual JSON backup/restore.

## Product Status

- Stable checkpoint before this work: `v1.7.0-alpha`.
- Active implementation slice: content pipeline MVP foundation.
- Current branch for this run: `agentops/autonomous-cycle-20260511-011922`.

## Current Implementation State

- Existing Idea -> FactoryPlan -> Review/Revision -> Task workflow remains intact.
- Added additive content pipeline models: `ContentItem`, `ContentBrief`, `ContentDraft`, `PublishingTarget`, `ContentMetric`, and `MonetizationLink`.
- Added `/content` cockpit for content idea capture, brief, draft/edit, publishing prep, published tracking, metrics, and monetization.
- Backup/export now includes content pipeline records.
- Playwright DB bootstrap now creates content pipeline tables for isolated tests.
- Local `dev.db` was updated with the additive content migration so `/content` works on localhost.

## Current Blocker Status

- Direct `npx prisma db push` still fails with a Prisma schema-engine error and remains a standalone tooling issue.
- The content MVP does not depend on external publishing, analytics, affiliate, or payment integrations.

## Active Risks

- The worktree still contains prior unrelated changes from the activity/smoke-bootstrap run.
- Existing lint warnings remain outside this run's changed files.
- Turbopack still emits existing NFT tracing warnings for the music-video builder route.
- `.codex/.codex/` remains untracked and was not modified.
