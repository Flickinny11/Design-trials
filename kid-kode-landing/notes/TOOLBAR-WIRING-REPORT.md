# TOOLBAR WIRING REPORT — P2 of the Canvas completion run

**Branch:** `prism-editor-build` · **Model:** claude-fable-5 · **Date:** 2026-06-10
**Spec:** PRISM-CANVAS-EDITOR-SPEC.md §5 (toolbar), §8.2/§8.3 (drivers + catalog), §14 (selection/grouping), §6 (lifecycle), §18 criterion 22. Schema additions are additive only (INV-8): `AnimationBinding` + `PrismNode.animationBindings`.

## What's wired

**Animation picker → binding → plays via Drivers (the catalog payoff):**
Select a node → Animation group → search/browse all 312 primitives as LIVE hover-playing tiles (the same shared WebGPU rig the catalog verified — one canvas, clip-pathed into the flyout) → click to bind. The binding appears as a row with five driver chips (Load/Time · Scroll · Pointer · State · Event — §5 trigger buttons assign the Driver; swapping never touches keyframes, INV-6), ControlSchema-rendered parameter editing (the catalog's ControlPanel, INV-5 one-renderer), reorder, remove. In **Preview App** the binding genuinely PLAYS through the existing STEP7 driver dispatch (proven: subject mesh pose mutates on the master clock; canvas mode freezes and restores the authored pose). Bindings round-trip through save/reload (persisted with driver=scroll in the live graph during the drive).

**Add Element (§6):** creates a blank stage-0 bubble tethered to the current hub — a translucent liquid sphere (MeshPhysicalMaterial, transmission 0.92, clearcoat + iridescence), raycast-selectable, riding the standard transform paths. The flyout stages the §6 lifecycle honestly (Bubble → Populated → Built → In System; later stages disabled with plain-language "coming soon — needs the build pipeline" hints — nothing faked). Bubbles do NOT render in preview-app (unbuilt nodes aren't part of the played app) and appear in galaxy via the normal store flow (INV-7).

**Group/Ungroup (criterion 22): PROVEN** — multi-select → Group → move cascaded to all 7 members as one; Ungroup preserved every world transform to <1e-3. Lock/freeze toggles were already wired (STEP8) and untouched.

**Mobile mode toggle (Logan addendum):** phones previously had NO way to leave preview-app. Now: a bottom-center machined pill (44px touch targets, safe-area aware, GSAP slide indicator) switches Galaxy / Canvas / Preview — verified by tap-driving all three modes at 390×844.

## Verification
- `notes/verification/toolbar-wiring/results.json`: **12/12 drive steps PASS** on real GPU (`rendererBackend: "webgpu"` attested), frames 01–10.
- Advocate round 1: INDIFFERENT/BLOCKED with 4 MUST-FIX — mobile pill collision (HubNav stacked behind the toggle), mobile header overflow at 390px, raw-UUID element names in user chrome, spec-citation jargon in user copy. **All four fixed** (HubNav lifts above the toggle on phones; graph-health pill hidden on phones; `getNodeName` resolves uuid-ids to "New <Subtype>"; copy humanized) and evidence re-captured. Re-grade verdict: recorded in CANVAS-COMPLETION-PROGRESS.md (verdict JSON preserved in the evidence dir).
- tsc: 10 baseline / 0 new at every step. Vitest: +47 new tests across the wave (15 bindings + 25 UI helpers + 7 add-element), full suite at the documented 21-fail legacy baseline (0 new).
- 312-catalog no-regression (capped `--max 3`): result line in the ledger before AUTO-CKPT.

## Deferred groups — exactly what each needs (NOT faked)
- **Image group (P3):** the media/artifact pipeline — upload + URL artifact ingestion, image-plane creation in-scene, fit/crop/corner-radius/opacity written to additive node schema, asset-resolution handling (this also owns the remaining Retina-softness source: ~1x baked mock assets). Until then the group stays a designed placeholder.
- **3D-object group (P4):** primitive mesh creation as nodes (additive schema), materialSpec editor + lighting application to created meshes, gizmo + group/animation participation.
- **'From Scratch' bespoke authoring (criterion 14):** an authoring surface producing a new `Animatable` with a custom ControlSchema; the registry + control renderer are ready for it.

## Honest flags
1. Material-swapping primitive categories (glass/caustics/volumetric/smoke/shimmer/mask, some blur/displacement) skip on mounted artifacts (they'd replace the baked artifact material; several need the catalog rig's env). Exported as UNMOUNTABLE_CATEGORIES; greying their tiles in the picker is backlog.
2. 'pointer' and 'state' both drive via the hover trigger today (the StateDriver's only live scene input); a named-state vocabulary needs a driver-dispatch extension.
3. Scroll-bound nodes hold the authored pose until the first scroll input (deliberate — avoids invisible at-rest reveals).
4. Shared-rig cross-route edge: visiting /animation-catalog first in one SPA session binds the rig to that page's canvas (flyout previews then need a reload). Rebind API in the rig is the fix (P5 candidate).
5. The demo "magic moment" is muted by the blank-white headline mock asset (pre-existing content; P3 image work).
6. Idle picker tiles read samey at rest; hover differentiates. Mobile flyout hint contrast over light canvas + the favicon 404 → P5 ergonomics list.

## Plain-language summary for Logan
The animation catalog is now a real tool, not a gallery. Select anything on the canvas, open Animation, and the 312 moves play themselves as you hover; click one and it's bound — choose what triggers it (load, scroll, pointer, state, event) with one tap, tweak its knobs, stack more. Hit Preview and your element actually moves; come back to Canvas and everything holds still for editing, exactly as a design tool should. Add Element gives you the glass "bubble" seed node from the spec — honestly staged until the build pipeline lands. Grouping works like you'd hope: grab several things, group, move as one, ungroup and nothing jumps. And your phone finally has the mode switch — Galaxy, Canvas, Preview from a thumb-reachable pill. The advocate initially blocked over four real paper-cuts (a doubled-up pill on mobile, clipped header, machine-gibberish names on new elements, engineer-speak in the copy) — all four are fixed and re-shot.
