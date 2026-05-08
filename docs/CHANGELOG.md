# Changelog

## v1.8.0 - Activity Event Foundation

### Added

- Durable `ActivityEvent` Prisma model for auditable workflow history across ideas, plans, tasks, and backup exports.
- Shared `logActivity()` and `getRecentActivity()` utilities for server actions and dashboard reads.
- Dashboard `Recent Activity` panel with event labels, entity titles, timestamps, and compact metadata summaries.
- Focused unit coverage for activity creation, retrieval ordering, and workflow logging integration.

### Changed

- Existing idea creation, Factory send, revision request, plan approval, task generation, and backup export flows now emit activity events without changing their core workflow logic.

### Not Added

- Autonomous execution
- Background agents
- Websocket systems
- Notification systems
- Large architecture rewrites

## v1.4.1 - Recommendation Tuning

### Added

- Deterministic recommendation scoring for task age, project momentum, blocker impact, context grouping, and stale task penalties.
- v1.4.1 recommendation QA report covering all four pipelines.

### Changed

- Automation pipeline guidance now separates local automation, API automation, infrastructure automation, and AI tooling automation.
- Local automation prompt guidance now avoids cloud, external API, and credential assumptions unless explicitly requested.
- Task-board dependency candidate rendering now uses lightweight same-plan task references to keep large local QA boards stable.

### Not Added

- Prisma schema changes
- External AI integrations
- Automation runners
- Cloud automation connectors
- New task flow

## v1.4.0 - Modular Pipeline Foundation

### Added

- Central pipeline registry for music, visual, game, automation, and general planning.
- Pipeline-aware Factory prompt guidance while preserving the existing JSON plan shape.
- Compact pipeline filtering and counts for the inbox and task board.
- v1.4 modular pipeline architecture documentation.

### Changed

- Idea routing now consumes shared pipeline definitions instead of hardcoded route rules.
- Pipeline badges and recommendations use the same shared registry.

### Not Added

- Prisma schema changes
- Separate pipeline routes
- Agent systems
- External connectors
- Asset vault
- Automation runners

## v1.3.1 - Intelligence Persistence Hardening

### Added

- Durable `TaskBlocker` relationships for persisted task dependencies.
- Multiple blockers per task through the existing task-board dependency panel.
- Export backup coverage for task blocker relationships.

### Changed

- New blocker edits write to the `TaskBlocker` table instead of `Task.labels`.
- Recommendation and waiting-state logic prefer persisted blocker relationships while still reading legacy metadata as a fallback.
- Stale task detection now accounts for status and priority, not only age.

### Not Added

- Dependency graph UI
- Automation engine
- Agent workflow system
- Deadline schema
- Large task-board rewrite

## v1.2.1 - Task Metadata Hardening

### Added

- Explicit `Task.labels` metadata field for task-board labels.
- Serialized task labels for newly approved plan tasks.
- Backward-compatible task-board fallback labels for older tasks with empty label metadata.

### Changed

- Task-board label filters now prefer explicit task metadata before using legacy fallback grouping.

### Not Added

- New task models
- Label management UI
- External tagging systems
- Task logic rewrites
- Large schema redesign

## v1.0 — Release Polish

### Added

- First-use onboarding panel for empty workspaces.
- Release readiness checklist page.
- Shared navigation sidebar across core product pages.
- Wider export backup visibility from navigation sidebars and release checklist.
- v1.0 release documentation.

### Changed

- Removed locked future areas from the main navigation.
- Improved empty first-run guidance and release QA guidance.
- Tightened UI consistency across Inbox, Dashboard, Factory, Settings, and Release pages.

### Not Added

- Schema changes
- Authentication
- Teams
- Connectors
- Plugin systems
- Cloud sync
- Asset vault
- New AI systems

## v0.9 — Settings and AI Controls

### Added

- Settings route for local AI provider diagnostics.
- Current AI provider, Ollama model, base URL, and environment readiness display.
- Server-side AI connection test for local Ollama and the configured model.
- AI health messaging for setup and connection failures.
- Browser-local editable prompt presets used by Factory planning and revision prompts.

### Not Added

- Authentication
- Cloud accounts
- Team features
- Schema changes
- External connectors
- Plugin systems
- Asset vault

## v0.8 — Dashboard Overview

### Added

- Dashboard page with total ideas, ideas by status, plans waiting review, and tasks by status.
- Recent activity panels for ideas, approved plans, and tasks.
- Dashboard navigation from the existing Inbox and Factory Planner sidebars.

### Not Added

- Schema changes
- New dependencies
- Chart libraries
- Authentication
- Teams
- Connectors
- Plugin systems
- Asset vault

## v0.7 — Search, Filter, and Archive

### Added

- Idea Inbox search for titles, raw text, tags, and summaries.
- Status filter for existing idea statuses.
- Archived ideas are hidden from the main inbox by default.
- Archived view toggle for reviewing archived ideas.

### Not Added

- Schema changes
- New dependencies
- Authentication
- Teams
- Connectors
- Asset vault
- Advanced search syntax

## v0.6 — Asset Visibility

### Added

- Clear required-asset lists with counts in Review Inbox.
- Clear required-asset lists with counts on the Factory Planner latest plans.
- Small asset need cues on task cards using each task's source plan.

### Not Added

- Asset vault
- File uploads
- Asset storage
- Asset database models
- External asset connectors

## v0.5.2 — Export Backup

### Added

- Local JSON export route for all Ideas, FactoryPlans, and Tasks.
- Export Backup button on the home UI.
- Backup metadata with `generatedAt` and `appVersion`.

### Not Added

- Prisma schema changes
- Authentication
- Cloud storage
- Asset vault
- Connectors
- New AI features

## v0.5.1 — Stabilization

### Added

- Stabilization documentation
- Agent autopilot instructions
- QA test plan
- Build plan
- PRD for stabilization

### Changed

- Pending agent work:
  - Status label polish
  - Empty state polish
  - Review/revision clarity
  - AI planner error clarity

### Not Added

- Agents
- Connectors
- Asset vault
- Meetings
- Automation engine
- Plugin system
