# Creation Station — Workspace Agent Instructions

You are working inside the Creation Station codebase.

## Mission

Stabilize the existing v0.5 core workflow only:

Idea → AI Factory Plan → Review → Revision → Approval → Tasks

The current system already has:
- Next.js app structure
- SQLite/Prisma data layer
- Local Ollama AI Factory Planner
- Factory prompt module
- Review Inbox
- Revision/re-plan loop
- Dynamic task generation from plan.nextActions

Your job is not to expand the platform. Your job is to polish the current core until it is reliable, readable, and safe.

## Hard Scope Lock

Do not add:
- Agent meetings
- External connectors
- Asset vault as a major new module
- Plugin system
- ComfyUI integration
- VSCode automation integration
- Calendar/team systems
- Marketplace
- New large database models
- Authentication
- Cloud sync
- Payments
- Deployment infrastructure

## Allowed Work

You may:
- Improve status labels and UI badges
- Improve empty states
- Improve error messages
- Improve review/revision clarity
- Improve task board clarity
- Add small helper functions
- Add lightweight docs
- Fix TypeScript errors
- Fix Prisma issues
- Fix broken imports
- Fix broken server actions
- Run tests/checks
- Commit small coherent changes

## Engineering Rules

1. Make small changes.
2. Keep each change reversible.
3. Do not rewrite the app architecture.
4. Do not remove working functionality.
5. Preserve the current data model unless absolutely required.
6. If a database change is unavoidable, explain it first in `docs/CHANGELOG.md`.
7. Keep Server Actions server-side.
8. Keep the AI provider isolated in `src/lib/aiProvider.ts`.
9. Keep prompt construction isolated in `src/lib/factoryPrompt.ts`.
10. Prefer helper files over duplicating UI logic.

## Required Validation After Every Change

Run:

```powershell
npm run lint
npx tsc --noEmit
npx prisma generate
npm run dev
```

Then manually verify:
1. Create idea.
2. Send idea to AI Factory.
3. Plan appears in Review Inbox.
4. Request revision with notes.
5. Re-plan with feedback.
6. Approve plan.
7. Tasks appear on board.

If any check fails, fix before continuing.

## Commit Discipline

Commit after each stable unit:

```powershell
git add .
git commit -m "Clear message describing one change"
```

Suggested commit style:
- `Polish status labels`
- `Improve empty states`
- `Clarify revision flow`
- `Add stability docs`
- `Fix task board display`

## Stop Conditions

Stop immediately if:
- The app no longer starts.
- Prisma schema and database drift become unclear.
- More than 5 files need changes for one task.
- A requested improvement requires a new subsystem.
- You are about to modify unrelated files.

When stopped, write a short report in `docs/AGENT_RUN_REPORT.md`.
