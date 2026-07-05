# PRISM — CANVAS TOOLBAR (GLASS) — restyle spec (founder-directed 2026-06-29)

SURFACE-ONLY restyle of the canvas toolbar (`src/components/editor/overlays/CanvasToolbar.tsx`).
Keeps EVERY button, EVERY wired function, and never touches what the buttons DO. Per
`.claude/INTENT-LOCK.md` #6 and `VERIFICATION-STANDARD.md`. Built in the isolated
`/toolbar-glass` lab, verified on real GPU, then docked into the canvas replacing the
DOM toolbar + the heavy chrome-layer "liquid glass" slabs.

## APPROVED (keep exactly)
- **Real Three.js glass.** A photoreal thick glass PANE (transmission, IOR, beveled visible
  edges/corners, depth, ambient refraction off a LOCAL studio IBL) — NOT CSS, NOT glassmorphism.
- **Glass cube buttons.** Clear glass cubes (real transmission), seated in the pane, that
  **raise toward the viewer on hover** (smooth, critically damped) — confirmed aesthetic.

## CORRECTIONS (founder feedback — these are the build targets)
1. **ORIENTATION: VERTICAL.** The toolbar is a tall, narrow vertical glass RAIL with the
   buttons stacked top→bottom. NOT a wide horizontal slab.
2. **LAYOUT: COMPACT + DENSE.** A real toolbar — buttons packed tight, minimal gaps, no
   display-board padding. The review-chassis grid spacing is WRONG.
3. **ICONS PROUD OF THE GLASS — fully visible.** Icons must sit IN FRONT OF the cube's front
   glass face (not suspended inside it, where the glass tints/hides them). Brightly lit +
   emissive + bloom so the icon is the hero and the glass cube is its setting. They must read
   instantly.
4. **ICONS = BOLD, DETAILED, CUSTOM 3D SHAPES.** All 14 are bespoke dimensional objects with
   gradients, color, real shading; animated on hover. NOT an icon set, NOT Lucide, NOT emoji,
   NOT flat engraved marks, NOT faint dots/placeholders. Bigger and richer than the slice.

## THE 14 FUNCTIONS (order preserved from CanvasToolbar GROUPS; group tints kept)
transform · selection · add · library(Elements) · image · object3d · background ·
changeArtifact · promptEdit · text · animation · function · lighting · build
(grouped CREATE / TRANSFORM / SCENE / LOGIC / OUTPUT, each a jewel-tone; compact vertical stack.)

## STACK + RULES
Three.js + R3F + drei (npm), real PBR, LOCAL IBL only (no remote assets — INTENT-LOCK #5).
no-dom-ui + node-authorship gates still apply to the docked result.

## DONE = (per VERIFICATION-STANDARD, real GPU)
Vertical compact glass rail renders; all 14 buttons present + each fires its real wired op;
icons proud + bold + readable + hover-animated; raise-on-hover smooth; ≥60fps WebGPU /
≥45fps WebGL2; zero remote fetches; zero console errors; advocate clean. Docking keeps the
keyframe editor + tutorial fully working.
