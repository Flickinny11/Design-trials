#!/usr/bin/env bash
# PILLAR 2 — DESTRUCTIVE-ACTION gate (PreToolUse: Write|Edit|Bash).
# Hard-blocks deletion / move / route-removal of PROTECTED paths even under
# bypassPermissions. The W-5 drift prompt literally ordered "REMOVE the legacy /
# route"; under bypassPermissions an `rm -rf src/components/editor` would have run
# with no prompt. Not anymore. Source of truth: ../INTENT-LOCK.md.
# Reads hook JSON from stdin; exit 2 = block.
set -uo pipefail

input=$(cat)
tool=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tool_name") or "")')
command=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("command") or "")')
file_path=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("file_path") or "")')
content=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); ti=d.get("tool_input") or {}; print(ti.get("content") or ti.get("new_string") or "")')

# Founder override token (founder-authored only).
override=0
if printf '%s\n%s' "$command" "$content" | grep -q 'FOUNDER-OVERRIDE'; then override=1; fi

# The protected paths (regex).
PROT='src/(app/page\.tsx|components/editor(/|$|[^-])|components/editor/keyframe|components/editor/walkthrough)|src/lib/prism/'

violations=()

if [ "$tool" = "Bash" ] && [ -n "$command" ]; then
  # Deletion / move / hard-reset / branch-delete that names a protected path.
  if printf '%s' "$command" | grep -qE '\b(rm|rmdir|git[[:space:]]+rm|mv|trash)\b' \
     && printf '%s' "$command" | grep -qE "$PROT"; then
    violations+=("Bash deletes/moves a PROTECTED path (the / editor / page.tsx / keyframe / walkthrough / engine). Blocked even under bypassPermissions.")
  fi
  if printf '%s' "$command" | grep -qE 'git[[:space:]]+(checkout|restore|reset)[^|&;]*--[^|&;]*\b(hard|force)\b' \
     && printf '%s' "$command" | grep -qE "$PROT"; then
    violations+=("Bash hard-reset/restore would discard changes on a PROTECTED path. Confirm with the founder first.")
  fi
fi

# Write that EMPTIES a protected source file (a stealth deletion).
if { [ "$tool" = "Write" ] || [ "$tool" = "Edit" ]; } && [ -n "$file_path" ]; then
  if printf '%s' "$file_path" | grep -qE "$PROT"; then
    # A Write whose new content is empty / a single-line stub on a protected file.
    if [ "$tool" = "Write" ] && [ "$(printf '%s' "$content" | tr -d '[:space:]' | wc -c | tr -d ' ')" -lt 20 ]; then
      violations+=("Write would EMPTY/stub a PROTECTED file ($file_path). Looks like a stealth deletion.")
    fi
  fi
fi

if [ ${#violations[@]} -gt 0 ] && [ $override -eq 0 ]; then
  {
    echo "⛔ DESTRUCTIVE-ACTION GUARD blocked this $tool"
    for v in "${violations[@]}"; do echo " • $v"; done
    echo ""
    echo "PROTECTED (.claude/INTENT-LOCK.md): the / editor (src/components/editor), page.tsx,"
    echo "the keyframe editor, the walkthrough/tutorial, and the engine (src/lib/prism)."
    echo "If the FOUNDER explicitly authorized this, include a FOUNDER-OVERRIDE marker in the"
    echo "command/payload (founder-authored only). Otherwise STOP and ask."
  } >&2
  exit 2
fi
exit 0
