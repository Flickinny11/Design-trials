#!/usr/bin/env bash
# Stop / SubagentStop — MODERNIZED, NON-BLOCKING spec-criteria reminder.
#
# Replacement for the retired kripverify auto-spawn Stop hook. It NEVER blocks
# and NEVER loops. Instead of forcing continuation (decision:block / exit 2), it
# returns `hookSpecificOutput.additionalContext` — a string Claude Code injects
# as a system-reminder on the next turn — naming which canonical-3 success
# criteria are still UNMET so work continues organically.
#
# Ledger (source of truth):
#   kid-kode-landing/notes/verification/unmet-criteria.json
#     { "unmet": [ {"id":"RT-SC-10","spec":"PRISM-RUNTIME-SPEC","note":"..."} ],
#       "updated": "YYYY-MM-DD" }
# Empty list or missing file -> silent (exit 0).
#
# Safety: honors stop_hook_active (never participates in a loop).
# Exit code: ALWAYS 0. Feedback is carried in JSON stdout (additionalContext).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$HERE/../.." && pwd)}"
LEDGER="$PROJECT_DIR/kid-kode-landing/notes/verification/unmet-criteria.json"
exec /usr/bin/python3 "$HERE/spec-criteria-stop.py" "$LEDGER"
