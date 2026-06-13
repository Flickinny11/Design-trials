# PHYSICS / FLUID STACK DECISION

**Date:** 2026-06-13 · **Model:** claude-fable-5 · **Branch:** prism-editor-build
**Status:** DECIDED — gate for the Physics/Fluid Capability Pack build.
**Evidence:** `notes/verification/physics-research-raw.json` (5 web-research agents + 61-primitive
catalog audit, June-2026 sources, all cited inline there). Logan's standing rule honored: nothing
below is assumed from training; every engine version/size was verified against live npm/docs in 2026.

---

## TL;DR

**Build the pack with hand-rolled deterministic fixed-dt CPU integrators — NO new dependency.**
- **Rigid bodies** (drop/bounce/tumble/domino/orbit/magnet): semi-implicit (symplectic) Euler at a
  fixed dt, reset-and-replay on backward seek, seeded with a `sin`-hash (no `Math.random`). This is
  the *exact proven pattern already shipping* in `collision-balls.ts`, `spring-lattice.ts`,
  `throw-physics.ts`, `fluid-sph.ts`.
- **Soft / cloth / rope / springs**: **XPBD** (Extended Position-Based Dynamics) — substepped,
  stiffness expressed as compliance `α = 1/k`, deterministic constraint ordering. Hand-rolled.
- **Fluids** (fill / pour / splash / ripple / slosh / buoyancy): the **Eulerian grid family**
  (Stam stable-fluids advect-project for dye/free-surface; explicit **wave-equation height-field**
  for ripple/interactive water; **shallow-water** for sloshing) — run **on the CPU** in `seek()`,
  written to a `BufferAttribute` or a small particle pool, at a **tier-sized resolution**.
- **Tier gating (INV-9):** every sim reads an optional `target.userData.tier` (`'T0'|'T1'|'T2'`,
  default highest when absent — i.e. in the catalog rig). The tier sets grid resolution / particle
  count / substep count. The heaviest sims (dense fluids, full cloth, boids) drop to a cheap
  **non-sim kinematic fallback** on `T0`.

**No change to `package.json` and no change to `.claude/hooks/dependency-allowlist-check.py`.**

---

## Why not a real physics engine (Rapier / Jolt / Box2D v3 / PhysX / Havok / cannon / ammo)

All five research agents converged on **reject** for the catalog-primitive use case. Four
independent disqualifiers, any one of which is fatal here:

1. **Async wasm init breaks the synchronous `createNode` contract.** Every wasm engine needs
   `await init()` / `instantiateStreaming` before a body can exist. Our renderer contract is
   `createNode(config, ctx): THREE.Object3D` — **synchronous**, must return immediately. Bolting on
   a module-scope top-level-await bootstrap is precisely the async-fetch dependency the one-scene
   design exists to avoid.
