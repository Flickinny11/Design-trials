# PHYSICS / FLUID PRIMITIVE — AUTHORING GUIDE (read before building one)

You are authoring ONE deterministic simulation primitive for the Prism animation
catalog. Decision context: `notes/PHYSICS-STACK-DECISION.md` (no new deps; hand-rolled
fixed-dt CPU integrators; XPBD for soft; CPU Eulerian grid for fluids).

## Read these first
- `src/lib/prism/animatable/primitives/drop-squash.ts` — the GOLD TEMPLATE. Copy its shape exactly.
- `src/lib/prism/animatable/primitives/_sim-core.ts` — the shared helpers you MUST use.
- `src/lib/prism/animatable/primitives/collision-balls.ts` and `fluid-sph.ts` — reference CPU sims.
- `tests/editor-build/animatable/drop-squash.test.ts` — the test shape. `tests/editor-build/animatable/_conformance.ts` — the conformance helper.

## The contract (frozen — do not change)
`PrimitiveDefinition` = `{ name, label, category, difficulty, subject, defaultDriver, description, schema, create, mountable?, volumetric? }`.
Build `create` with `defineAnimatable({name, category, schema}, (target, params) => BoundPrimitive)`.
`BoundPrimitive` = `{ duration(): number, seek(t): void, dispose(): void, onParamChange?(id,value): void }`.
The factory supplies controls()/getParams()/setControl()/serialize() for you.

- `category` MUST be one of: transform, fade, scroll, pointer, text, glass, caustics, volumetric, particles, smoke, displacement, wave, shimmer, blur, mask. **There is NO 'physics' or 'fluid' category** — pick the closest (see your spec).
- `subject`: 'card' | 'text' | 'plane' | 'sphere' | 'empty'. Use 'empty' when you generate your own geometry (particles); 'card'/'sphere'/'plane' when you move/deform a host-built subject.
- `defaultDriver`: 'time' | 'scroll' | 'pointer' | 'state' | 'event'.
- File name `foo-bar.ts` MUST export `export const fooBarPrimitive: PrimitiveDefinition` (camelCase + `Primitive`). The barrel wirer enforces this.

## Integration facts (the catalog rig that renders your tile)
- `const subject = target.subject ?? target.object;` then move/scale `subject` (transform/deform primitives), OR `target.object.add(yourPoints)` (particle primitives, subject:'empty').
- Camera at z≈3.2, FOV 40, looking down −z. Your content should live roughly within x,y ∈ [−1.4, 1.4], z near 0. A card subject is ~1.6×1.0; a sphere ~0.8r.
- Pointer-driven primitives read `target.userData.pointer = {x, y}` normalized 0..1, subject center at (0.5, 0.5).
- Scroll-driven primitives read `target.userData.scroll` (0..1).
- The rig pins a "frozen" preview at phase ≈0.45 of `duration()`. Design so phase 0.45 lands MID-ACTION (mid-bounce / mid-splash / mid-drape), where controls have visible effect.
- Palette: Observatory Brass + ice/steel. Colors like `#7fd4ff`, `#9fe0c4`, `#ecd49d`, `#cfdde6`, brass `#d9a86c`. **NO purple** (banned chrome). Particles: use additive PointsMaterial or PointsNodeMaterial radial falloff (NEVER bare 1px square points — r184 PointsMaterial size with sizeAttenuation is fine for round-ish, but for premium use a soft sprite).

## DETERMINISM RULES (mandatory — the harness pins frozen frames by reseeking)
1. NO `Math.random`, NO `Date.now`. Seed only via `hash1`/`hash2`/`shash` from `_sim-core`.
2. Use `makeReplayStepper({ dt, reset, step })` for the sim clock. `seek(t)` = `stepper.seekStep(t); write();`.
   - `reset()` re-seeds initial state. `step(dt)` integrates ONE fixed step (semi-implicit Euler: `v += a*dt; x += v*dt`).
   - `write()` copies sim state → THREE transforms / buffer attributes. Read params LIVE inside step()/write() so changes apply with no rebuild.
3. **ALWAYS** return `onParamChange: () => stepper.markDirty()`. This is non-negotiable: it makes trajectory-only controls (gravity/stiffness/viscosity) visibly change the FROZEN frame when the advocate sweeps them (the rig re-seeks the SAME t while paused; without markDirty those controls read DEAD and the tile is BLOCKED). At least one control should ALSO be read live in write() (so even a same-t reseek without markDirty shows something).
4. Fixed build-time MAX allocation for arrays; a live `count` control clamps to MAX (never realloc per seek). Park unused units far off-screen.
5. `dispose()` removes added objects and disposes geometry+materials; restore any mutated subject transform.

## Tier gating (INV-9)
Read `const tier = resolveSimTier(target);` then size cost with `tierPick(tier, {T0, T1, T2})` (grid res / particle count / substeps). The catalog rig has no tier → defaults to 'T2' (full). For HEAVY sims (dense fluids, full cloth, boids), T0 should be a markedly cheaper path (coarse grid / low count) so it degrades gracefully. Keep ABSOLUTE cost modest so even T2 is smooth in a tile.

## _sim-core API
`hash1(n)`, `hash2(i,salt)`, `shash(n)` → deterministic 0..1 / −1..1.
`clamp(v,lo,hi)`, `smoothstep(e0,e1,x)`, `dampExp(rate,dt)`.
`resolveSimTier(target): 'T0'|'T1'|'T2'`, `tierPick(tier,{T0,T1,T2})`.
`makeReplayStepper({dt, reset, step, maxSteps?}): { seekStep(t), reset(), now(), markDirty() }`.
`solveDistanceConstraint(px,py,pz,invMass,i,j,rest,alphaTilde)` — one XPBD distance constraint (flat arrays).
`complianceAlpha(stiffness01, dtSub)` — stiffness 0..1 → per-substep alphaTilde for the above.
`waveStep2D(h,v,N,c2,damp,dt)` / `waveStep1D(h,v,N,c2,damp,dt)` — explicit wave-equation height-field step.
`splat2D(h,N,cx,cy,radius,amount)` — smooth radial impulse onto a height grid (a drop/poke).

## XPBD recipe (cloth/rope/soft/springs)
- Particles as flat `px/py/pz` + `pvx/pvy/pvz` + `invMass` (0 = pinned). Per substep:
  1. integrate velocity (gravity) + predict positions; 2. solve all distance constraints once (Gauss-Seidel, fixed order) with `alphaTilde = complianceAlpha(stiffness, dtSub)`; 3. update velocities from `(p - pPrev)/dtSub`.
- Substep: e.g. 8 substeps of `dt/8`. Pin the corner(s)/top via invMass=0. This is the "small steps" XPBD the research recommends.

## Test shape (write `tests/editor-build/animatable/<name>.test.ts`)
1. `runConformance(xxxPrimitive).dispose();`
2. A "plays" test: seek across the timeline, assert genuine motion / a physical event (a bounce rebound, a splash crown, a settle).
3. A "control live at frozen pin" test: `inst.setControl('someControl', extreme); inst.seek(PIN);` twice with different values at the SAME pin, assert the output differs (proves markDirty works). Pick PIN mid-action.

## Anti-slop (advocate will BLOCK these)
- No featureless placeholder slabs. No square/1px sprites. No purple. Must read PHYSICAL: weight, momentum, collision, splash. Sharp at Retina. The effect must read as its claim to a non-technical user.
