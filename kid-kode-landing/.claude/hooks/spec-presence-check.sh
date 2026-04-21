#!/usr/bin/env bash
# SessionStart hook — announce spec location + invariants reminder.
# Runs at the start of every session; zero cost if docs present.

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
spec="$repo_root/docs/prism/PRISM-MOCK-APP-BUILD-SPEC.md"
engine="$repo_root/docs/prism/PRISM-ENGINE-SPEC-V3.md"
extract="$repo_root/notes/prism-spec-extract.md"
progress="$repo_root/notes/prism-mock-progress.md"

missing=()
for f in "$spec" "$engine"; do [ -f "$f" ] || missing+=("$f"); done

if [ ${#missing[@]} -gt 0 ]; then
  printf 'PRISM SPEC MISSING:\n' >&2
  for m in "${missing[@]}"; do printf '  - %s\n' "$m" >&2; done
  printf 'Drift-risk: specs not at expected locations. Restore before proceeding.\n' >&2
  exit 1
fi

cat >&2 <<EOF
[prism] Mock-app build context loaded:
  spec:     ${spec#$repo_root/}
  engine:   ${engine#$repo_root/}
  extract:  $([ -f "$extract" ] && echo "${extract#$repo_root/}" || echo "(not yet generated — spawn Explore agent if needed)")
  progress: $([ -f "$progress" ] && echo "${progress#$repo_root/}" || echo "(not yet created — Phase 1+)")

11 invariants & §1.4 forbidden patterns: .claude/skills/prism-architecture/SKILL.md
Three animation methods: .claude/skills/prism-pixijs/SKILL.md
Anti-drift check: .claude/hooks/anti-drift-check.sh (PreToolUse on Write/Edit)
EOF

exit 0
