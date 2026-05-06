# Creation Station v1.5 Release Hardening QA

Date: 2026-05-06

Branch: `feature/v1.5-release-readiness`

Scope: QA current uncommitted v1.5 release-readiness work without adding features. Reviewed task-board scalability, Idea Inbox UX, onboarding, manual backup/restore, analytics, route health, build health, and local persistence safety.

## Checks Run

- `npm run lint` - pass
- `npm run build` - pass
- `npm run test` - not available; `package.json` has no `test` script
- Route smoke: `/`, `/dashboard`, `/factory`, `/settings`, `/release`, `/api/export` all returned `200`
- Export smoke: `/api/export` returned `version`, `exportedAt`, `appVersion`, `ideas`, `projects`, `factoryPlans`, `tasks`, `taskBlockers`, and `settings`
- Invalid restore smoke: invalid backup redirected with a useful `backupStatus=error` message
- Valid restore smoke: current backup restored successfully, then original `dev.db` was restored from a byte copy
- Fresh-workspace smoke: ignored empty SQLite copy showed no ideas, no project plans, no tasks, and first-idea anchor
- Analytics smoke: export and onboarding events logged locally; unsupported client event rejected with `400`
- Analytics retention smoke: event log capped at 500 events

## Critical Issues

None found.

## Medium Issues

1. Edit flows requested in QA are not implemented.
   - Project edit, task edit, and idea edit controls are not exposed in the current app.
   - Existing supported actions are create idea, convert idea, request revision, approve plan, archive idea, update task status, and manage task blockers.
   - This is not a regression from v1.4, but release notes should avoid claiming edit support.

2. Analytics file writes are simple local writes and are not concurrency-safe.
   - A rapid 505-request analytics stress loop produced one transient connection reset, although the app recovered and retention still capped at 500 events.
   - This is acceptable for solo local use but should not be treated as robust multi-process telemetry.

3. Restore valid-backup QA is destructive by design.
   - The restore path was tested using a current backup and a byte copy of `dev.db`, then the original DB file was restored.
   - A release candidate should repeat this on a disposable database, not the user's working data.

4. Full browser click-through onboarding QA was limited.
   - Server-side fresh-workspace detection was verified.
   - Browser-local `localStorage` skip/completion behavior was not fully click-tested because Playwright/browser automation is not installed in this workspace.

## Minor Issues

1. The Settings analytics dashboard may show a large event count after QA stress testing.
   - The log is ignored under `.creation-station/`.
   - This is local QA data only.

2. Project filter labels on the task board may become long.
   - Labels combine idea title and plan title.
   - The layout remains usable, but long names can add visual density.

3. The app logs Prisma queries in local runtime output.
   - This is useful for development but noisy during QA.

## Recommended Fixes

Before release candidate:
- Clarify in release notes that edit/delete project, idea, and task flows are not part of v1.5 unless implemented later.
- Perform one browser click-through QA pass on a disposable database for:
  - onboarding skip
  - onboarding completion
  - create idea
  - convert idea through Factory
  - approve into tasks
  - move task to done and archived
  - restore from valid backup
- Consider serializing analytics writes if local event logging becomes important beyond lightweight release insights.

No immediate critical-code fix is required from this QA pass.

## Release Blockers

None identified from lint, build, route smoke, export, restore validation, fresh-workspace rendering, or analytics smoke.

## Safe-To-Ship Verdict

Conditionally safe to ship after a final disposable-database browser QA pass. The current implementation passes static validation and server-rendered smoke checks, but v1.5 release notes should explicitly state unsupported edit/delete flows and the local-only nature of analytics and backup restore.
