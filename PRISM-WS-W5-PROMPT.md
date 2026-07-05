# PRISM WS-W5 — Whole Workspace Verification Prompt — 2026-06-30

Read before acting:

1. `HANDOFF-2026-06-29.md`
2. `CODEX-RECOVERY-HANDOFF-2026-06-30.md`
3. `_DRIFT-CONTAMINATION-NOTICE.md`
4. `kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md`
5. `.claude/INTENT-LOCK.md`

## Mission

Run the whole-workspace verification and close remaining parity gaps inside the
root Prism editor while preserving the existing editor and Prism runtime.

## Non-Negotiable Routing

- Work in the root editor path: `kid-kode-landing/src/components/editor/**`.
- Keep `kid-kode-landing/src/app/page.tsx` on the root editor implementation.
- Keep the watch mock app running from Prism runtime graph/artifact data.
- Keep Galaxy, Canvas, and Preview as the three runtime views.
- Keep Preview camera-locked and non-authoring.
- Keep Canvas and the node editor as the editing surfaces.
- Do not wire quarantined toolbar code or rejected replacement toolbar work.
- Preserve toolbar buttons, keyframe behavior, guided tips, inspector, library,
  search, history/undo, and existing root editor actions.

## Build Slice

This phase is verification-first. Only fill small parity gaps discovered by the
checks, and keep changes narrowly scoped:

- Verify every major root editor control still works.
- Verify Canvas and node-editor state stay synchronized.
- Verify save/reload round-trips graph-backed edits.
- Verify the workspace can load another Prism graph without hardcoding the watch
  app.
- Verify function, integration, data, animation, and visual edits remain
  additive graph-backed node state.
- Verify offline/reference provider paths work when live provider keys are not
  supplied.
- Document required environment keys for future live providers without blocking
  offline verification.

Do not launch broad architecture rewrites from this phase.

## Verification

Run and report:

- `node kid-kode-landing/scripts/spec-intent-check.mjs PRISM-WS-W5-PROMPT.md kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md`
- `npm run typecheck:gate`
- focused tests for any parity gap touched
- live browser check on `http://localhost:3001` proving:
  - Galaxy navigation works
  - Canvas edits one graph-backed node surgically
  - node-editor changes sync with Canvas
  - Preview still runs the watch mock app
  - save/reload preserves the edit
  - another Prism graph can be loaded or simulated through the graph-source path
  - no fresh console/page errors
- secret-leak grep for raw tokens/keys in changed files and runtime graph data
- `npm run prism:recovery-gate -- http://localhost:3001`

If any gate fails, stop and record the exact blocker. Do not continue by
assertion.
