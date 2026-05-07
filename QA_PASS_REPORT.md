# v1.6 Manual QA Pass Report

Date: 2026-05-07
Branch: `feature/v1.6-intelligence-layer`
Verdict: `RELEASE_READY`

## Environment

- App URL: `http://127.0.0.1:3000`
- Browser path: Codex in-app Browser plugin for DOM and interaction checks.
- Browser limitation: screenshot capture timed out, and one Browser tab crashed during a long large-board DOM session. A fresh tab reloaded the app successfully with no app console errors.
- Database: QA fixtures were created during the pass, then cleaned up. `dev.db` was restored to the tracked baseline after testing.

## Workflow Coverage

### Idea Inbox

- PASS: Created a new idea through the New Idea form.
- PASS: Created a second idea and used Archive as the reject path.
- PASS: Archived idea disappeared after refresh, confirming persistence.
- PASS: Empty/search state was exercised with filtered views.
- GAP: There is no dedicated edit-idea UI in the current product.
- GAP: There is no explicit approve/reject idea action; current workflow uses Convert in Factory and Archive.

### Factory Pipeline

- PASS: Opened Factory Planner and generated an AI plan from a raw idea using local Ollama.
- PASS: Success state rendered at `/factory?factorySuccess=...`.
- PASS: Generated plan appeared in Latest AI Plans and Review Inbox.
- PASS: Revised plan generation succeeded after requesting revision.
- PASS: No stuck `IN_FACTORY` state was found.
- GAP: There is no visible long-running processing indicator beyond the eventual success/error message.

### Review System

- PASS: Submitted generated output for review by creating a Factory plan.
- PASS: Requested revision with notes from Review Inbox.
- PASS: Revision notes were persisted on the selected plan.
- PASS: Re-ran Factory for the revised idea.
- PASS: Approved final output and created tasks.

### Task Board

- PASS: Approving a plan created tasks from `nextActions`.
- PASS: Moved a QA task from `TODO` to `DONE`.
- PASS: Archived the completed QA task.
- PASS: Seeded 40 QA bulk tasks under the approved QA plan to test board scalability.
- PASS: Board rendered 40 visible bulk tasks across Active, Blocked, Backlog, Completed, and Archived sections.
- PASS: No app console warnings/errors were reported during task-board checks.

### Intelligence Layer

- PASS: AI Recommendations panel rendered on the home page.
- PASS: Recommendation cards rendered title, body, href target, and tone styling.
- PASS: Prioritizer surfaced next-work and blocked-work signals after task fixture creation.
- PASS: Recommender output included a blocker clarification signal for a blocked task without details.
- PASS: Router fallback behavior rendered `General planning` for a raw Worldbuilding idea with no matching pipeline keywords.
- PASS: Existing unit tests and coverage thresholds passed for `src/lib/intelligence/*.ts`.

### Error Testing

- PASS: Required form fields prevented empty idea creation at the browser level.
- PASS: Invalid analytics API request returned `HTTP 400 {"error":"Unsupported analytics event."}`.
- PASS: Backup export API returned `HTTP 200` with JSON content.
- PASS: Refresh persistence confirmed for created, archived, planned, revised, approved, and task status flows.
- OBSERVED: Repeated Factory submission can create duplicate review plans for the same idea.

### UI Validation

- PASS: Desktop DOM rendered meaningful content, no framework overlay, and no app console warnings/errors.
- PASS: Main surfaces use responsive grid classes for desktop/mobile breakpoints.
- PASS: Button groups remained accessible in DOM under dense task-board and review states.
- PARTIAL: Visual screenshot evidence could not be captured because Browser screenshot capture timed out.
- PARTIAL: Mobile viewport screenshot validation was not completed due Browser tooling instability after the large-board run.

### Performance Validation

- PASS: `npm run build` completed with no bundle warnings.
- PASS: No obvious client-side rerender loops were observed; core workflow remains mostly server-rendered.
- PASS: 40-task board fixture rendered without app console errors.
- OPPORTUNITY: Add pagination or virtualized sections only if real task counts grow beyond current local workflow expectations.

## Commands Run

- `npm run lint`
- `npm test`
- `npm run test:coverage`
- `npm run build`
- `Invoke-WebRequest http://127.0.0.1:3000/api/analytics` with invalid payload
- `Invoke-WebRequest http://127.0.0.1:3000/api/export`

## Release Readiness

`RELEASE_READY`

No critical bugs were found. The observed issues are workflow polish or duplicate-entry hardening items and do not block the v1.6 intelligence-layer foundation release.
