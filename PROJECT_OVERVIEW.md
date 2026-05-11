# Creation Station Project Overview

Last updated: 2026-05-11

## What This Project Is

Creation Station is a local-first creator workflow app. Its job is to help a creator move from a raw idea to a reviewed execution plan, concrete tasks, and manually prepared publish-ready content without handing control to external publishing, analytics, payment, or automation systems too early.

The app is built with Next.js App Router, React, TypeScript, Prisma, and SQLite. It stores the working state locally, uses server actions for workflow writes, and can use a local Ollama model or deterministic test provider to create AI Factory plans. The current release posture is controlled and staged: public-safe manual workflows are allowed early, while partner media tooling, provider runtime controls, and autonomous execution stay gated until they have stronger audit, cost, and recovery controls.

In practical terms, Creation Station is not currently a direct publishing platform. It is a workflow control room for deciding what to make, turning ideas into plans, reviewing those plans, turning approved plans into tasks, preparing content records, and tracking published outcomes manually.

## Current Product Shape

The product has two main workflow layers:

1. Core creative workflow: `Idea -> FactoryPlan -> Review/Revision -> Task`
2. Manual content pipeline: `ContentItem -> ContentBrief -> ContentDraft -> PublishingTarget -> ContentMetric -> MonetizationLink`

These layers are related but currently separate. The core workflow is best for taking broad ideas through AI-assisted planning and task execution. The content pipeline is best for taking one content item through brief, draft, publishing preparation, published tracking, performance snapshots, and monetization notes. A future version can connect them more tightly, but the current implementation keeps them additive so the stable idea/factory/task flow is not disrupted.

## How The App Works

The app is organized around local database records and explicit user actions:

- `src/app` contains pages, server actions, API routes, and UI composition.
- `src/app/actions.ts` owns the core idea, factory, review, task, and autonomy-related server actions.
- `src/app/content/actions.ts` owns the manual content pipeline server actions.
- `src/lib/aiProvider.ts` sends Factory Planner requests to Ollama or the deterministic test provider.
- `src/lib/backup.ts` exports and restores local workspace data.
- `src/lib/feature-gating.ts` classifies features by release stage and access level.
- `prisma/schema.prisma` defines the local SQLite data model.
- `tests` contains Vitest and Playwright coverage for core flows, content flows, backup, smoke checks, and release gating.

The database is the source of truth. Pages render database state, forms submit to server actions, server actions validate and write records, and activity/analytics events record important workflow changes.

## Core Workflow: Idea To Executable Tasks

This is the original stable workflow and remains the foundation of the product.

1. Capture an idea in the Inbox.
   - The user enters a title, raw idea text, optional category, and tags.
   - The app creates an `Idea` record with status `RAW`.
   - Activity and analytics events record the capture.

2. Send the idea to the Factory Planner.
   - The user chooses an idea and clicks the Factory action from the Inbox or `/factory`.
   - The app marks the idea `IN_FACTORY` while planning is running.
   - The Factory Planner calls the configured AI provider.
   - In normal local use, this is Ollama using `AI_PROVIDER=ollama`.
   - In deterministic tests, this is `AI_PROVIDER=test`.

3. Generate a structured Factory Plan.
   - The AI result must provide a title, summary, main concept, required assets, risks, and next actions.
   - The app saves this as a `FactoryPlan` with status `REVIEW_PENDING`.
   - The idea is updated to `PLAN_READY` with the generated summary.
   - Duplicate pending plans are blocked so the user reviews the waiting plan before creating another one.

4. Review the plan.
   - Review happens on the home page Review Inbox.
   - The user reads the plan sections and decides whether it is useful enough to execute.
   - The user can request revision with notes instead of approving.

5. Request revision when needed.
   - Revision notes are saved on the plan.
   - The plan status becomes `REVISION_REQUESTED`.
   - The idea status becomes `NEEDS_REVISION`.
   - Running the Factory again can include prior plan context and revision notes.

6. Approve the plan.
   - Approval changes the plan to `APPROVED`.
   - The app parses the plan's `nextActions` into task titles.
   - Up to 10 tasks are created as `Task` records.
   - The idea status becomes `TASKED`.

