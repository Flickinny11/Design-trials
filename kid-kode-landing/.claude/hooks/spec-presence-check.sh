#!/usr/bin/env bash
# SessionStart hook — announce spec location + invariants reminder.
# Runs at the start of every session; zero cost if docs present.

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
spec="$repo_root/docs/prism/PRISM-MOCK-APP-BUILD-SPEC.md"
engine="$repo_root/docs/prism/PRISM-ENGINE-SPEC-V3.md"
extract="$repo_root/notes/prism-spec-extract.md"
progress="$repo_root/notes/prism-mock-progress.md"

handoff="$repo_root/notes/session-handoff-2026-04-24.md"
kickoff="$repo_root/notes/ralph-kickoff-v2.md"
input_img_root="$repo_root/Gemini_Generated_Image_2w5g832w5g832w5g.png"
input_img_moved="$repo_root/notes/mockup-candidates/ai-video-mockup.png"
env_local="$repo_root/.env.local"

missing=()
for f in "$spec" "$engine"; do [ -f "$f" ] || missing+=("$f"); done

# Phase G additions (non-fatal warnings if absent)
phase_g_warn=()
[ -f "$handoff" ] || phase_g_warn+=("session-handoff-2026-04-24.md (architecture + don't-repeat-these-mistakes doc)")
[ -f "$kickoff" ] || phase_g_warn+=("ralph-kickoff-v2.md (the kickoff phrase doc)")
if [ ! -f "$input_img_root" ] && [ ! -f "$input_img_moved" ]; then
  phase_g_warn+=("Gemini_Generated_Image_2w5g832w5g832w5g.png (input mockup for T-SWAP-01)")
fi
if [ -f "$env_local" ] && ! grep -q '^FAL_KEY=' "$env_local"; then
  phase_g_warn+=(".env.local present but FAL_KEY= not set")
fi

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

if [ ${#phase_g_warn[@]} -gt 0 ]; then
  printf '\n[prism] Phase G setup warnings (non-fatal):\n' >&2
  for w in "${phase_g_warn[@]}"; do printf '  - %s\n' "$w" >&2; done
fi

exit 0
