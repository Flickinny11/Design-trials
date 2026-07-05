# PREBUILT ELEMENT LIBRARY — PRODUCTION REPORT (§13, criterion 21 + 23)

**Run:** the premium prebuilt element catalog — "the most premium thing in the editor."
**Branch:** `prism-editor-build`. **Model:** claude-opus-4-8 (confirmed; Fable-5 down → pinned Opus).
**Renderer:** one Three.js/TSL/WebGPU scene (WebGL2 fallback). No PixiJS, no 2nd renderer.

---

## 1. The contract (Phase 0 — frozen)

A library entry is a **parameterized element-cluster**: a captioned set of member
nodes + a hover-preview + a builtSnapshot. Drag/click-to-place instantiates it as a
`groupId` subtree, every member tethered to the current hub (criterion 21, INV-7).
**No new graph field** — a member is a template producing a valid `addNode` input;
placed members flow through the EXISTING build path (`defaultRenderModeFactory` +
`computeNodeContentHash`), so editing one rebuilds only it (criterion 23).

Typed surface (`src/lib/editor/elements/`): `contract.ts` (`ElementClusterDefinition`,
`ClusterMemberTemplate`, `ClusterPreviewSpec`, 16 `ElementCategory`), `registry.ts`
(self-registering), `instantiate.ts` (`buildClusterNodeInputs` — pure, criterion 21).
Additive store seams: `useGraphSourceStore.addNodesBatch`; `useGraphEditorStore`
library + placement state. Full contract: `notes/PREBUILT-LIBRARY-CONTRACT.md`.
Proof: `tests/editor-build/PBLIB-instantiate.test.ts` 7/7; tsc 9 (0 new).

---

## 2. The library UI (Phase 1 — real-GPU verified)

- **Toolbar:** a new **"Elements"** group (Observatory-Brass, icon `layers`) →
  `LibraryFlyout` ("Browse Elements") → opens the premium browser. Mirrors the
  existing Change-Artifact group pattern; mounted in `src/app/page.tsx`.
- **Browser** (`ElementLibraryBrowser`): a root-mounted modal — header, search box,
  category chips (16 categories), responsive tile grid. Z-stack so the cluster rig
  shows through transparent tile windows (backdrop z0 / rig canvas z10 / chrome z20).
- **Hover previews** (`cluster-tile-renderer`): a dedicated shared-rig — ONE WebGPU
  canvas, each tile a scissored window — renders the REAL cluster (members assembled
  via the same `defaultRenderModeFactory` Canvas uses → **preview == placed**) and
  plays its integrated `animationBindings`; frozen mid-frame until hover. Richer than
  the single-subject animation-primitive tiles (§13 bar). 36 tiles on ONE context,
  **deviceLostCount 0**.
- **Placement:** a plain **click places immediately** at the active hub (drillIntoHub
  frames it in canvas, the cluster is selected → reposition with the gizmo). A **drag**
  arms the galaxy positioned-drop (`ElementPlacementLayer`, sibling of the clone-drag
  layer). Criterion 21 holds on both paths.
- Mobile-aware: responsive grid, touch; renders 36/36 at 390×844 DPR-3.

---

## 3. The catalog (Phase 2 — 36 elements, all 16 §13 categories)

Authored by a 34-agent parallel workflow against the frozen contract (+2 seeds).
Every element: premium procedural PBR (transmission glass / brushed-or-polished
metal / iridescence / clearcoat) + lighting opt-in (reads photoreal standalone),
a real integrated `animationBinding` (every primitive verified against the
407-primitive registry), MSDF text where used (INV-11), INV-9 tiering (clean T0
fallback), Observatory-Brass palette (no purple). **fal: $0 this run** — all
photorealism is procedural PBR + IBL + MSDF; cumulative account spend unchanged
(~$0.263 / $50).

### 3.1 Dependency-usage table (element → DESIGN-REFERENCES techniques)

