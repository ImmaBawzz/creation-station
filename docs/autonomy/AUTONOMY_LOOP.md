# Creation Station Autonomy Loop

The agent may run bounded autonomous iterations.

Each iteration must:
1. Inspect repo state.
2. Read current docs.
3. Select one smallest safe task.
4. Implement minimal changes.
5. Run checks.
6. Commit if stable.
7. Update AGENT_RUN_REPORT.
8. Emit NEXT_AGENT_INPUT.

Stop conditions:
- failed checks
- unclear Git state
- Prisma schema change required
- dependency required
- destructive operation required
- scope expansion required
- no clear next safe step