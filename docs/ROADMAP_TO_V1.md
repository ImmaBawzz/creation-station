# Creation Station Roadmap to v1.0

## 1. Current State Summary

Creation Station is currently a local-first Next.js, Prisma, and SQLite app focused on one core solo-creator workflow:

```text
Idea Inbox -> AI Factory Planner -> Review Inbox -> Revision -> Approval -> Tasks
```

The existing v0.5.1 stabilization work has already established:

- Idea capture with title, raw text, category, tags, priority, potential, and status.
- Local Ollama-based AI Factory planning through the isolated AI provider.
- Prompt construction isolated in the Factory prompt module.
- Review Inbox flow for approving or requesting revision.
- Revision notes stored on plans and reused during re-planning.
- Task generation from approved plan `nextActions`.
- Human-readable status labels, clearer empty states, and improved AI planner errors.

Current known gaps before moving forward:

- Full manual QA has not yet been completed three times in a row.
- Export backup is still listed as a next stabilization task.
- Archive exists at the action/model level, but broader search, filter, and archive visibility needs product polish.
- Asset visibility should stay lightweight and based on existing plan data before any full asset vault is considered.
- No new database model should be introduced unless a milestone explicitly proves the current schema cannot support the needed behavior.

## 2. v0.5.2 Export Backup Plan

Goal: add a simple, trustworthy way to back up current local project data before deeper product expansion.

Allowed scope:

- Add a manual export path for current ideas, plans, and tasks.
- Prefer a plain JSON export generated from existing Prisma data.
- Keep the export local and user-triggered.
- Include enough metadata to understand when the export was created and what app version or milestone produced it.
- Add clear UI copy explaining that this is a backup/export, not sync.

Implementation guardrails:

- Do not add cloud sync.
- Do not add scheduled backups.
- Do not add import/restore unless explicitly approved as a separate milestone.
- Do not change Prisma schema unless the export cannot be completed without it.
- Do not add dependencies unless native platform APIs are insufficient.

Acceptance criteria:

- User can create a local export containing ideas, factory plans, and tasks.
- Export does not mutate app data.
- Export excludes generated Prisma client internals and unrelated files.
- Empty database export produces a valid, understandable file.
- Export errors are readable and actionable.

## 3. v0.6 Asset Visibility Plan

Goal: make existing plan-required assets easier to see without creating a full asset vault.

Allowed scope:

- Surface `FactoryPlan.requiredAssets` more clearly in review and approved-plan contexts.
- Add lightweight grouping or display treatment for required assets derived from existing plan text.
- Show asset needs alongside related ideas, plans, or tasks where it improves execution clarity.
- Consider task descriptions or plan panels as the first place to expose asset needs.

Implementation guardrails:

- Do not build a full asset vault.
- Do not add upload, file management, thumbnails, tagging systems, storage providers, or asset database models.
- Do not integrate ComfyUI or external asset generation tools.
- Treat required assets as planning visibility, not inventory management.

Acceptance criteria:

- User can quickly see what assets a plan requires.
- Asset information remains tied to the plan that generated it.
- The core workflow still works unchanged.
- No new subsystem is introduced.

## 4. v0.7 Search, Filter, and Archive Plan

Goal: help the user manage growing local data while preserving the existing pipeline.

Allowed scope:

- Add simple search over idea title, raw text, category, tags, and summaries.
- Add focused filters for statuses that already exist.
- Improve visibility and behavior for archived ideas.
- Keep archive reversible only if it can be done without schema changes and without expanding the workflow.

Implementation guardrails:

- Do not add saved searches.
- Do not add global command palettes.
- Do not add advanced query languages.
- Do not add multi-user permissions or ownership concepts.
- Do not add major new models.

Acceptance criteria:

- User can find ideas by common text.
- User can filter by practical workflow states such as raw, plan ready, needs revision, tasked, and archived.
- Archived items no longer clutter the main working view.
- Archive behavior is documented and does not break plan/task relationships.

## 5. v0.8 Dashboard Plan

Goal: add a compact operational overview of the existing workflow.

Allowed scope:

- Add a dashboard or summary section that counts existing ideas, plans, revisions, approvals, and tasks.
- Highlight bottlenecks such as plans waiting for review or ideas needing revision.
- Link users back into the existing inbox, review, factory, and task surfaces.
- Keep the dashboard factual and local to current database state.

Implementation guardrails:

- Do not create analytics infrastructure.
- Do not add charts unless simple counts are no longer sufficient.
- Do not add productivity scoring, timelines, calendars, or team metrics.
- Do not change the workflow to fit the dashboard.

Acceptance criteria:

- User can understand the current workload at a glance.
- Dashboard data comes from existing models.
- Counts match the underlying inbox, review, and task views.
- Dashboard does not become a new command center subsystem.

## 6. v0.9 Settings and Provider Controls Plan

Goal: make local AI provider configuration more visible and less fragile.

Allowed scope:

