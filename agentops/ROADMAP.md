# AgentOps Roadmap

Last updated: 2026-05-11T14:20:00Z

## Active Milestone

Content pipeline MVP foundation: create a local-first path from content idea to brief, draft, publishing prep, published state, metrics, and monetization.

## Completed This Run

- Updated roadmap, task, architecture, MVP, and implementation log docs.
- Added additive content pipeline persistence models and migration.
- Added `/content` cockpit with manual content lifecycle forms.
- Added backup/export support for content pipeline records.
- Added focused unit/action tests, backup parser tests, smoke coverage, and content E2E coverage.
- Applied the additive content migration to local `dev.db` for localhost verification.

## Near-Term Milestones

1. Review and separate the current dirty worktree into focused commits.
2. Add Phase 2 AI-assisted content brief/draft generation with deterministic provider coverage.
3. Add content filters and a compact performance dashboard once content volume justifies it.
4. Investigate direct Prisma `db push` schema-engine failure separately.

## Guardrails

- Preserve the existing Idea/Factory/Task workflow.
- Keep MVP publishing, analytics, and monetization manual until credentials/integrations are explicitly approved.
- Avoid new dependencies unless a concrete workflow blocker requires them.
