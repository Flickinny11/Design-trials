# TOOLBAR WIRING (P2) — wave progress

Part of the Canvas completion run (see `CANVAS-COMPLETION-PROGRESS.md`). Branch `prism-editor-build`.

## Contract (orchestrator, frozen before the wave)
`AnimationBinding { id, primitive, driver: time|scroll|pointer|state|event, params?, order? }` + `PrismNode.animationBindings?` (additive, types.ts ~710-740).

## Build wave (workflow wf_51bfe9b4, 3 parallel agents, ~29min, 681k subagent tokens)
- **A (bindings runtime):** `src/lib/prism/animatable/bindings.ts` — attachAnimationBindings: registry lookup → Animatable built against the MOUNTED artifact (subject = text-object group for text nodes else first Mesh; player-owned Group for self-generating primitives; live userData.pointer/scroll feeds), params via setControl, playback through the STEP7 dispatch (PrimitiveResult + drivers.attach; needsTick/onTick for Infinity-duration on the FrameDriver). GraphScene effect attaches ONLY in preview-app; detach restores pose. UNMOUNTABLE_CATEGORIES exported (glass/caustics/volumetric/smoke/shimmer/mask + some blur/displacement skip honestly — they swap baked materials). 15 tests.
- **B (Animation group UI):** AnimationFlyout — search + category chips + LIVE hover-play tiles through the shared catalog rig (one WebGPU canvas, clip-pathed to the flyout); apply→binding row; 5 driver chips; ControlSchema param panel (reused catalog ControlPanel, INV-5); reorder/remove; Preview-App jump. GSAP staggered entrance + native magnetic hover (raised bar). CanvasToolbar: animation + add groups wired. 25 helper tests + a 22-step live browser smoke.
- **C (Add Element + mobile):** buildBubbleElementNode (stage-0, no artifact data) + AddElementFlyout (lifecycle chips, honest deferred stages); ArtifactNode scene-path bubble branch (MeshPhysicalMaterial transmission 0.92 — raycast-hittable, §6 look); galaxy parity via the normal store flow; MobileModeToggle (bottom pill, 44px targets, safe-area, GSAP indicator). 7 tests.

## Integration (orchestrator)
- §6 preview rule: stage-0 bubbles return null in AssembledSceneNode when previewMode (unbuilt nodes are not part of the played app).
- Drive-harness fix: playback assertions sample the SUBJECT mesh, not the scenePosition wrapper (bindings animate the subject — first probe measured the wrong object).

## Verification (evidence: notes/verification/toolbar-wiring/)
- `results.json` — 12/12 drive steps PASS on real GPU (webgpu attested): picker→apply→bound row; **binding PLAYS in preview-app** (subject pose mutates on the master clock); canvas freezes+restores; driver swap; bubble in canvas (transmission .92) and ABSENT in preview-app; **criterion 22** (group move cascaded ×7, ungroup world-transform drift <1e-3); persistence (binding driver=scroll + bubble node in the autosaved live graph — INV-7 parity); mobile toggle switches all 3 modes at 390×844.
- Advocate round 1: INDIFFERENT/BLOCKED — 4 MUST-FIX (mobile pill collision; mobile header overflow; raw-UUID element names; spec-citation jargon in user copy). ALL FIXED: HubNav max-md:bottom-[84px]; graph-health pill max-md:hidden; getNodeName uuid→"New <Subtype>" fallback; plain-language copy rewrite. Re-captured 05/08/09/10 frames. Re-grade: see ledger.
- 312-catalog no-regression: capped `--max 3 --no-resume` run (result line in the ledger before AUTO-CKPT).

## Honest flags (carried)
- UNMOUNTABLE_CATEGORIES skip on mounted artifacts (material-swapping primitives need the rig env; picker could grey these — backlog).
- 'pointer' and 'state' drivers both ride the hover trigger today (StateDriver's only live scene input); named-state vocab needs a dispatch extension.
- Scroll-driver bindings hold the authored pose until first scroll input (deliberate).
- Shared-rig cross-route edge (catalog page visited first in an SPA session steals the rig canvas) + z-60 overlap notes from agent B.
- Idle picker tiles read samey at rest (hover-play differentiates); blank headline demo content is pre-existing mock-asset (P3); mobile flyout hint contrast + favicon 404 → P5.
- 'From Scratch' bespoke authoring = honest designed 'coming' state (criterion 14 is a later slice).
