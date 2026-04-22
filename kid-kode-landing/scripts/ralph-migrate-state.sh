#!/usr/bin/env bash
# One-shot, idempotent migration from ralph-state.json schemaVersion 1.0 → 1.1.
#
# Adds (additive only — never destroys existing fields):
#   - schemaVersion: "1.1"
#   - maxIterations: 500  (was 50)
#   - maxIterationsPerPhase: 50
#   - convergence: { stagnantStreak, stagnantThreshold=5, lastProductiveIteration, lastProductiveCommit }
#   - phaseCaps: { "§N": {used, cap, status} }  — backfilled from history
#   - checkpoint: { iteration, commit, verifiedAt, artifactHash, recordedAt }
#   - resumeFrom: null
#   - breakpoints: []
#
# Safe to run while the Ralph loop is active — /ralph-step's step 11 re-reads
# state.json before updating, so the fields we add will survive. The migration
# writes atomically via mktemp + mv.
#
# Usage:
#   ./scripts/ralph-migrate-state.sh
#   ./scripts/ralph-migrate-state.sh --dry    # print the migrated state; don't overwrite

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
KIDDIR="$REPO_ROOT/kid-kode-landing"
STATE="$KIDDIR/notes/ralph-state.json"

command -v jq >/dev/null 2>&1 || { echo "migrate: jq required" >&2; exit 1; }
[[ -f "$STATE" ]] || { echo "migrate: $STATE missing" >&2; exit 1; }

DRY=0
case "${1:-}" in
  --dry) DRY=1 ;;
  "")    ;;
  *)     echo "migrate: unknown arg: $1" >&2; exit 1 ;;
esac

iso_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# Backfill phaseCaps counts from history[]. For each history entry, look up the
# task, extract its first specRef's major section (e.g. §10.14 → §10), and count.
PHASE_BACKFILL=$(jq '
  [ .history[] as $h
    | ((.tasks[] | select(.id == $h.taskId) | .specRefs[0])? // null) as $ref
    | (if ($ref // "") | test("§[0-9]+") then
         ($ref | capture("§(?<m>[0-9]+)")) | "§\(.m)"
       else null end)
  ]
  | map(select(. != null))
  | reduce .[] as $p ({}; .[$p] = ((.[$p] // 0) + 1))
  | to_entries
  | map({ key: .key, value: { used: .value, cap: 50, status: "active" } })
  | from_entries
' "$STATE")

MIGRATED=$(jq \
  --argjson phasecaps "$PHASE_BACKFILL" \
  --arg now "$(iso_now)" \
  '
  # Additive: only set fields if missing OR known to be stale.
    .schemaVersion = "1.1"
  | .maxIterations = (if (.maxIterations // 0) < 500 then 500 else .maxIterations end)
  | .maxIterationsPerPhase = (.maxIterationsPerPhase // 50)
  | .convergence = (.convergence // {
      stagnantStreak: 0,
      stagnantThreshold: 5,
      lastProductiveIteration: (if (.history | length) > 0 then (.history | last | .iteration) else 0 end),
      lastProductiveCommit: (if (.history | length) > 0 then (.history | last | .commit) else null end)
    })
  # Merge backfilled counts into existing phaseCaps without clobbering operator overrides.
  | .phaseCaps = (
      ($phasecaps // {}) as $bf
      | ((.phaseCaps // {}) as $cur
      | reduce ($bf | keys_unsorted[]) as $k ($cur;
          .[$k] = (
            (.[$k] // {}) as $existing
            | {
                used:   (if ($existing.used   // null) == null then $bf[$k].used else $existing.used end),
                cap:    ($existing.cap  // $bf[$k].cap  // 50),
                status: ($existing.status // $bf[$k].status // "active")
              }
          )
        ))
    )
  | .checkpoint = (.checkpoint // {
      iteration: (if (.history | length) > 0 then (.history | last | .iteration) else 0 end),
      commit:    (if (.history | length) > 0 then (.history | last | .commit) else null end),
      verifiedAt:(if (.history | length) > 0 then (.history | last | .verifiedAt) else null end),
      artifactHash: (.invariants.lastArtifactHash // null),
      recordedAt: $now
    })
  | .resumeFrom  = (.resumeFrom  // null)
  | .breakpoints = (.breakpoints // [])
  | .updatedAt   = $now
  ' "$STATE")

if (( DRY )); then
  echo "$MIGRATED"
  exit 0
fi

TMP="$(mktemp "$STATE.migrate.XXXXXX")"
echo "$MIGRATED" > "$TMP"
mv "$TMP" "$STATE"
echo "migrate: $STATE → schemaVersion 1.1"
