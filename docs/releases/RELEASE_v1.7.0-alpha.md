# Creation Station v1.7.0-alpha — Stabilized Core Workflow

Date: 2026-05-08

## Summary

This alpha release freezes the current master-line stabilization work around the core workflow: Idea -> AI Factory Plan -> Review -> Revision -> Approval -> Tasks. The focus of this cut is workflow safety, duplicate prevention, clearer review surfaces, and a repeatable validation trail rather than new product scope.

## Completed Stabilization Work

- Duplicate Factory submission prevention when a same-idea review plan is already waiting.
- Reusable pending submit control for Factory actions on the home and Factory screens.
- `factoryNotice` messaging that steers users back to Review Inbox instead of creating another plan.
- Real `IN_FACTORY` workflow state during planning, including rollback to the prior idea status on handled planner failure.
- Revision-aware re-planning that reuses the latest revision notes when generating the next draft.
- Improved Review Inbox readability for summary scanning, action counts, and revision-note visibility.
- Regression coverage for duplicate prevention, revision-aware re-planning, and `IN_FACTORY` rollback.
- Playwright smoke coverage for core route rendering and export response validation.
- Full deterministic Playwright E2E coverage for create idea -> Factory plan -> revision request -> revised plan -> approval -> task creation.
- Project documentation updates reflecting the active master-line stabilization state.

## Validation Commands

- `npm run test`
- `npm run lint`
- `npx tsc --noEmit`
- `npx prisma generate`
- `npm run test:smoke`
- `npx playwright test`

## Known Limitations

- Full workflow E2E runs against a deterministic local test provider, not live Ollama output.
- The Playwright harness uses an isolated production-style server on port `3100` because Next.js blocks a second `next dev` instance for the same repo while another dev server is already running.
- Export validation remains smoke-level rather than exhaustive.
- Autonomy and broader v2 orchestration work remain intentionally out of scope for this release.

## Recommended Next Phase

Keep the product scope locked and continue release-hardening on the existing workflow. The next phase should deepen failure-path coverage around the live provider, expand export assertions beyond smoke coverage, and continue tightening review/task clarity without starting new subsystems.