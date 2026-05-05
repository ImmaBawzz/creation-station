# Paste This Into VSCode Agent Autopilot

You are working in my local Creation Station project.

I need you to stabilize v0.5.1 only. Do not expand the platform.

Read these files first:
- `AGENTS.md`
- `docs/SCOPE_LOCK.md`
- `docs/STABILITY_CHECKLIST.md`
- `docs/PRD_v0_5_1_STABILIZATION.md`
- `docs/BUILD_PLAN_v0_5_1.md`
- `docs/QA_TEST_PLAN_v0_5_1.md`

Your mission:

Polish the current working app without adding new systems.

The core workflow is:

Idea → AI Factory Plan → Review → Revision → Approval → Tasks

Do only these tasks, in this order:

1. Confirm git status and current branch.
2. Create or use a branch called `polish-v0-5-1`.
3. Run:
   - `npm install`
   - `npx prisma generate`
   - `npx tsc --noEmit`
   - `npm run lint`
4. If checks reveal errors, fix only the errors related to the current app.
5. Implement Phase 1 from `docs/BUILD_PLAN_v0_5_1.md`: status labels and badges.
6. Test manually enough to confirm the app still loads.
7. Commit with:
   - `git add .`
   - `git commit -m "Polish status labels"`
8. Implement Phase 2: empty states.
9. Commit with:
   - `git add .`
   - `git commit -m "Improve empty states"`
10. Implement Phase 3: review/revision clarity.
11. Commit with:
   - `git add .`
   - `git commit -m "Clarify revision flow"`
12. Implement Phase 4 only if safe: clearer AI/Ollama error messages.
13. Commit with:
   - `git add .`
   - `git commit -m "Improve AI planner error messages"`
14. Create or update:
   - `docs/AGENT_RUN_REPORT.md`

Hard restrictions:
- Do not add agent meetings.
- Do not add connectors.
- Do not add asset vault.
- Do not add plugin system.
- Do not add authentication.
- Do not add deployment.
- Do not add new major database models.
- Do not rewrite architecture.
- Do not delete working files.
- Do not touch unrelated systems.

Stop immediately if:
- The app stops compiling.
- You need to modify more than 5 files for one small task.
- A task requires a new database model.
- The scope starts drifting beyond v0.5.1 stabilization.

When finished, report:
- Files changed
- Commands run
- Tests/checks passed
- Anything that failed
- Next recommended human review step
