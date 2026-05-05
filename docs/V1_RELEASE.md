# Creation Station v1.0 Release Notes

## Release Goal

Creation Station v1.0 is a complete local-first solo creator workflow:

```text
Idea Inbox -> AI Factory Planner -> Review Inbox -> Revision -> Approval -> Tasks
```

The release focuses on reliability, clarity, and local control. It does not expand into teams, cloud sync, connectors, plugin systems, or an asset vault.

## Product Surface

- Dashboard: overview of ideas, review load, tasks, and recent work.
- Inbox: idea capture, search, filtering, archive visibility, review, approval, and task board.
- Factory Planner: local Ollama planning for saved ideas.
- Settings: AI provider status, Ollama model status, health test, and prompt presets.
- Release Checklist: final manual QA checklist and guardrails.
- Export Backup: local JSON backup of ideas, plans, and tasks.

## First-Use Flow

New users should:

1. Open Settings and confirm the local Ollama provider is configured.
2. Capture one raw idea in the Inbox.
3. Send the idea to the Factory Planner.
4. Review the generated plan.
5. Request revision if the plan needs correction.
6. Approve the plan when ready.
7. Confirm generated tasks appear on the task board.
8. Export a local backup before continuing substantial work.

## Release Readiness Checklist

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Localhost opens at `/`.
- [ ] `/dashboard` loads and shows counts.
- [ ] `/factory` loads and shows planning candidates or empty state.
- [ ] `/settings` loads and shows AI provider status.
- [ ] `/release` loads and shows checklist.
- [ ] Export Backup downloads JSON with ideas, factoryPlans, and tasks.
- [ ] Create idea works.
- [ ] Send to Factory works.
- [ ] Review Inbox shows generated plan.
- [ ] Revision request saves notes.
- [ ] Re-plan with feedback works.
- [ ] Approval creates tasks.
- [ ] Task Board shows generated tasks.

## Explicitly Deferred

- Authentication
- Teams
- Cloud sync
- External connectors
- Plugin systems
- Full asset vault
- New AI provider systems
- Calendar or meeting systems
- Deployment infrastructure

## Notes for Future Work

Future work should continue in small milestones. Any change that requires schema expansion, a new subsystem, or external services should be planned and reviewed before implementation.
