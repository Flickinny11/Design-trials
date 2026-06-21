# PRISM BUILD STATE — paused for total UI redesign
_Last updated: 2026-06-18 (editor-experience loop stopped by orchestrator at Logan's direction)_

## Why paused
The editor-experience build loop kept re-skinning the brass/gold "chrome-layer" slab
aesthetic on every "redesign" pass instead of replacing it. Logan called a full stop and
a TOTAL UI redesign, driven by the local **OpenDesign** app (`/Users/loganbaird/OpenDesign`).
Functional work is preserved; only the visual layer is demolished.

## Git state at stop
- Branch: `prism-editor-build`
- HEAD: `1c5fdb93` (P6: 3D background authoring)
- Recent: 1c5fdb93 P6 (3D backgrounds) · 4534e23b P5 (text authoring UX) · 57d21b41 P7 (undo/redo, zundo+immer)
- Dev server left running on :3000.

## COMMITTED + FUNCTIONAL — KEEP THE LOGIC (re-skin only, do NOT revert)
Real functional wins. The redesign strips their ugly visual skin, NOT their logic:
- P0 architecture; P1 persistence/build correctness
- P2 persistence/build correctness incl. C9 Inspector<->Canvas decouple (commit 54e91842)
- P3 identity surfaces (visual styling CONDEMNED; structure may carry)
- P5 text authoring UX
- P6 3D background authoring (Canvas entry + previewable presets)
- P7 edit history — undo/redo >=100 (zundo + immer)

## CONDEMNED — DO NOT REUSE OR RE-SKIN
Entire visual aesthetic thrown out per Logan. Do NOT extend any of this:
- The brass/gold **chrome-layer slab** system (`useChromeSlab`, brass `material.ts`) —
  ROOT CAUSE of "uglier every time"; every redesign re-skinned it.
- Gold-in-a-square logos (star/triangle inside a gold square).
- Grotesque fonts (Switzer or ANY grotesque — grotesque is banned everywhere).
- Prebuilt/Lucide-style 2D glyph icons (lightning bolts etc.) + CSS-filter fake-3D.
- The existing color scheme.

## REMAINING FUNCTIONAL WORK — resume after look is locked (DO NOT LOSE)
- **P4** — 3D drag gizmo (drei v10). STATUS: confirm whether committed; was next after P3
  but not in the last 3 commits. Verify before assuming done.
- **P8** — declutter / choreography.
- **P9** — demo app that must beat SliderRevolution.
- **P10** — interactive verification + sign-off.

## THE REDESIGN (design half — the huge part), driven by OpenDesign
Engine: OpenDesign `3d-animated-visuals` plugin (photoreal three.js + R3F, renders in
preview iframe, enforces visual-verify + functional-verify via a Claude Code Stop hook) +
its design-system plugins. NOT the frontend-design skill.

Direction (verified June-2026 premium): refractive **Liquid Glass** + **photoreal physical
materials** (light-responsive) + **real volumetric depth** (layers floating in space with
light-responsive shadows/reflections) + **custom 3D icons**. NOT flat, NOT cheap blur, NOT
extruded gold.

Source material:
- `docs/prism/DESIGN-REFERENCES.md` — 1,066-line anti-default toolkit (TSL/WebGPU
  MeshPhysicalNodeMaterial, pmndrs postprocessing, ray-marched SDFs + smooth-union, fluid /
  Rapier, magnetic cursors, Gaussian splatting). Feb-2026 dated; verify currency.
- `src/lib/prism/animatable/primitives` — 410 primitives (10 glass, 12 caustics, metals,
  crystal/gem, iridescence, refraction). Combine MULTIPLE per element.
- Canvas templates users get: `src/lib/editor/elements/catalog/`,
  `src/lib/editor/backgrounds/presets.ts`, `src/lib/prism-graph/animation-presets.ts`.

TECHNICAL GOTCHA (documented in `bevel-glass.ts` header): the shared scissored catalog rig
CANNOT populate three.js's transmission render target -> transmission-based glass reads BLACK
(opaque slab). The UI render context MUST support transmission/IBL/env maps, OR deliberately
use the no-transmission path (env-map specular + clearcoat + Beer-Lambert + postprocessing
refraction). Ignore this and the redesign hits the same black-slab wall.

GATE: OpenDesign produces ONE small slice (a few buttons + one custom 3D icon + the logo +
the type + one panel). **Logan approves yes/no before ANY build-out.** Logan is the gate,
not an agent. No more phases against an unapproved direction.

## OpenDesign update needed BEFORE redesign
Model list is stale. In `apps/daemon/src/runtimes/defs/claude.ts` the shipped Claude hints
stop at `claude-opus-4-5` / `claude-sonnet-4-5`. Add `claude-opus-4-8` (+ current sonnet/
haiku), verify/wire the 1M-context mechanism for the claude CLI, set opus-4-8 default. Fix the
stale `--model=claude-sonnet-4-5-20250929` at `.od/plugins/3d-animated-visuals/scripts/verify-and-gate.ts:285`.
Restart daemon; verify picker runs opus-4-8 1M.
