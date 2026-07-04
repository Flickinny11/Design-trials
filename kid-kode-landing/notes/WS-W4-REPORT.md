# PRISM WS-W4 Report — Galaxy Semantics And Navigation

PRISM-WS-W4: RUN COMPLETE — verify-and-finish (no rebuild).

## Posture

W-4 is cleanup + verification of the existing graph-backed Galaxy model, NOT a
new directory architecture. Authorization state confirmed before any action:

- `CHAIN-STOP` released by the founder (moved to
  `_QUARANTINE_DRIFT/CHAIN-STOP.released-2026-06-30.md`; "keep the Prism recovery
  work moving").
- `spec-intent-check.mjs` PASS for `PRISM-WS-W4-PROMPT.md` + guarded spec.
- `prism-autonomy-preflight.mjs` PASS (repo-root, chain-stop, guard-files,
  real-editor-root, spec-intent, remote-assets, galaxy-semantics 5/5,
  global-shell 6/6, rejected-toolbar not wired).

No source under `src/components/editor/**` was changed. The `/` route stays on the
real 300+ file editor. Galaxy / Canvas / Preview remain the three runtime views.
Preview stays camera-locked and non-authoring.

## What the build slice needed vs. what already existed

The Galaxy directory semantics + global-shell resolver were already implemented
(during the recovery-harness / W-3 era). The only open item was the global-slot
promotion's **durability + verification**:

- The 10 truly-shared chrome nodes were flagged `globalSlot: header|footer` in the
  working tree but **uncommitted** (HEAD had 0). This W-4 commit makes that
  promotion durable.
- `promote-global-shell-slots.mjs` (dry-run) reports `promoted: []` — nothing
  else is safely promotable. The remaining 30 duplicate-chrome signatures each
  carry 2–6 per-page render variants (active-nav rules, Atelier-shifted nav/
  footer, per-page CTA labels), so the conservative promoter correctly leaves
  them page-local. Promoting them would override genuine per-page differences.
- `galaxy:global-hub-missing` remains a **non-blocking WARN** (keyed only on the
  absence of a `hubId === 'global'` hub). Creating a dedicated `global` hub is a
  larger architectural move than this verify-don't-rebuild slice warrants, and the
  verifier itself labels it "a planned cleanup, not a runtime blocker." Deferred,
  documented — not forced.

## The only file changed

`public/prism-mock/home/live-graph.json` — 10 additive `globalSlot: header|footer`
flags on shared chrome (footer bar/brand/legal + nav/footer hit-targets). No node
deletions, no structural rewrite. Reversible by removing the flags.

## Verification (evidence, not assertion)

Static / unit:

- `spec-intent-check.mjs`: PASS (prompt + guarded spec).
- `verify-galaxy-semantics.mjs`: 5/5 PASS (1 documented non-blocking WARN).
  - 6 hubs, 327 nodes; 148 overview (content), 179 collapsed (107 app-shell,
    72 hit-target); ambient-background = 0 first-class nodes; 6/6 hubs carry
    `background[]`; each hub has overview content (7/9/32/9/18/73).
- `verify-global-shell-semantics.mjs`: 6/6 PASS (10 globalSlot nodes; resolver
  contract + root-wired to `resolveAssembledNodesForHub`; not editor-shell).
- `npm run typecheck:gate`: PASS — 9 tsc errors, baseline 10, **0 new**.
- `npm run prism:recovery-gate -- http://localhost:3001`: **exit 0**.
  - `verify` PASS · `typecheck` PASS · `focused-vitest` PASS (20/20:
    galaxy-semantics 4, global-slots 4, atelier-reason 3, vertical-glass-toolbar 5,
    WS-W3 node-agent 4) · `node-authorship` PASS (9/9, 0 hard-fail; 158
    node-authored artifacts all in graph; zero accidental drift; no uncaught
    page errors).

Live browser (real Chrome / hardware GPU, `http://localhost:3001`, Chrome
DevTools MCP) — the 6 required proofs. Screenshots under
`notes/verification/ws-w4/`:

1. **Galaxy loads with page hubs + meaningful node counts.** `01`/`02`. Galaxy
   renders 6 hub planets + 148 projected content nodes (not the raw 327). The
   bottom hub-nav shows human-readable per-hub counts (Arrival 7 · Movement 9 ·
   Materia 32 · Celestia 9 · Acquire 18 · Atelier 73 = 148); minimap reads
   "148 NODES". `__PRISM_GALAXY_SEMANTICS__` = { total 327, overview 148,
   collapsed 179 }.
2. **Hub background layers are not noisy Galaxy nodes.** byRole
   `ambient-background: 0`, `global-overlay: 0`; galaxy projects only the 148
   meaningful content nodes. Stars/dust/nebula stay hub-owned `background[]`.
3. **Selecting a hub/node opens the correct Canvas/node-editor context.**
   `drillIntoHub('s3-materia')` → viewMode `canvas`, activeHubId `s3-materia`;
   `selectNode(...)` → `inspectorOpen: true` with the root Inspector
   (VISUAL/MATERIAL/BEHAVIOR/FUNCTIONS/INTEGRATIONS tabs + W-3 Node Agent).
   Graph stayed clean (`isDirty: false`). `04`.
4. **Canvas mounts the root editor + toolbar.** `03`. `liquid-toolbar-canvas`
   present (approved LiquidGlassToolbar glass cubes — the rejected magenta
   vertical rewrite is NOT wired); Transform gizmo panel, keyframe REC/Journey
   controls, camera guardrail readout, minimap "327 NODES" (full editable graph
   vs galaxy's 148 overview).
5. **Preview runs the watch mock app.** `01`. Boot default is `preview-app`:
   "Time, machined." hero, ORRERY No.7 3D watch, full nav + footer, Reserve CTA.
6. **No fresh console/page errors.** 21 console messages, all `[warn]`, zero
   `[error]` — every warning is a pre-existing Three.js deprecation
   (`THREE.Clock`, `PCFSoftShadowMap`) or benign shader-attribute/webpack notice.
   Node-authorship gate `runtime.no-pageerrors`: clean.

Bonus runtime proof — global-slot duplicate suppression fires: on the
non-canonical hub s2-movement, `__PRISM_ASSEMBLED_NODE_SCOPE__()` renders 39 =
29 hub-local + 10 global-slot chrome, with **10 duplicate chrome twins hidden**
(`shell-2_movement-footer-bar`, `-nav-arrival-navhit`, …). The promotion is not
just authored data — the resolver actually renders shared chrome once and
suppresses the per-page duplicates.

## Non-negotiable routing — all held

- Root editor path untouched; `src/app/page.tsx` still mounts the root editor.
- Watch mock app runs from Prism runtime graph/artifact data.
- Galaxy / Canvas / Preview intact; Preview camera-locked, non-authoring.
- Canvas + node editor remain the editing surfaces.
- No quarantined / rejected toolbar wired; no toolbar buttons, keyframe behavior,
  guided tips, or root-editor actions dropped.
