#!/usr/bin/env bash
# PILLAR 1 — INTENT-LOCK + FOUNDER-SIGNOFF gate (PreToolUse: Write|Edit).
# No spec / phase-prompt / orchestrator / precedence-index becomes build-truth, and
# no payload that contradicts the founder's locked intent is written, without an
# explicit `# FOUNDER-SIGNOFF: <YYYY-MM-DD>` token. Source of truth: ../INTENT-LOCK.md.
# This is the layer the 2026-06-29 drift slipped through: the contamination was PROSE
# in a spec (retire the / editor; edit-from-preview), invisible to code-pattern hooks.
# Reads hook JSON from stdin; exit 2 = block.
set -uo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("file_path") or "")')
content=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); ti=d.get("tool_input") or {}; print(ti.get("content") or ti.get("new_string") or "")')

# Gate only spec / prompt / orchestrator / precedence-index writes.
case "$file_path" in
  *docs/prism/*.md|*-PROMPT.md|*run-*chain*.sh|*SPEC-INDEX.md|*COMPLETION-SPEC*.md) : ;;
  *) exit 0 ;;
esac

signoff=0
if printf '%s' "$content" | grep -qiE '#[[:space:]]*FOUNDER-SIGNOFF:[[:space:]]*[0-9]{4}'; then signoff=1; fi

violations=()
if printf '%s' "$content" | grep -qiE '(retire|remove|migrate[ -]*away|replace|delete)([^.]{0,80})((legacy[ -]*(dom[ -]*)?)?[`'"'"'"]?/[`'"'"'"]?[ -]*(editor|route)|components/editor|legacy[ -]*editor)'; then
  violations+=("Proposes retiring/removing/migrating-away/replacing the working / editor (src/components/editor). PROTECTED — INTENT-LOCK fact #1.")
fi
if printf '%s' "$content" | grep -qiE 'edit([^.]{0,12})from([^.]{0,8})preview|click([^.]{0,30})preview([^.]{0,30})edit|prompt-?edit([^.]{0,20})from([^.]{0,8})preview'; then
  violations+=("Proposes editing FROM preview. Editing is in CANVAS; preview is the camera-locked running app. INTENT-LOCK fact #2.")
fi
if printf '%s' "$content" | grep -qiE 'rebuild([^.]{0,24})galaxy([^.]{0,24})directory|galaxy([^.]{0,32})(as[ ]a[ ])?(full[ ])?directory[^.]{0,32}(rebuild|build|completion)'; then
  violations+=("Proposes REBUILDING galaxy-as-directory. The galaxy ALREADY is the directory — verify/finish, never rebuild. INTENT-LOCK fact #3.")
fi
if printf '%s' "$content" | grep -qiE 'capability[ -]*glyphs?'; then
  violations+=("Proposes the unapproved W-4 'capability glyphs' system. Galaxy may have useful visual/content icons, but this planner invention needs founder signoff. INTENT-LOCK fact #8.")
fi
# Self-promotion of a spec to build-truth (the exact SPEC-INDEX/completion-spec pattern).
if printf '%s' "$content" | grep -qiE '\bSUPERSEDES\b|ACTIVE build-truth|Canonical \(additive\)'; then
  violations+=("Self-promotes a spec to build-truth (SUPERSEDES / 'ACTIVE build-truth' / 'Canonical (additive)'). A loop ratifying its own spec is exactly the 2026-06-29 pattern. INTENT-LOCK fact #7.")
fi

if [ ${#violations[@]} -gt 0 ] && [ $signoff -eq 0 ]; then
  {
    echo "⛔ INTENT-LOCK GATE blocked this write to: $file_path"
    for v in "${violations[@]}"; do echo " • $v"; done
    echo ""
    echo "These contradict the founder's locked intent (.claude/INTENT-LOCK.md)."
    echo "If the FOUNDER has explicitly approved this against the real codebase, the"
    echo "payload must carry a  # FOUNDER-SIGNOFF: <YYYY-MM-DD>  token (founder-authored only)."
    echo "Otherwise STOP and ask the founder — do not self-authorize."
  } >&2
  exit 2
fi
exit 0
