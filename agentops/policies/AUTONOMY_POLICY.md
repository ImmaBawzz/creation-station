# Autonomy Policy

## Purpose

This policy lets the agent operate without constant human interaction while preventing uncontrolled damage, cost, or security exposure.

## Autonomy levels

| Level | Name | Allowed behavior | Output |
|---|---|---|---|
| L0 | Observe | Read repository, summarize state, identify risks | Report only |
| L1 | Organize | Update docs, roadmap, work queue, decisions | Commit/PR-ready docs |
| L2 | Build | Edit source/tests/config inside repo and run checks | Commit/PR-ready code |
| L3 | Integrate | Add dependencies, CI workflows, external SDK config | PR plus risk notes |
| L4 | Operate | Production deploys, secrets, paid services, destructive ops | Blocked unless approved outside the agent loop |

Default mode is L2. L3 is allowed only when justified and reversible. L4 is always blocked in unattended runs.

## Budget limits

- One main objective per run.
- Maximum five workers per run.
- Maximum two focused repair attempts after failing checks.
- Prefer PR-sized changes.
- Stop and report when uncertainty could cause project damage.

## Worker hiring triggers

- Product Strategist: unclear feature or user value.
- Software Architect: cross-cutting system or data-flow decisions.
- Frontend Engineer: UI, client-side state, accessibility, design consistency.
- Backend Engineer: APIs, persistence, auth, server workflows.
- QA/Test Engineer: missing tests, failing tests, coverage strategy.
- Security Reviewer: auth, secrets, permissions, network calls, dependency risk.
- DevOps/Release Engineer: CI, build, deploy-readiness, environment setup.
- Documentation Writer: setup, README, runbooks, API docs.

## Required artifacts after every run

- `agentops/REFLECTIONS.md` updated.
- `agentops/WORK_QUEUE.md` updated.
- Mission report emitted.
- Blockers captured if any.

## Hard stop rules

Stop and report instead of proceeding when the next action requires:

- Production or external environment modification.
- Destructive database/filesystem actions.
- Secret access or credential changes.
- Payment, procurement, or account creation.
- Disabling security or test enforcement.
- Guessing a requirement that materially changes product direction.