2. **Backward reseek is the wrong shape.** The verification harness pins frozen "engaged" frames by
   repeatedly calling `__catalogRig.seek(name, t)` (often `dt≈0`, often scrubbing *backward*). Rapier
   has **no reverse step**: you either re-run from frame 0 (the hand-roll already does this, cheaply,
   without wasm) or `World.restoreSnapshot()` which **allocates a brand-new World per restore** (GC
   churn) and is hit by the unfixed broadphase snapshot-determinism bug (rapier#910, open Jan 2026).
3. **Bundle cost for zero benefit.** `@dimforge/rapier3d-compat@0.19.3` = **~815 KB gz**
   (base64-inlined wasm); non-compat ~570 KB gz + a separate wasm fetch. Jolt 1.0.0, Box2D
   `box2d3-wasm@5.2.0`, `physx-js-webidl@2.7.3`, `@babylonjs/havok@1.3.12` are all the same
   hundreds-of-KB-to-MB class. For 10–50 decorative bodies the solve is sub-millisecond either way —
   we'd pay the whole bundle for emergent contact physics we don't need and can't frozen-frame anyway.
4. **Determinism / deployment gates.** Jolt/Box2D multithread need `SharedArrayBuffer` (COOP/COEP
   headers); Havok needs WASM SIMD (absent iOS <16.4). The pure-JS hand-roll imposes none of this and
   is **bit-identical on WebGPU and the WebGL2 fallback** because the sim never touches the GPU.

**Kept on the shelf:** if a *future* feature ever needs genuine many-body stacking/contact that
cannot be faked, the right move (per research) is **Jolt** (only engine with first-class
`SaveState`/`RestoreState`) behind a lazy async loader, precomputed into a per-`t` transform LUT fed
to the harness — explicitly out of scope for this catalog pack.

## Why CPU fluids, not GPU-compute fluids

The research best-in-class is an **Eulerian grid on WebGPU compute** (Stam stable-fluids dye + a
GPGPU wave height-field; reject particle SPH/FLIP/MLS-MPM because atomic-scatter is
accumulation-order non-deterministic and reseek means restoring 32k–300k particle buffers). We adopt
the **algorithms** but run them on the **CPU**, because in *this* architecture:

- **The tile rig only calls `seek()` then `renderer.render()`** (`shared-tile-renderer.ts` render
  loop) — it never calls `renderer.computeAsync`. A GPU-compute primitive would build its kernels but
  **never step** here. CPU stepping in `seek()` is the only thing that actually animates in the rig
  *and* in the runtime's synchronous draw path.
- **`computeAsync` / `renderer.init()` are async** → strain the synchronous `createNode` contract
  (three-compute finding).
- **WebGPU↔WebGL2 compute is not bit-identical** and WebGL2 has no atomics → a GPU fluid would fail
  the WebGL2-fallback determinism requirement. The CPU sim is identical on both backends.
- CPU height-fields are cheap at tile resolution (the wave-equation / shallow-water step is a couple
  of array passes; `fluid-sph` already runs 300 CPU particles per tile clean).

We keep the research's deterministic discipline verbatim: **fixed-step accumulator keyed to the
seek clock** (not wall-clock dt), **Jacobi / explicit stencils** (pure reads, order-independent),
**seeded hashed impulses**, **reset-and-replay** to land any frozen frame. Real-Metal-GPU
verification still applies to fluid tiles (refraction/normals/Fresnel benefit from the real GPU even
though the sim is CPU) — routed via `GLASS_EXTRA` in `verify-catalog-parallel.mjs`.

---

## Determinism & reseek discipline (binding for every primitive in this pack)

1. `duration() = Infinity` for continuous sims (stateful), finite for one-shot settles.
2. Fixed `DT` (e.g. `1/60`, `1/120` for stiff XPBD). `seek(t)` steps `lastT → t` in fixed
   increments with a `guard` cap; **`t < lastT` ⇒ `resetState()` and replay from 0**.
3. **Seeded only** via `sin`-hash (`sin(n*12.9898)*43758.5453`). No `Math.random`, no `Date.now`.
4. **Reset-replay makes the frame at `t` a pure function of `(params, t)`** → sweeping ANY control
   and re-seeking the same pinned `t` recomputes the whole trajectory, so **every control is
   automatically frozen-frame-visible** to the advocate harness. This structurally neutralizes the
   "dead control at engaged pose" failure that cost prior waves 2–3 fix-rounds each.
   - Corollary: pick durations/`frozenPhase` so the pinned ~0.45 phase lands **mid-action** (ball
     mid-bounce, liquid mid-splash, cloth mid-drape) where controls have visible effect.
5. Fixed build-time MAX allocation; live `count`/resolution clamps to it (no per-seek realloc).
6. `dispose()` frees geometry + materials, removes from `target.object`.

## Shared core

A relative-imported helper `src/lib/prism/animatable/primitives/_sim-core.ts` (relative imports are
NOT package specifiers → not subject to the dep allowlist; precedent: `_volume-fbm.ts`) provides:
`hash1`, `resolveSimTier(target)`, integrators (`semiImplicitEuler` step helpers, `xpbdSolveDistance`),
a `SimClock` reset-replay stepper, and a wave-equation / shallow-water stencil. DRY across the pack.

## Build plan (4 ULTRACODE waves, ~36–40 net-new, all `-sim`-class names, additive)

Mapped onto the FROZEN 15 categories (no `physics`/`fluid` category exists). Existing fakes are
**kept** (additive discipline; "keep both, sim tier-gated" per the launch prompt) — the new sims are
their higher-fidelity siblings, offered alongside in the picker.

- **Wave A — GRAVITY / RIGID** (→ `transform` / `particles`): drop-squash, gravity-bounce-cluster,
  tumble-settle, domino-cascade, block-topple, magnet-snap, weightless-drift, n-body-orbit,
  newton-cradle, pinball-bounce.
- **Wave B — SPRINGS / SOFT (XPBD)** (→ `transform` / `wave`): spring-arrive, soft-body-bounce,
  cloth-drape-sim, flag-wind-sim, rope-dangle-sim, chain-dangle, water-balloon-wobble, ragdoll-dangle,
  banner-cloth-sim.
- **Wave C — FLUIDS (CPU grid/pool)** (→ `particles` / `wave` / `glass` / `smoke`): liquid-fill-sim,
  pour-splash-sim, ripple-interact-sim, buoyancy-bob-sim, wave-tank-slosh, molten-drip-sim,
  smoke-plume-sim, bubble-rise-sim, raindrop-ripple-sim.
- **Wave D — FORCE FIELDS** (→ `particles` / `pointer` / `displacement`): wind-gust-sim,
  vortex-pull-sim, explode-reassemble-sim, boid-swarm-sim, gravity-well-sim, charged-particles-sim,
  turbulence-drift, attract-repel-swarm.

Final names/counts may shift slightly during build to dodge dup-with-existing; the audit
(`physics-research-raw.json → audit[]`) is the dedup reference. Each primitive ships: deterministic
reseekable sim, full ControlSchema (3–6 standing controls), driver, tier path, vitest, picker-wiring
via barrel regen (`notes/catalog-wire-barrel.mjs`).

## Verdict summary (from research)

| Question | Verdict |
|---|---|
| Rapier for catalog bodies | **reject** (async init, no cheap reverse-step, ~815KB) |
| Other wasm engines (Jolt/Box2D/PhysX/Havok/cannon/ammo) | **reject** (same async/bundle; Jolt only future option) |
| WebGPU fluids: grid vs particle | grid family **adopt (algorithm)**; particle SPH/FLIP/MLS-MPM reject for frozen-frame |
| r184 TSL compute stability | real but async + not WebGL2-bit-identical → **CPU here** |
| XPBD for soft/cloth/rope/springs | **adopt** |
| New dependency | **none** |