7. Work the Task Board.
   - Tasks move through controlled statuses: `TODO`, `DOING`, `BLOCKED`, `BACKLOG`, `DONE`, and `ARCHIVED`.
   - The UI supports status changes and task blockers.
   - Task completion, archival, and status changes are logged.

8. Use Dashboard, Activity, and Backup for control.
   - `/dashboard` summarizes counts and recent work.
   - Recent activity gives a lightweight audit trail.
   - `/api/export` downloads ideas, plans, tasks, blockers, content records, and backup metadata as JSON.

## Content Workflow: Idea To Publish-Ready Content

The content pipeline is the newer MVP layer for creator publishing prep. It stays manual by design.

1. Capture a content item.
   - The user opens `/content` and adds a content title, core idea, audience, format, primary platform, and tags.
   - The app creates a `ContentItem` with status `IDEA`.
   - Supported formats include short video, long video, article, newsletter, social post, thread, podcast, email, and other.
   - Supported platforms include YouTube, TikTok, Instagram, X, blog, newsletter, LinkedIn, Facebook, and other.

2. Build the brief.
   - The user fills in objective, angle, promise, outline, call to action, keywords, and notes.
   - The app upserts one `ContentBrief` for the item.
   - If the item was still in `IDEA`, its status moves to `BRIEFED`.

3. Draft and edit the content.
   - The user saves draft versions with title, body, and draft status.
   - Each save creates a new `ContentDraft` version instead of overwriting the prior one.
   - The content item moves to `DRAFTING` for the first draft and `EDITING` for later draft versions, unless it is already ready, scheduled, published, or archived.

4. Prepare the publishing target.
   - The user adds platform-specific caption or description, hashtags, checklist, and optional scheduled date.
   - The app creates or updates a `PublishingTarget` for that platform.
   - If scheduled date exists, the target status becomes `SCHEDULED` and the item status becomes `SCHEDULED`.
   - Otherwise the target status becomes `READY` and the item status becomes `READY_TO_PUBLISH`.

5. Publish manually outside the app.
   - The MVP does not post to YouTube, TikTok, Instagram, blogs, newsletters, or any other platform.
   - The creator reviews the draft, applies platform-specific judgment, and publishes manually.
   - After publishing, the user records the published URL and date in Creation Station.
   - The `PublishingTarget` and `ContentItem` move to `PUBLISHED`.

6. Record performance manually.
   - The user records snapshots for views, likes, comments, shares, saves, clicks, notes, platform, and capture date.
   - These are stored as `ContentMetric` records.
   - Metrics are user-entered snapshots, not imported or verified platform analytics.

7. Track monetization notes manually.
   - The user can add a method, offer name, offer URL, expected value, actual revenue, currency, and notes.
   - These become `MonetizationLink` records.
   - Monetization is treated as private/beta-facing until copy and reporting semantics are safer.
   - This is not payment processing, affiliate API integration, tax reporting, or financial advice.

## What Counts As Publish-Ready

Within the current MVP, publish-ready means the app has enough reviewed material for the creator to confidently publish manually. A publish-ready content item should have:

- A clear content title and core idea.
- A defined audience, format, and platform.
- A brief with objective, angle, promise, outline, CTA, and useful notes.
- At least one reviewed draft version.
- Platform-specific caption or description.
- Hashtags, keywords, or distribution notes where relevant.
- A publishing checklist that the creator has reviewed.
- Optional scheduled date.
- Any required assets or execution tasks handled outside or through the task board.

Publish-ready does not mean automatically published, guaranteed compliant with platform rules, guaranteed to perform, or guaranteed to earn money.

## Release Stages And Feature Exposure

Creation Station is moving toward staged release instead of exposing the whole codebase at once.

- Stage 0, internal: full local validation and internal tools.
- Stage 1, private creator: one trusted creator workflow with manual controls.
- Stage 2, invite beta: small cohort with controlled feedback loops.
- Stage 3, public MVP: public-safe manual workflow only.
- Stage 4, partner/agency: vetted production and media workflows.
- Stage 5, advanced automation: audited automation with approvals and rollback.
- Stage 6, full platform: scaled platform after integrations, trust, safety, and support mature.

