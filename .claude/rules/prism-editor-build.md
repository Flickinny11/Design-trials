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

---

## Round 2 (v1.1) — preview-app assembly + canvas editing + clone

Round 1 (53 tasks) shipped. Round 2 (~24 tasks across 7 groups A–G) is armed against spec
v1.1. Same branch, same `/ralph-step-editor` worker, same drift hooks — additive
amendments only.

**Canonical view modes (RA-06b, INV-24):** exactly `galaxy | canvas | preview-app`. **Default
on app boot: `preview-app`** (RA-17). `hub-world` and `preview-hub` are superseded — never
introduce those literals (FP-14 blocks them at write time).

**Canvas mode (RA-06b, INV-25, SC-068..SC-071):**
- Select a node → click **Edit** in Inspector → handles render. Without Edit toggle on, no
  handles. (`editorMode: 'idle' | 'edit'` on `useGraphEditorStore`.)
- Drag handles to translate/rotate/scale — the rendered artifact visibly moves in real-time.
  `AssembledSceneNode` composes `scenePosition + canvasTransform` for the rendered group,
  selection ring, and gizmo anchor.
- Camera has heavy guardrails: bounded distance / polar / azimuth / pan-target around the
  active hub. Cannot drift past viewport-frame envelope.

**Galaxy mode:** unconstrained navigation. The only mode where the camera is truly free.

**Save vs Save-and-Rebuild (RA-16, INV-26, SC-072..SC-074):**
- Inspector tab fader/knob writes route through `usePreviewStateStore` (FP-15 enforces this).
  The renderer reads source ⊕ preview overlay → visual change is real-time.
- **Save** copies preview-state → source store via `updateNode`; debounced autosave then
  flushes to server. Preview-state buffer clears.
- **Save and Rebuild** = Save + locate the mounted `THREE.Object3D` for that node, call
  `userData.cleanup()`, re-invoke `createNode(config, ctx)`, re-mount at the same
  `scenePosition`. **Other nodes' `THREE.Object3D` references stay stable** (reference
  identity verified). No full `.prism` artifact build, no codegen, no AI-builder pipeline.

**Clone + auto-snap (SC-075..SC-077):**
- Inspector "Clone" → source-store gains a deep clone (new id, suffixed caption); view auto-
  switches to galaxy; clone attaches to `draggingNodeId` slot.
- Galaxy-mode drag listener computes nearest-hub via `hub-geometry.findNearestHub` and
  renders a transient tether line.
- Pointer-up commits `parentHubId` to nearest hub; caption/subtype auto-update.

**Verification (RA-18, SC-078/SC-079, Round 2.5):** Every Ralph task gets two verification
surfaces:

- **PRIMARY — KripVerify-local (blocking).** Worker invokes `kv_dev_server_status` →
  `kv_navigate(localUrl)` → `kv_wait_for(canvas)` → `kv_screenshot(full_page=true)` →
  `kv_check_console(level='error')` → `kv_check_network(status_min=400)` plus any
  task-specific interactive checks (`kv_click`, `kv_type`, `kv_evaluate`). Runs against
  the local sandboxed `next dev` server kripverify manages. Failing KripVerify = task
  failure (same blocking semantics as the local Playwright snapshot). Artifacts:
  `notes/ralph-snapshots/<task-id>/kripverify.{png,json}`.
- **SECONDARY — Vercel observability (non-blocking).** After Step 13 push,
  `wait-for-vercel-preview.mjs` polls Vercel's REST API for the deploy state;
  `fetch-vercel-logs.mjs` pulls build + runtime logs. These are captured into
  `notes/ralph-snapshots/<task-id>/vercel-{preview,logs}.{json,txt}` for diagnostics. A
  Vercel failure does NOT block a task that passed KripVerify-local — the loop keeps
  moving and the operator/monitor session can surface real anomalies.

**Hook updates active in Round 2:**
- **FP-12** (regex updated): rejects 5-mode legacy + Round-0 legacy. Only 3 modes legal.
- **FP-14** (new): direct `'hub-world'`/`'preview-hub'` literal anywhere under src/.
- **FP-15** (new): Inspector tab files cannot call `useGraphSourceStore.getState().updateNode`.
