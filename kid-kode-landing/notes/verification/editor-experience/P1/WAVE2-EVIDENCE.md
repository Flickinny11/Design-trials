# P1 Wave 2 — preview-app BUILT-freeze — VERIFIED

**Change:** `src/components/editor/graph/GraphScene.tsx` `AssembledSceneNode` —
`composedNode` is now mode-aware: **canvas** authors live (`composeNodeWithPreview`
source⊕overlay ghost); **preview-app** renders a `builtNode` snapshot captured
synchronously (derive-during-render, ref-compare on `buildKey`) at each explicit Build.
A staged or Saved-but-unbuilt edit cannot change preview-app until Build re-realizes
the node. Two surgical edits; canvas path byte-identical (so SC-069 ct-writes, gizmo
ghost, in-place setSpec all unchanged). Closes C5/C8 core + NE-SC-13 (preview faithful).

## The C5 advocate proof (functional layer — `__PRISM_EDITOR_NODE_GROUPS__` local X, deterministic)

Target: `orr-arrival-watch` (the "watch", scenePosition.x=0 baseline). Move staged via the
preview overlay (no source write → no autosave pollution).

| Step | viewMode | source.x | overlay dirty | rendered group.x | verdict |
|---|---|---|---|---|---|
| 1 stage +3 move | canvas | **0** | true | **3** | canvas shows live ghost ✓ |
| 2 toggle preview | preview-app | 0 | true | **0** | **FROZEN at built — staged edit does NOT leak ✓** |
| 3 Build (commit+bump rebuildVersion) | preview-app | 3 | false | **3** | Build re-realizes → now moves ✓ |
| 4 restore | preview-app | 0 | false | 0 | clean ✓ |

Exactly the C5 spec proof: *edit watch position → does NOT move in Preview → [Save] →
still doesn't → Build → NOW it moves.*

**Frames:** `c5-1-canvas-overlay-move.png` (watch at x=3 in canvas),
`c5-2-preview-frozen.png` (watch frozen at built x=0 in preview while overlay dirty),
`c5-3-preview-after-build.png` (watch at x=3 after Build).

## No-regression (C44) — all 3 modes render post-change
- `noregress-preview-app.png` — "Time, machined." headline + 3D watch + hub nav + world badge. Clean.
- `noregress-canvas.png` — full editor chrome, toolbar dock, Transform flyout, selection box, watch.
- `noregress-galaxy.png` — orrery galaxy (sun, orbital rings, hub planets, tethers, minimap).

## Gates
- tsc: **10 total (0-new)** — GraphScene's only error is the pre-existing GLProps; no new errors.
- Console errors: **0** (`list_console_messages` type=error → none).
- `live-graph.json`: restored to committed (test autosave reverted via `git checkout`).
- Clean-demo identity: with no staged edits, `builtNode === source`, so preview rendering is
  identical to pre-change — the freeze only diverges from old behavior when an edit is staged.

## Confirmed in passing (folded unmet-criteria)
- **RT-SC-11** (default boot preview-app): boot routed to `#hub=s1-arrival`, preview-app default. ✓
- **RT-SC-10/RT-SC-03** (single unified scene): page mounts only GraphScene; mode is a state. ✓
- Note: a fresh boot read `viewMode='galaxy'` once mid-transition — confirm RT-SC-11 boot-default
  steady-state separately (store default is preview-app; not blocking Wave 2).

## Remaining in P1 (next waves)
- Wave 1: route orphan-store edits (Visual color, Anim faders) through `usePreviewStateStore` (C8-A);
  wire Discard (C6); pending-count + minimap dirty marker (C2).
- Wave 3: retire VisualPreview regen-api 2nd path (NE-SC-14); inspector staged-validation (C7).
