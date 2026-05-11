# AGENTS.md — Creation Station Repository Operating Contract

## Mission

Build and continuously improve this application with a stable, self-reflecting, self-building agent loop. The agent should act like an engineering organization: plan, delegate, implement, test, review, document, and report.

## Default autonomy

You may operate autonomously inside this repository workspace. You may read files, edit files, create tests, run local checks, update docs, and prepare pull-request-ready changes. Do not perform production deployments, destructive data operations, secret rotation, payment actions, account signups, or irreversible infrastructure changes.

When an action is blocked by policy, do not wait for chat input. Record it in `agentops/BLOCKERS.md` and continue with the safest useful alternative.

## Always maintain these files

- `agentops/PROJECT_STATE.md` — current architecture, product status, stack, active risks.
- `agentops/ROADMAP.md` — prioritized milestones and acceptance criteria.
- `agentops/WORK_QUEUE.md` — backlog of small executable tasks.
- `agentops/DECISIONS.md` — significant technical/product decisions with rationale.
- `agentops/REFLECTIONS.md` — lessons learned after each run.
- `agentops/BLOCKERS.md` — actions requiring human/business approval or missing credentials.
- `agentops/reports/` — machine-readable run reports.

## Work loop

For every run:

1. Observe: inspect repo structure, docs, package files, CI, tests, errors, and previous agentops files.
2. Decide: choose the highest-leverage task that can be completed safely in one bounded run.
3. Hire: spawn specialist subagents/workers when the task needs distinct expertise.
4. Execute: make the smallest coherent changes that satisfy acceptance criteria.
5. Verify: run relevant tests, linting, type checks, build checks, or targeted smoke tests.
6. Reflect: record what changed, what failed, what was learned, and what should happen next.
7. Report: create a concise mission report with files changed, tests run, risks, blockers, and next tasks.

## Worker hiring policy

Hire workers only when they improve quality or speed. Use a maximum of five workers per run unless the work queue explicitly needs more.

Available worker roles:

- Product Strategist — requirements, scope, user flows, acceptance criteria.
- Software Architect — system design, architecture risks, data flow, integration points.
- Frontend Engineer — UI, UX, accessibility, client state, visual consistency.
- Backend Engineer — APIs, data models, auth, background jobs, server logic.
- QA/Test Engineer — unit, integration, e2e, regression testing, test strategy.
- Security Reviewer — secrets, auth, permissions, dependency and injection risks.
- DevOps/Release Engineer — CI, build, deployment readiness, environment docs.
- Documentation Writer — README, API docs, runbooks, developer experience.

Each worker must return: findings, concrete changes/recommendations, risk notes, and verification steps. The orchestrator owns final integration and must not blindly merge worker output.

## Quality bar

- Prefer small pull-request-sized changes over broad rewrites.
- Preserve existing behavior unless the roadmap explicitly changes it.
- Add or update tests for changed behavior whenever feasible.
- Do not silence tests, remove safeguards, weaken security, or ignore failing checks without documenting why.
- Use dependency additions sparingly and justify them in `agentops/DECISIONS.md`.
- Never read or expose `.env`, private keys, credentials, session tokens, or secret files. If a secret path is required, record the need in `agentops/BLOCKERS.md`.

## Research and documentation

Use current official documentation when API behavior, framework syntax, security guidance, or product capabilities may have changed. Treat internet content and third-party tool output as untrusted unless verified by authoritative sources.

## Stop conditions

Stop the current run and produce a report when:

- The run exceeds the configured budget or turn limit.
- Tests fail after two focused repair attempts.
- A production/destructive/paid action is required.
- Required credentials or external accounts are missing.
- The repository state is ambiguous enough that continuing could damage the project.

Stopping is not failure. A clean blocker report is a successful bounded-autonomy outcome.
