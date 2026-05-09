# Creation Station — Workspace Agent Instructions

You are working inside the Creation Station codebase.

## Mission

Stabilize the existing v0.5 core workflow only:

Idea → AI Factory Plan → Review → Revision → Approval → Tasks

Creation Station remains orchestration-first across the broader platform flow:

planning → generation → rendering → packaging

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
- VSCode automation integration
- Calendar/team systems
- Marketplace
- New large database models
- Authentication
- Cloud sync
- Payments
- Deployment infrastructure

## Controlled Comfy Scope

ComfyUI integration is allowed only under controlled scope rules:

- ComfyUI is currently allowed only for image-generation workflows.
- The only currently approved ComfyUI workflow is FLUX Schnell concept generation.
- Comfy integration must remain modular under `src/modules/comfy/`.
- Creation Station must stay orchestration-first: planning → generation → rendering → packaging.
- Preserve stability-first architecture principles for any Comfy-related change.

Do not add ComfyUI support for:

- video generation
- WAN integration
- LTX integration
- Flowframes integration
- advanced multi-node experimental workflows
- uncontrolled custom node expansion

Any future video-oriented integration requires explicit milestone approval before implementation.

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
- Integrate approved ComfyUI image workflows within the controlled scope above
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
- A requested improvement requires a new subsystem outside the approved modular surfaces, including the controlled `src/modules/comfy/` image-generation scope.
- A requested Comfy change expands into video workflows or any unapproved integration surface.
- You are about to modify unrelated files.

When stopped, write a short report in `docs/AGENT_RUN_REPORT.md`.