- Show current provider expectations for `AI_PROVIDER`, `OLLAMA_BASE_URL`, and `OLLAMA_MODEL`.
- Add read-only diagnostics or a small local settings/help surface.
- Add a connection check only if it stays within the existing Ollama provider boundary.
- Improve missing model and missing environment guidance.

Implementation guardrails:

- Keep AI provider logic isolated in `src/lib/aiProvider.ts`.
- Do not add multiple providers unless explicitly approved.
- Do not add connector management.
- Do not add user accounts, secrets vaults, cloud configuration, or plugin systems.
- Do not persist settings to the database unless separately approved.

Acceptance criteria:

- User can understand what local AI configuration is required.
- Failed Factory runs point to the same clear setup guidance.
- Provider checks do not create plans or mutate project data.
- App still works with the existing `.env.local` pattern.

## 7. v1.0 Release Readiness Checklist

Before v1.0, confirm:

- [ ] Core loop works three times in a row without code changes or manual database repair.
- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npx prisma generate` passes.
- [ ] `npm run build` passes.
- [ ] `npm run dev` starts the app successfully.
- [ ] Localhost smoke test verifies idea creation.
- [ ] Localhost smoke test verifies Factory planning.
- [ ] Localhost smoke test verifies Review Inbox display.
- [ ] Localhost smoke test verifies revision notes and re-planning.
- [ ] Localhost smoke test verifies approval and task generation.
- [ ] Export backup works on populated and empty local data.
- [ ] Archive/search/filter behavior is clear and documented.
- [ ] Asset visibility remains lightweight and plan-based.
- [ ] Settings/provider guidance is accurate for local Ollama use.
- [ ] No forbidden pre-v1.0 features were added.
- [ ] `docs/AGENT_RUN_REPORT.md` is updated with final validation notes.
- [ ] Human review approves the v1.0 release candidate.

## 8. Explicit Forbidden Features Before v1.0

Do not add these before v1.0:

- Agent meetings.
- Agent command center.
- Multi-agent orchestration.
- External connectors.
- GitHub connector.
- VSCode automation connector.
- ComfyUI integration.
- Calendar integration.
- Team accounts.
- Authentication.
- Cloud sync.
- Payments.
- Marketplace.
- Plugin system.
- Plugin marketplace.
- Deployment pipeline.
- Full asset vault.
- File upload and asset storage subsystem.
- Major new database models.
- Automation engine.
- Saved searches or advanced query language.

If a requested milestone appears to require one of these, stop and document the reason before implementation.

## 9. Testing Checklist Per Milestone

For every milestone:

- [ ] Review `AGENTS.md` and scope docs before editing.
- [ ] Confirm `git status --short --branch`.
- [ ] Avoid app code changes unless the milestone explicitly calls for them.
- [ ] Avoid Prisma schema changes unless clearly required and documented first.
- [ ] Run `npx prisma generate` when Prisma or generated client files may be affected.
- [ ] Run `npm run lint` when app code changes.
- [ ] Run `npx tsc --noEmit` when TypeScript app code changes.
- [ ] Run `npm run build` for production safety before release candidates.
- [ ] Run `npm run dev` for localhost smoke testing when app behavior changes.
- [ ] Manually verify the affected workflow path.
- [ ] Update `docs/AGENT_RUN_REPORT.md` with changed files, checks, localhost status, and deferred work.

Milestone-specific checks:

- v0.5.2 export backup: verify export with empty data, populated data, reviewed plans, revised plans, approved plans, and generated tasks.
- v0.6 asset visibility: verify required assets appear clearly without changing approval, revision, or task creation behavior.
- v0.7 search/filter/archive: verify main views, archived views, empty results, and filtered statuses.
- v0.8 dashboard: verify counts against actual ideas, plans, and tasks in the database.
- v0.9 settings/provider controls: verify missing env vars, missing model guidance, Ollama offline behavior, and successful normal planning.
- v1.0 readiness: run the full QA test plan three consecutive times.

## 10. Git Branch and Commit Strategy

Branch strategy:

- Keep milestone work on short-lived branches.
- Use one branch per milestone, for example:
  - `stabilize-v0-5-2-export-backup`
  - `polish-v0-6-asset-visibility`
  - `polish-v0-7-search-filter-archive`
  - `polish-v0-8-dashboard`
  - `polish-v0-9-provider-controls`
  - `release-v1-0-readiness`
- Start each branch from the latest stable committed baseline.
- Do not mix unrelated milestones in one branch.

Commit strategy:

- Commit after each stable phase.
- Keep commits small and reviewable.
- Prefer these message styles:
  - `Document ...`
  - `Polish ...`
  - `Fix ...`
  - `Stabilize ...`
  - `Refactor ...` only when behavior is preserved.
- Use the required roadmap commit message for this document:

```powershell
git add docs/ROADMAP_TO_V1.md
git commit -m "Document roadmap to v1.0"
```

Release strategy:

- Tag only after checks and manual QA are complete.
- Do not tag v1.0 until the release readiness checklist is complete and human approval is recorded.