| Category | Element | Integrated primitive(s) | DESIGN-REFERENCES techniques shown |
|---|---|---|---|
| carousel | Photoreal Ring Carousel | spin | SR rotating 3D carousel; turntable showcase |
| carousel | Coverflow Depth Carousel | scroll-orbit-scrub, depth-pop | Apple Coverflow 3D; transmission glass; roughness-gradient DOF |
| carousel | Cylinder Billboard Carousel | spin, cylinder-unroll | SR rotating carousel; brushed/chrome PBR; unroll reveal |
| wheel | Radial Menu Wheel | pointer-orbit, magnet-snap, spin | magnetic cursor physics; snap-to-segment; chrome/brass PBR |
| wheel | Fortune Spinner Wheel | spin, pendulum-settle | damped settle physics; polished chrome+clearcoat |
| slider | Morph-Through Slider | displacement-transition, liquefy-reveal, light-sweep | morph-through-3D; GPU displacement wipe; metaball liquefy; glass bezel |
| slider | Depth Parallax Slider | scroll-depth-dolly, parallax-layers | multi-layer depth parallax; depth-dolly choreography; glass |
| slider | Distortion Fade Slider | swirl-warp, wave-distort-in | whirlpool distortion; ripple settle; transmission+dispersion glass |
| hero | Photoreal Monolith Hero | float, text-fade-up-each | iridescent centerpiece; kinetic typography |
| hero | Glass Prism Hero | dispersion, float, godray, split-3d | transmission glass; chromatic dispersion; volumetric godrays; 3D type |
| hero | Liquid Metal Hero | liquid-metal-flow, text-fade-up-each | molten-chrome shimmer; studio IBL; kinetic typography |
| hero | Particle Emerge Hero | particle-assemble, text-mask-reveal | image-to-particles; PBR obsidian+brass; kinetic typography |
| banner | Silk Flag Banner | flag-wind-sim, light-sweep, text-fade-up-each | XPBD wind cloth; satin PBR; specular sweep; kinetic type |
| banner | Light Sweep Banner | light-sweep, metallic-sheen | sweeping specular band; brushed-metal PBR |
| banner | 3D Ticker Banner | scroll-marquee, text-extrude | infinite marquee; extruded 3D type; brushed-metal signage |
| gallery | Depth Wall Gallery | pointer-tilt-3d, parallax | cursor parallax tilt; depth parallax; transmission glass |
| gallery | Masonry Reveal Gallery | scroll-stagger-rise, mask-wipe | staggered masonry reveal; directional wipe; glass |
| card-stack | Swipe Deck | throw-physics, float | fling cursor physics; transmission glass; obsidian/metal stack |
| card-stack | Fan Spread Stack | card-fold, hover-lift | card-fold; magnetic hover-lift; clearcoat metal cards |
| navigation | Glass Dock Nav | magnetic, hover-lift, frosted-glass | macOS dock magnification; magnetic physics; frosted glass |
| navigation | Orbital Ring Nav | pointer-orbit, spin | rotating orbital nav; clearcoat metal; kinetic type |
| showcase | Turntable Showcase | brushed-metal, spin, spotlight-follow | turntable; anisotropic brushed-metal; magnetic spotlight; glass cap |
| showcase | Exploded View Showcase | shatter-assemble, spin | engineering exploded view; reverse-explosion; chrome/metal layering |
| marquee | Ribbon Flow Marquee | flow-ribbon, text-wave-3d | curl-noise flow ribbon; kinetic 3D type; brushed-metal IBL |
| feature-grid | Tilt Card Feature Grid | pointer-tilt-3d, proximity-rim-glow | 3D trading-card tilt; magnetic physics; fresnel rim; glass |
| feature-grid | Depth Pop Feature Grid | depth-pop, scroll-stagger-rise | depth-pop reveal; scroll-stagger; brushed-metal/obsidian/glass |
| testimonial | Orbit Quotes | spin, orbit-rings, text-fade-up-each | orbital avatar ring; glass quote panel; brass/chrome IBL |
| testimonial | Floating Glass Quotes | float, frosted-glass | transmission glass; frosted roughness; varied-depth float |
| pricing | 3D Pricing Pillars | scale-pop, gold-glint, text-counter-roll | clearcoat metal columns; gold specular sweep; odometer typography |
| pricing | Glass Pricing Tiers | bevel-glass, light-sweep | transmission glass; beveled refraction; light-sweep highlight |
| stat-counter | Odometer Stats | brushed-metal, text-counter-roll | mechanical odometer roll; anisotropic sheen; chrome |
| stat-counter | Ring Progress Stats | scroll-progress-fill, gold-glint | scroll progress choreography; polished-metal/obsidian |
| cta | Magnetic CTA Pedestal | magnetic, charge-release, neon-edge-pulse | magnetic physics; press-charge spring; neon emissive; metal pedestal |
| cta | Glass CTA Banner | bevel-glass, light-sweep, text-fade-up-each | transmission glass; beveled glint; specular sweep; kinetic type |
| logo-cloud | Orbital Logo Cloud | spin, orbit-rings | orbital particle ring; transmission glass+chrome; iridescence |
| logo-cloud | Constellation Logo Cloud | constellation-net, float, parallax-layers | TSL particle constellation; depth parallax; clearcoat+iridescence |