The current gate system filters sidebar navigation by release stage, access level, and feature flags. Route-level, API-level, and server-action gate enforcement are still required before a real public deployment.

## Advanced Surfaces In The Repo

The repository also contains modules for media, music-video building, visual engine work, provider runtime governance, Comfy workflows, autonomy previews, worker execution, and advanced orchestration. These are important future platform directions, but they are not part of the public MVP workflow.

Their current posture is gated or deferred because they can involve higher cost, more complex runtime dependencies, provider credentials, local media handling, or automation risks.

## Data And Backup Model

The app is local-first:

- SQLite stores ideas, plans, tasks, activity events, autonomy records, content records, metrics, and monetization notes.
- Prisma models define the persisted records.
- Backup export writes the current workspace to JSON.
- Backup restore validates records before replacing local workspace data.
- Restore is private/beta-facing until the confirmation UX is stronger because it can overwrite local state.

This local-first model keeps early development fast and avoids requiring cloud accounts, external credentials, platform API access, or multi-user permissions before the core creator workflow is proven.

## Current Known Gaps

- The worktree currently contains multiple uncommitted changes from recent content pipeline and staged release work.
- Direct `npx prisma db push` is blocked by a Prisma schema-engine issue; current validation relies on schema validation, migrations, client generation, and guarded test database setup.
- Sidebar navigation has feature gates, but pages, API routes, and server actions still need matching enforcement before public deployment.
- `/content` needs subfeature visibility so public users can use manual content prep without seeing beta monetization controls.
- Direct publishing, imported analytics, payment APIs, affiliate APIs, cloud sync, teams, marketplace, and external automation are intentionally deferred.

## Practical Workflow For Future Roadmaps

Use this process when creating the next roadmap or execution plan:

1. Start with the active docs.
   - Read `agentops/PROJECT_STATE.md`, `agentops/ROADMAP.md`, `agentops/WORK_QUEUE.md`, `ROADMAP.md`, `TASKS.md`, `FEATURE_GATING.md`, and `PUBLIC_MVP_SCOPE.md`.
   - Treat newer AgentOps state as the current execution line when it conflicts with older historical plans.

2. Pick one release stage.
   - Decide whether the work is for internal, private creator, invite beta, public MVP, partner, advanced automation, or full platform.
   - Do not mix public MVP hardening with partner or advanced automation work in the same slice.

3. Pick one workflow step.
   - Examples: idea capture, Factory planning, review/revision, task creation, content brief, draft versioning, publishing prep, metrics, backup, feature gating.
   - Keep the change adjacent to the current milestone.

4. Define acceptance criteria.
   - State exactly what a user can do after the change.
   - Include the data records touched and expected status transitions.
   - Include what should remain unavailable or hidden.

5. Define validation.
   - Prefer focused unit/action tests first.
   - Add Playwright coverage when a user-facing flow changes.
   - Run lint, typecheck, schema validation, and smoke checks when scope justifies it.

6. Preserve the manual control model.
   - Generated plans are drafts for review.
   - Publishing is manual.
   - Metrics are user-entered unless a future approved integration says otherwise.
   - Monetization notes are not financial reporting.

7. End with the next smallest safe step.
   - Keep roadmap entries small enough to complete, verify, and revert if needed.
   - Record blockers instead of expanding scope around them.

## Suggested Near-Term Roadmap Shape

The next roadmap should likely stay focused on public readiness and workflow clarity:

1. Separate and review the current dirty worktree into focused commits.
2. Add route-level gates for public/private/partner/internal pages.
3. Add API route and server-action gates for hidden workflows.
4. Add gate-context smoke tests for private creator, invite beta, public MVP, and partner contexts.
5. Hide or disable `/content` monetization controls for public MVP users.
6. Review public copy so it consistently says plans are drafts, publishing is manual, and metrics are user-entered.
7. Add content filters and dashboard summaries once real content volume makes them necessary.
8. Add AI-assisted content brief/draft generation only after the manual content lifecycle is stable, using the deterministic provider path first.
