# PRISM WS-W4 — Galaxy Semantics And Navigation Prompt — 2026-06-30

Read before acting:

1. `HANDOFF-2026-06-29.md`
2. `CODEX-RECOVERY-HANDOFF-2026-06-30.md`
3. `_DRIFT-CONTAMINATION-NOTICE.md`
4. `kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md`
5. `.claude/INTENT-LOCK.md`

## Mission

Finish and verify Galaxy as the graph-backed app directory in the root Prism
editor. This is cleanup and verification of the existing model, not a new
directory architecture.

## Non-Negotiable Routing

- Work in the root editor path: `kid-kode-landing/src/components/editor/**`.
- Keep `kid-kode-landing/src/app/page.tsx` on the root editor implementation.
- Keep the watch mock app running from Prism runtime graph/artifact data.
- Keep Galaxy, Canvas, and Preview as the three runtime views.
- Keep Preview camera-locked and non-authoring.
- Keep Canvas and the node editor as the editing surfaces.
- Do not wire quarantined toolbar code or rejected replacement toolbar work.
- Do not drop toolbar buttons, keyframe behavior, guided tips, or existing root
  editor actions.

## Build Slice

Implement the smallest root-editor path that proves Galaxy is understandable as
the app directory:

- Hubs continue to represent pages.
- Nodes continue to represent user-meaningful app elements or graph-backed
  capabilities.
- Overview counts hide implementation helpers, hit targets, repeated shell
  details, and background ambience internals.
- Background stars, dust, nebula, lighting, and ambience stay hub/runtime data
  unless explicitly selected as an editable background element.
- Remaining repeated every-page app chrome is promoted into global graph slots
  only when that promotion is graph-authored, reversible, and verified.
- Selecting a Galaxy hub or node moves the user to the correct Canvas/node-editor
  context without making Preview an authoring surface.
- Search/filter/navigation should operate over meaningful hubs and nodes.

Visual polish is allowed only when it is graph/runtime-safe and does not change
the above semantics.

## Verification

Run and report:

- `node kid-kode-landing/scripts/spec-intent-check.mjs PRISM-WS-W4-PROMPT.md kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md`
- `npm run typecheck:gate`
- focused tests for Galaxy semantics and global shell behavior
- live browser check on `http://localhost:3001` proving:
  - Galaxy loads with page hubs and meaningful node counts
  - hub background layers do not appear as noisy Galaxy nodes
  - selecting a hub/node opens the correct Canvas/node-editor context
  - Canvas still mounts the root editor and toolbar
  - Preview still runs the watch mock app
  - no fresh console/page errors
- `npm run prism:recovery-gate -- http://localhost:3001`

If any gate fails, stop and record the exact blocker. Do not continue by
assertion.
