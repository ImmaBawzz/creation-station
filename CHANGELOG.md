# Changelog

## Unreleased

- Prepared `v1.7.0-alpha.2` as an internal/private Creator Run pre-release candidate.
- Updated README positioning around local-first manual creator workflows.
- Added GitHub Actions CI for deterministic repository validation.
- Synchronized `package-lock.json` with npm 10.8.2 so CI can run `npm ci` from a clean checkout.
- Ran local validation for the release-prep branch.

## Creation Station v1.7.0-alpha.2 — Creator Run v0.1

Status: pre-release / internal-private alpha.

### Added

- Staged release planning and feature gating foundation.
- Manual content pipeline documentation and release posture.
- Creator Run v0.1 workflow.
- Production Packet generation for content items.
- Production task creation from content workflow.
- Markdown export for Production Packets.
- Repository validation workflow.
- Release readiness report with validation results.
- Lockfile synchronization for clean CI installs under the GitHub Actions npm version.

### Changed

- README now describes Creation Station as a local-first creator workflow control room rather than a small single-flow app.
- Release docs now reflect manual publishing, manual metrics, and private/beta monetization limits.

### Security And Hygiene

- Removed `dev.db` from tracked and remote reachable Git history.
- Verified a fresh remote clone has no database artifacts.
- Verified the `v1.6.0` source archive has no database artifacts.

### Deferred

- Direct publishing APIs.
- Imported analytics.
- Payment APIs.
- Affiliate APIs.
- External media generation providers.
- Autonomous execution.
- Public platform exposure.

## Creation Station v1.6.0

Status: stable release line.

- Modular intelligence layer baseline.
- Local-first deterministic workflow foundation.
- No direct publishing, imported analytics, payment processing, or autonomous execution.
