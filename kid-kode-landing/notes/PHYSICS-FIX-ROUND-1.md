# PHYSICS PACK — FIX ROUND 1 (advocate-driven)

Advocate round 1: 22/36 SHIP, 14 BLOCKED. ALL blocks are VISUAL-FIDELITY (the physics passed
vitest + the functional harness render/play/controls — do NOT rewrite the sim math; keep the
deterministic reset-replay + markDirty discipline intact). Fix what the advocate's eye flagged.

Per-tile advocate verdicts (mustFix + cited frames + metrics): `notes/verification/physics-advocate-blocked.json`.
Evidence frames: `notes/verification/useradvocate-sixtile/<tile>/after/*.png` + `metrics.json`.

## The dominant root cause + the proven remedy

Six particle tiles render as **1-2px specks on a near-black field** (advocate cites
`meanLuma≈7.7/255`, `effVal=0`, "sub-pixel specks", "1px-square-sprite bar"). They used plain
`THREE.PointsMaterial`, which at the tile camera distance draws tiny, dim points.

**The PASSING particle tiles** (`bubble-rise-sim`, `smoke-plume-sim`, `wind-gust-sim`) read bright
and premium because they use the **instanced `THREE.Sprite` + `PointsNodeMaterial` (TSL) radial-
falloff** pattern with a generous billboard footprint and additive bright cores. COPY THAT PATTERN.
Read `src/lib/prism/animatable/primitives/bubble-rise-sim.ts` and `smoke-plume-sim.ts` as the
reference render path before fixing a particle tile.

Concrete remedy for the dim-particle tiles:
- Render motes as instanced sprites (or much larger additive points) with a **soft radial TSL
  falloff** that reaches a bright core (luma ≫ 120) — NOT 1px dots. Footprint big enough to read as
  an object with mass (the advocate must see spheres/balls/embers, not stars).
- Lift the visible brightness: brighter base color + additive cores; for "balls/blocks" give them
  visible SIZE and shading so they read as objects, not points.
- Keep the deterministic sim; only the RENDER changes. Re-confirm the vitest still passes.
- If the engaged frame (rig pins ~0.45 of duration) lands in a quiet/empty moment, retune
  duration/emission so phase 0.45 lands ON the action (stream visible, blast mid-flight, balls
  mid-pile). For one-shots that decay fast (drop-squash impact), HOLD the visible state longer or
  ensure the loop re-triggers so 0.45 catches it.

## Per-tile fixes (each agent: read the tile's blocked.json entry + fix only the named issues)

- **gravity-bounce-cluster** — balls are 1-2px specks, no basin. Render balls as large shaded/additive
  spheres (sprite-falloff or sphere meshes), brighten, show the pile clearly. Keep gravity+pile sim.
- **n-body-orbit** — too dark, suns not bright, frames look static, controls "dead" at pin. Make suns
  BRIGHT (large glowing cores) + satellites visible; ensure motion reads at the pinned frame
  (faster orbits / longer trails); markDirty already wired — confirm controls move the frozen frame.
- **pour-splash-sim** — near-black, ~1px dots, frozen, controls dead at pin. Brighten + enlarge the
  liquid motes; make the stream + pool + splash crown clearly visible at phase 0.45; confirm controls
  bite at the pin (markDirty).
- **explode-reassemble-sim** — too dark, 1px specks, "never reassembles" in the captured window, 3/4
  controls dead. Brighten/enlarge motes; retune the cycle so phase 0.45 shows a legible state (mid-blast
  OR mid-reassembly with the formation readable); confirm power/springBack/gravity/count move the pin.
- **charged-particles-sim** — 1px dots, no visible ARCS/trails, too dark, brass-vs-ice not distinct.
  Add visible per-mote TRAILS (short streaks) so the curved Lorentz arcs read; brighten; make the two
  charge species clearly warm (brass) vs cool (ice).
- **shockwave-scatter** — grid is 1px dots, no visible RING, springBack dead. Render grid elements as
  visible-size objects (tiles/dots with body); render the expanding shock RING as a visible wavefront;
  fix springBack so it moves the pin.

- **pinball-bounce** — RENDER BUG: whole tile blown out to white, no ball/pegs/trail. Likely additive
  trail/material stacking to white or wrong scale. Rebuild the render: visible ball + pegs + walls +
  fading trail on a dark field, no overexposure. Keep the ricochet sim.
- **rope-dangle-sim** — RENDER BUG: empty panel, nothing visible, controls/motion dead to the eye.
  The TubeGeometry/line isn't visible (too thin / wrong material / off-camera / not rebuilt). Make the
  rope a clearly visible lit tube in frame that swings; confirm it animates and controls change it.
- **jelly-collide-sim** — soft body tears into a jagged low-poly mass, no flat squash, falls out of
  frame. Stiffen/clamp the lattice so it stays a cohesive blob, show a clear FLAT squash against a
  visible wall, keep it in the viewport, then peel/recover. Smooth the mesh (computeVertexNormals,
  enough resolution). bounciness must move the pin.
- **molten-drip-sim** — blown-out white/cream circles + a cold pale-blue blob + static decorative
  blobs + clipping. Tone the emissive down to a GLOWING amber/brass (not clipped white); remove or
  animate the static reservoir/pool blobs; keep everything in frame; the drip column is the hero.
- **buoyancy-bob-sim** — water crammed into left 40%, buoy disconnected + blocky placeholder, buoyancy
  control dead. Put the buoy ON the water surface (sample the height under it), fill the frame with
  water, make a believable buoy (smoother), confirm it bobs/tilts, fix the buoyancy control.
- **wave-tank-slosh** — renders as a flat untextured quad that rigidly tilts; no surface relief.
  Make the height field actually DISPLACE the plane (enough segments + z displacement + normals) so
  the slosh reads as moving water with relief and a wall pile-up, not an affine tilt.

- **drop-squash** — sim is right but the impact SQUASH is too brief to catch and the squash control
  reads dead at the non-impact pin. Hold the squash longer (slower recovery) and/or tune duration so
  phase 0.45 lands at an impact; ensure the squash control visibly compresses the card at the pin.
- **ripple-interact-sim** — default state too flat; tension+damping read dead at the pin. Inject
  stronger/auto default pokes so propagating/interfering ripples are clearly visible without the
  pointer; raise amplitude; confirm tension+damping change the frozen frame (markDirty).

## Discipline
- tsc 0-new, vitest green per tile, deterministic (no Math.random/Date.now), reset-replay + markDirty
  kept. Observatory Brass/ice/steel palette, NO purple. No 1px squares. Only edit the named tile's
  .ts (+ its test if needed). Do NOT touch _sim-core.ts/index.ts/other primitives.
