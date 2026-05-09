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

- WAN integration
- LTX integration
- Flowframes integration
- advanced multi-node experimental workflows
- uncontrolled custom node expansion

## Controlled Video Orchestration Scope

Image-to-video work is allowed only under a narrow, orchestration-first scope:

- The approved module boundary is `src/modules/video-generation/`.
- The first milestone must be orchestration-only and must not call real video models.
- Allowed initial work is limited to manifest structures, queue/status orchestration, provider adapter interfaces, a `mock-video-provider`, and UI placeholders or status surfaces for scene video generation.
- The approved initial manifest output is `sceneVideos.json`.
- Preserve stability-first architecture principles and keep Creation Station orchestration-first across planning → generation → rendering → packaging.

Still blocked until separate approval:

- real WAN execution
- real LTX execution
- real Kling execution
- real Hunyuan execution
- Flowframes interpolation
- automatic custom node installs
- uncontrolled video workflow imports

Real video providers require a separate governance update and a dedicated validation branch before implementation.

## Controlled Quality Director Scope

Quality evaluation is allowed only under controlled scope rules:

- The approved module boundary is `src/modules/quality-director/`.
- The quality director must remain read-only analysis of existing manifests.
- It must not modify upstream manifests, database models, or pipeline outputs.
- Output is limited to `qualityReport.json` written to `projects/[id]/quality/`.
- No new npm dependencies are allowed for quality evaluation.
- No external service calls are allowed.
- Preserve stability-first architecture principles and keep Creation Station orchestration-first across planning → generation → rendering → packaging.

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
- Add orchestration-only video-generation scaffolding within `src/modules/video-generation/` when it stays inside the approved mock-provider boundary above
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
11. Before any approved orchestration milestone that is expected to touch more than 5 files, explicitly list the planned file set before execution and keep the implementation narrowly scoped to that list.

## Required Validation After Every Change

Run:

```powershell
npm run lint
npx tsc --noEmit
npx prisma generate
npm run dev
```

For approved orchestration milestones before commit, also run:

```powershell
npm run lint
npx tsc --noEmit
npx prisma generate
npm run build
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
- More than 5 files need changes for one task, unless the work is a pre-approved orchestration milestone within the existing architecture and satisfies every orchestration exception rule below.
- A requested improvement requires a new subsystem outside the approved modular surfaces, including the controlled `src/modules/comfy/` image-generation scope, the controlled `src/modules/video-generation/` orchestration-only scope, and the controlled `src/modules/quality-director/` read-only analysis scope.
- A requested video-generation change attempts real provider execution, custom node expansion, or any unapproved integration surface beyond the mock-provider orchestration boundary.
- You are about to modify unrelated files.

## Controlled Multi-File Orchestration Exception

The default expectation is still to stay within 5 changed files for small fixes, bug fixes, refactors, UI tweaks, and utility updates.

Changes above that threshold are allowed only when all conditions are true:

- the task is pre-approved
- the task belongs to the existing architecture
- no new external infrastructure is introduced
- no dependency expansion is introduced
- no new model families are introduced
- no security scope changes are introduced
- no database schema expansion is introduced unless explicitly requested

Additional requirements for approved multi-file orchestration milestones:

- The agent must explicitly list affected files before execution.
- The agent must preserve narrow scope and avoid opportunistic expansion.
- Validation before commit must include `npm run lint`, `npx tsc --noEmit`, `npx prisma generate`, and `npm run build`.

Approved examples:

- scene orchestration
- media orchestration
- workflow orchestration
- queue orchestration
- manifest systems
- adapter layers
- quality evaluation

Still blocked:

- unapproved infrastructure expansion
- unapproved model ecosystems
- unapproved external services

When stopped, write a short report in `docs/AGENT_RUN_REPORT.md`.
