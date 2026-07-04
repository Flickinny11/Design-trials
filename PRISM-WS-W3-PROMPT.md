# PRISM WS-W3 — Root Editor Unified Agent Prompt — 2026-06-30

Read before acting:

1. `HANDOFF-2026-06-29.md`
2. `CODEX-RECOVERY-HANDOFF-2026-06-30.md`
3. `_DRIFT-CONTAMINATION-NOTICE.md`
4. `kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md`
5. `.claude/INTENT-LOCK.md`

## Mission

Build the first verification-gated slice of the unified per-node agent in the
root Prism editor. The slice should prove the architecture without replacing the
editor or bypassing the runtime.

## Non-Negotiable Routing

- Work in the root editor path: `kid-kode-landing/src/components/editor/**`.
- Keep `kid-kode-landing/src/app/page.tsx` on the root editor implementation.
- Keep the watch mock app running from Prism runtime graph/artifact data.
- Keep Galaxy, Canvas, and Preview as the three runtime views.
- Keep Preview camera-locked and non-authoring.
- Keep Canvas and the node editor as the editing surfaces.
- Do not wire quarantined toolbar code or `src/components/editor/glass-toolbar`.
- Do not remove toolbar buttons, keyframe behavior, tutorial/guided tips, or
  existing CanvasToolbar actions.

## Build Slice

Implement the smallest root-editor path that proves prompt-edit and self-heal
share one validated-plan engine:

- A selected node can open an agent panel or agent entry from Canvas/node-editor.
- The panel can accept a user instruction scoped to that node.
- The agent produces a typed validated plan, not raw runtime code.
- The initial plan operations may be mocked/local if live providers are not yet
  configured, but the operation types must match real editor operations.
- The plan can be accepted or rejected.
- Accepting applies one safe graph-backed node change and records undo metadata.
- The same plan executor can be invoked by a synthetic telemetry/self-heal event.
- The implementation must be surgical: only the selected node or explicit
  selected set changes.

## Verification

Run and report:

- `node kid-kode-landing/scripts/spec-intent-check.mjs PRISM-WS-W3-PROMPT.md kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md`
- `npm run typecheck:gate`
- focused tests for the new agent/plan executor path
- live browser check on `http://localhost:3001` proving:
  - Galaxy still loads with semantic hub/node counts
  - Canvas still mounts the root editor and toolbar
  - Preview still runs the watch mock app
  - the selected-node agent flow applies and undoes one safe graph-backed edit
  - no fresh console/page errors
- `npm run prism:recovery-gate -- http://localhost:3001`

If any gate fails, stop and record the exact blocker. Do not continue by
assertion.
