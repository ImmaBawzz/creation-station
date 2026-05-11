# Private Beta Plan

Last updated: 2026-05-11

## Covered Stages

- Stage 1: Private creator workflow tool.
- Stage 2: Invite-only beta.

## Goal

Use a small, controlled beta to validate real creator workflows, identify trust gaps, and mature the product before limited public MVP exposure.

## Stage 1: Private Creator Workflow Tool

Users:

- One trusted creator/operator.

Enabled surfaces:

- Core idea/factory/review/task workflow.
- Manual content pipeline.
- Settings and local AI health.
- Backup export and restore.
- Activity and analytics summaries.
- Manual monetization tracking only if clearly treated as notes, not financial reporting.

Operating rules:

- Run backup before major changes.
- Keep direct publishing and imported analytics out of scope.
- Record confusing or repeated workflow issues in `TASKS.md`.
- Prefer manual review and clear status transitions over automation.

Success criteria:

- One creator can complete repeated real workflows without losing data.
- Content records and tasks remain inspectable after refresh.
- Backup export contains current workflow data.
- Beta-only or internal-only surfaces are classified in `FEATURE_GATING.md`.

## Stage 2: Invite-Only Beta

Users:

- 3-10 hand-picked creators who agree to provide feedback.
- No open signup.
- No agency-scale production yet.

Enabled surfaces:

- Stage 1 surfaces.
- Beta-only manual monetization tracking.
- Optional beta analytics summaries based on manually entered data.
- Feedback capture through docs/issues/manual notes.

Withheld:

- Direct publishing.
- Imported analytics.
- Payment or affiliate integrations.
- Provider runtime dashboards for general beta users.
- Autonomous workers.
- Marketplace or team features.

Onboarding checklist:

- Explain the product stage and known limitations.
- Explain that publishing remains manual.
- Explain that metrics and monetization values are manually entered.
- Confirm backup/export expectations.
- Confirm what feedback format is useful.
- Confirm beta users understand outputs require review.

Feedback cadence:

- Review feedback after each complete workflow.
- Group feedback into stability, clarity, trust, workflow speed, and missing controls.
- Promote only repeated or severe issues into near-term tasks.
- Do not add major features solely because one beta user requests them.

Technical controls:

- `CREATION_STATION_RELEASE_STAGE=stage2_invite_beta`.
- User access level no broader than `beta_user`.
- Feature flags available to disable unstable beta features.
- Restore remains beta/private only.
- Partner and advanced routes remain hidden from beta navigation.

Exit criteria before public MVP:

- Public MVP scope is frozen in `PUBLIC_MVP_SCOPE.md`.
- Public-safe features are clearly separated from private beta features.
- Gating tests pass.
- Core workflow smoke tests pass.
- No known P0/P1 data-loss, route crash, or trust-language issue remains open.
