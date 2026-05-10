#!/usr/bin/env bash
set -euo pipefail

PROMPT_FILE="${1:-agentops/ONE_SHOT_BOOTSTRAP_PROMPT.md}"
SCHEMA_FILE="${SCHEMA_FILE:-agentops/schemas/mission_report.schema.json}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_DIR="agentops/logs"
REPORT_DIR="agentops/reports"
mkdir -p "$LOG_DIR" "$REPORT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: run this from inside a Git repository." >&2
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "Error: Codex CLI is not installed. Run: npm i -g @openai/codex" >&2
  exit 1
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

REPORT_PATH="$REPORT_DIR/mission-$STAMP.json"
STDERR_LOG="$LOG_DIR/codex-$STAMP.stderr.log"
JSONL_LOG="$LOG_DIR/codex-$STAMP.jsonl"

# Default unattended mode: workspace-write, no approval prompts, no full host access.
# It can edit the repo and run local checks but should fail closed on blocked operations.
if [ -f "$SCHEMA_FILE" ]; then
  codex exec - \
    --sandbox workspace-write \
    --ask-for-approval never \
    --json \
    --output-schema "$SCHEMA_FILE" \
    -o "$REPORT_PATH" \
    < "$PROMPT_FILE" \
    2> "$STDERR_LOG" \
    | tee "$JSONL_LOG"
else
  codex exec - \
    --sandbox workspace-write \
    --ask-for-approval never \
    --json \
    -o "$REPORT_PATH" \
    < "$PROMPT_FILE" \
    2> "$STDERR_LOG" \
    | tee "$JSONL_LOG"
fi

echo "Mission report: $REPORT_PATH"
echo "JSONL log:       $JSONL_LOG"
echo "stderr log:     $STDERR_LOG"