---

## 4. Hybrid customization + real integration (Phase 3 — verified)

A placed element is a fully-editable node-group plugged into the existing systems
(`scripts/prebuilt-library-integration.mjs`, real webgpu DPR-2, 9/9 steps ok,
0 console errors, scene stable):
- **Integrated animation editable + swappable** via the Animation Picker (binding
  []→added; reorder/stack).
- **Keyframe Editor** mounts on a placed member.
- **Material** metalness 0.7→0.2 (routes through preview-state — the §R2 Save model).
- **Lighting** per-node receivesLighting toggled + scene lights changed.
- **Composes live**: placed cluster + added Text element + **Group (7 items)** + scene
  lighting — simultaneously, stable (`phase3/06-composed.png`).
- **"Take just the object"**: placed a 2nd element + manually stacked animation.
- Plays in preview-app (46 nodes). Evidence: `notes/verification/prebuilt-library/phase3/`.

---

## 5. No-regression + performance

- **Tests:** full vitest suite **3349 passed / 8 skipped / 0 failed** (incl. 7 new
  instantiation tests). **tsc:** 9 errors (baseline; **0 new**) across all 36 elements.
- **Perf** (`phase4/perf.json`, real webgpu, post-fix): **60fps** with all 36
  tiles open (desktop avgDt 16.6ms / 60.6fps, mobile 16.5ms / 60.2fps); open-flyout
  ~60ms; **hover→play 54ms** (well under the 100ms bar) on desktop AND mobile;
  **click-to-place commit 226ms desktop / 446ms mobile** (reliable +6 members each;
  the prior galaxy two-step raced and timed out — fixed). deviceLostCount 0; no jank.
- Animation primitive catalog untouched (additive run); its tests pass in the suite.
- Re-capture after fix-round: **rendersContent 36/36 desktop AND 36/36 mobile**,
  animates 35/36 (the 1 still tile is scroll-driven, correctly static when frozen).

---

## 6. fal spend ledger

| Run | fal spend | Cumulative |
|---|---|---|
| Prior (canvas-final) | — | ~$0.263 |
| **This run (prebuilt library)** | **$0.00** | **~$0.263 / $50** |

All photorealism is procedural PBR + IBL + MSDF text — no fal generation used.

---

## 7. Checkpoints (AUTO-CKPT, branch prism-editor-build)

