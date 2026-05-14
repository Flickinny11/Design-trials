# Prism Editor Build — additive override rules

Active while `.prism-editor-build-active` markers exist at repo root or
`kid-kode-landing/`. These rules **add to** (do not replace) the rules in
`kid-kode-landing/CLAUDE.md`, the active renderer-migration rules in
`.claude/rules/prism-renderer-migration.md`, and the inner-spec invariants encoded in
`kid-kode-landing/.claude/hooks/anti-drift-check.sh`.

The canonical source for invariants, success criteria, and forbidden patterns is
`kid-kode-landing/docs/prism/PRISM-EDITOR-BUILD-SPEC.md`. **Read it before implementing any
editor-build task.** Anything below is a pointer or operator-discipline note, not a
re-derivation.

When the editor build completes (all tasks `done` in `kid-kode-landing/notes/ralph-state.json`),
the marker files are removed and these rules become inert.

## Pointers

- **Spec:** `kid-kode-landing/docs/prism/PRISM-EDITOR-BUILD-SPEC.md` — 12 sections, 63 SC, 23
  INV, 13 FP, 15 RA.
- **Gap analysis:** `kid-kode-landing/notes/editor-build-gap-analysis.md` — what Codex shipped,
  what's missing, schema delta.
- **Ralph state:** `kid-kode-landing/notes/ralph-state.json` — schema v1.1; ~40-55 tasks across
  10 phases.
- **Loop driver:** `kid-kode-landing/scripts/ralph.sh` (invokes `/ralph-step-editor`).
- **Per-step worker:** `.claude/commands/ralph-step-editor.md`.
- **Kickoff (monitor):** `.claude/commands/kickoff-prism-editor.md`.

## Branch + state

- Active branch: **`prism-editor-build`** (push every iteration).
- Ralph state file: `kid-kode-landing/notes/ralph-state.json`, schema v1.1 (see
  `notes/ralph-harness-v1.1.md`).
- Model contract: `.claude/.ralph-model` (Opus-only; enforced by `scripts/ralph.sh`).

## Two-runtime discipline

Every Ralph task verifies **both** runtimes:

1. **Outer** — Next.js editor at `kid-kode-landing/src/app/**`.
2. **Inner** — Prism player at `kid-kode-landing/src/lib/prism/runtime/**` +
   `kid-kode-landing/src/components/prism-player/**`.

The two-runtime snapshot is captured by `kid-kode-landing/scripts/verify-editor-runtimes.mjs`
and writes to `kid-kode-landing/notes/ralph-snapshots/<task-id>/`. **A failing screenshot is a
task failure, never a warning.**

## Schema (additive only — INV-18)

Existing fields on `PrismNode`, `PrismHub`, and `GraphSource` MUST NOT be deleted or renamed.
New fields are optional. The editor-build adds:

| Type | New field |
|---|---|
| `PrismNode` | `editorTransform?`, `canvasTransform?`, `compiledTransform?`, `uiAnchor?`, `scrollBinding?`, `depthLayer?`, `keyframes?`, `capabilityRefs?` |
| `PrismHub` | `background?: PrismHubBackgroundLayer[]` (legacy `layout.mockupUrl` retained) |
| `GraphSource` | exactly one `PrismRootNode` (App_Name_World; see RA-07 in spec) |

Read the spec §3 (core model) and the gap-analysis §3 (schema delta) before adding any field.

## Non-destructive compile (INV-17)

Functions matching `compile*|organize*|previewHub*|previewApp*` MUST NOT write to
`scenePosition`, `editorTransform`, `canvasTransform`, `compiledTransform`, or any `hub.layout`
field. Hook FP-04 enforces this. Preview Hub and Preview App are *compiles*, not destructive
re-organizations of the source graph.

## Secrets discipline (INV-19)

- Raw secret values NEVER appear in graph data, in any file under `kid-kode-landing/src/lib/**`,
  in any file under `kid-kode-landing/src/components/**`, or in the client bundle.
- The graph holds **capability references** only.
- Resolution happens in `kid-kode-landing/src/server/secrets/**` (or via `server-only` imports)
  with audit logging.
- FP-06 and FP-07 enforce this; the editor-build hook scope grep verifies it.

## Keyframe coordinate space (INV-21, per D3)

Every `PrismKeyframe` declares `coordinateSpace ∈ { 'universe', 'hub-scene',
'viewport-composition', 'scroll-timeline', 'camera' }`. The set is fixed (RA-03). No
space-agnostic keyframe is permitted.

## View modes (RA-06)

The canonical 5: `'galaxy' | 'hub-world' | 'canvas' | 'preview-hub' | 'preview-app'`.

`useGraphEditorStore.ViewMode` is refactored to this set in Phase 1. The current
`'preview' | 'editor' | 'split'` toggle maps as:

| Current | Canonical |
|---|---|
| `editor` | `hub-world` (default) |
| `split` | `canvas` (replaces split pane) |
| `preview` | `preview-hub` |
| (new) | `galaxy` |
| (new) | `preview-app` |

`editorRenderMode = 'scene' | 'topology'` is preserved as a sub-toggle within `hub-world`. FP-12
blocks any new viewMode string outside the canonical 5.

## Ralph discipline (editor build)

- One task per session. `/ralph-step-editor` exits after step 14. Do not pick up a second task.
- **STEP 1 of every iteration: audit current code AND the spec for this task's slice before
  implementing.** Read the gap-analysis file; re-read the task's `specRefs`; grep the touched
  code paths. If the audit shows the `haltCheck` already passes, mark the task complete with a
  `notes` field explaining why and skip to step 11.
- TDD where `task.tddRequired === true`: failing test committed before implementation; tests
  not edited during implementation.
- Every iteration ends with `spec-reviewer` on HEAD. MUST-FIX blocks the commit.
- Every iteration runs the two-runtime snapshot and commits a snapshot directory to
  `kid-kode-landing/notes/ralph-snapshots/<task-id>/`.
- Every iteration appends one line to a progress log
  (`kid-kode-landing/notes/prism-editor-progress.md`).
- Every iteration ends with `git push origin prism-editor-build`.

## Coexistence with renderer-migration rules

`kid-kode-landing/.ralph-migration-active` is still present and the renderer-migration rule
file (`.claude/rules/prism-renderer-migration.md`) is still active. Both rule sets compose:
the renderer-migration invariants (TSL only, no PixiJS, MSDF text, synchronous createNode, no
DOM) remain binding throughout the editor build (preserved as INV-11..INV-15 in the editor
spec). When both markers are present, both sets of hooks fire.

## Out of scope

The AI app-builder pipeline, coding-model routing, parallel code generation, self-healing /
node-repair, image / 3D asset generation pipelines, and the backend template engine are out of
scope for this loop. The secrets vault IS in scope (Phase 2). Structural seams for out-of-scope
systems may be added **only if** they are real, typed, used, and necessary — never as
placeholders.
