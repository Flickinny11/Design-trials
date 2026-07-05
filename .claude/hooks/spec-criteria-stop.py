#!/usr/bin/env python3
"""Analyzer for spec-criteria-stop.sh (Stop / SubagentStop).

NON-BLOCKING, NON-LOOPING. Reads the hook JSON on stdin; argv[1] is the path to
the unmet-criteria ledger. Emits hookSpecificOutput.additionalContext naming the
still-unmet canonical-3 success criteria so work continues organically on the
next turn. Never blocks (always exit 0), never forces continuation.
"""
import json
import sys


def main() -> int:
    ledger_path = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}

    # Never loop: if a prior Stop hook already kept the turn going, stay silent.
    if data.get("stop_hook_active") is True:
        return 0

    event = data.get("hook_event_name") or "Stop"

    try:
        with open(ledger_path) as f:
            ledger = json.load(f)
    except Exception:
        return 0  # no ledger -> nothing to say

    unmet = ledger.get("unmet") or []
    if not unmet:
        return 0  # all clear

    lines = []
    for item in unmet:
        cid = item.get("id", "?")
        spec = item.get("spec", "")
        note = item.get("note", "")
        spec_s = f" [{spec}]" if spec else ""
        suffix = f" — {note}" if note else ""
        lines.append(f"  - {cid}{spec_s}{suffix}")

    ids = ", ".join(i.get("id", "?") for i in unmet)
    msg = (
        f"Spec criteria still UNMET ({len(unmet)}): {ids}. Tracked in "
        f"notes/verification/unmet-criteria.json — the STEP-4 work list. Each must close "
        f"with EVIDENCE (screenshot / console output / scene-graph assertion) graded against "
        f"the canonical-3 numbered criteria, never 'I added it'. This is a reminder, not a "
        f"block.\n" + "\n".join(lines)
    )
    msg = msg[:8000]  # additionalContext is capped at 10k by Claude Code.

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": event,
            "additionalContext": msg,
        }
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