| Phase | Commit | What |
|---|---|---|
| P0 contract | `5ce5b8d` | frozen typed contract + store seams + tests |
| P1 UI | `5650e06` | toolbar + browser + cluster rig + placement (real-GPU verified) |
| P2 catalog | `ed339ec` | 34 elements, 16 categories (render-verified 36/36) |
| P3 integration | `755777f` | hybrid customization + composition (9/9 steps) |
| P4 placement fix | `b3f6d0a` | click-to-place immediate + reliable (advocate MUST-FIX #4) |
| P4 element fix-round | `0414686` | empty-preview + nav + hero fixes (9 elements) |
| P4 re-capture | `fb984ea` | MUST-FIX resolved (36/36 render, placement reliable) |
| P4 sign-off | _(this commit)_ | advocate PASS-WITH-FLAGS + cluster-rig lit backdrop + report |

---

## 8. User-advocate verdict (human-grade, evidence-cited)

A fresh-context `user-advocate` judged the run as a non-technical first-time user,
twice, from real-GPU frames + measured pixel stats (never the DOM/source), applying
Logan's bar verbatim.

**Round 1 (pre-fix): MIXED — 5 MUST-FIX.** Empty previews on slider-morph-through /
featuregrid-depth-pop / gallery-masonry-reveal; placed element not visible;
muddy/illegible nav-glass-dock. Root cause of the empty previews: time-driven
one-shot reveal/transition primitives loop-wipe the element to empty for part of
the preview loop.

**Fix-round** (commits `b3f6d0a`, `0414686`): replaced those with continuous
always-visible motion (reveals → scroll bindings for real hosts); click-to-place
made immediate + reliable; nav cleaned to clear glass + legible labels; the
featured monolith hero brightened. Plus a systemic cluster-rig **lit backdrop** so
transmissive glass refracts bright structure + metals catch reflections.

**Round 2 (re-judge): PASS-WITH-FLAGS — PRODUCTION-SHIPPABLE.** Validator
`{ valid: true, computedGate: "PASS-WITH-FLAGS" }`. **All 5 prior MUST-FIX
RESOLVED** with cited frames; **no remaining MUST-FIX.**

| Prior MUST-FIX | Verdict | Evidence |
|---|---|---|
| slider-morph-through empty | RESOLVED | `phase4/desktop/slider-morph-through-{frozen,play2}.png` — full glass slide + title |
| featuregrid-depth-pop empty | RESOLVED | `…/featuregrid-depth-pop-*.png` — populated 6-tile grid |
| gallery-masonry-reveal empty | RESOLVED | `…/gallery-masonry-reveal-*.png` — packed masonry wall |
| placed not visible | RESOLVED | `phase4/place-*-{canvas,preview}.png`; placements +8/+8/+6 grouped+tethered |
| nav muddy/illegible | RESOLVED | `…/nav-glass-dock-frozen.png` — 3 glossy pills, legible labels |

### Documented polish FLAGs (non-blocking; honest backlog)
- nav-dock labels sit slightly low / clip on the pills (worse on mobile).
- some glass members still read more opaque than fully transmissive (the lit
  backdrop improves this; deeper transmission tuning is a future pass).
- a few grid/gallery tiles run dark; some slider panel bodies are flat-grey.
- showcase title partly occluded; placed clusters land at the hub origin and can
  overlap existing hub content until repositioned (the cluster is auto-selected for
  immediate gizmo repositioning).

These are taste/polish, not breakage — every element renders as real, lit, animated
premium 3D (advocate's 5-best: Glass Pricing Tiers, Liquid Metal Hero, Orbit Quotes,
Turntable Showcase, Ribbon Flow Marquee).

### Slider-Revolution standard
Ours independently reads as **real 3D** — genuine depth, PBR materials, rotation,
morph-through, parallax, cursor physics — versus SR's flat 2D layer crossfades
(SR's paid product can't be screenshotted; the advocate judged ours best-in-class
3D on its own merits: carousels/wheels/showcase/heroes clearly beat a flat slider
plugin). The literal Morph-Through Slider now keeps full coverage while morphing.

---

## 9. VERDICT — PRODUCTION-READY (with documented polish backlog)

The §13 Prebuilt Element Library is **PRODUCTION-READY**: a comprehensive, premium
catalog of **36 drag-to-place 3D element-clusters across all 16 categories**, each a
fully-editable node-group that composes live with every other editor system.
Criterion 21 (drag-to-place → grouped, hub-tethered) and criterion 23 (per-node
hash-keyed builtSnapshot) are proven on the real Metal GPU. Hover previews render
the real cluster + its animation through one shared WebGPU context (richer than the
primitive tiles, 60fps, 0 device-lost). Human-grade advocate verdict:
PASS-WITH-FLAGS, production-shippable, zero MUST-FIX. No-regression: 3349 tests
green, tsc 0-new, §19 forbidden sweep clean, fal $0. A short polish backlog (glass
transmission depth, nav label positioning, a few dark tiles, placement anchor) is
documented for a future taste pass — none blocking.
