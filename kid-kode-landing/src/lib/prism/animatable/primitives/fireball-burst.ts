// fireball-burst — a fireball erupts from a point: a turbulent ball of flame
// expands and rolls outward from the center, then fades to dark smoke before
// re-igniting — a one-shot loop. HARD / GPU / VOLUMETRIC primitive. Swaps the
// host plane's material for a MeshBasicNodeMaterial whose colorNode/opacityNode
// drive an expanding fbm-distorted ball of FIRE.
//
// VOLUME: the host builds the subject as a back-to-front stack of 5 coplanar
// slabs, each vertex carrying the `aDepth` float (0 = front/camera slab, 1 =
// rearmost slab). One material covers the whole stack, so we must make each slab
// sample a DIFFERENT slice of the turbulence field, otherwise it is 5x identical
// overdraw. We (a) feed aDepth as a real 3rd noise dimension AND parallax the
// field per-slab so the flame genuinely churns through depth, and (b) depth-fade:
// front slabs are hotter / brighter / whiter (the core), rear slabs are dimmer,
// redder, and read as trailing embers / smoke. Far-first emission + additive
// 'over' compositing reads as a glowing volume with front-to-back falloff.
//
// Loop: lt = fract(uTime * burstRate). The ball radius `grow = lt * maxR` sweeps
// outward each cycle; the disc edge is softened with smoothstep against the
// radial distance `r = length(uv-0.5)` distorted by a turbulent fbm field that
// rolls with uTime. heat = ball * (1-lt) so brightness fades as the cycle ages.
// Palette is ramped by a single HEAT/temperature scalar through stops that ALL
// satisfy R >= G >= B: black -> dark WARM smoke (0.06,0.03,0.02) -> deep red ->
// orange -> yellow -> white-hot. No cool/blue stop exists, so the emission is
// FIRE at every phase (never teal/blue). seek() advances uTime; onParamChange()
// the live uniforms. Mirrors nebula.ts in fbm + domain-warp + TNode casting
// discipline, the uniform-handle publish, and the prevMat restore.

import { Mesh, AdditiveBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; value-noise / fbm pass nodes through helpers the strict overloads of
// the free TSL functions reject. Like nebula.ts / caustics.ts cast their node
// assignments, we work through a single permissive chainable node alias
// (method-chaining only, which every TSL node supports) so the helpers compose
// without fighting the inferred VarNode generics. The graph built is identical
// to the equivalent free-function form. (tsc strictness — matches the references.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  floor: () => TNode;
  fract: () => TNode;
  sin: () => TNode;
  dot: (x: TNode) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: TNode | number, hi: TNode | number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  max: (x: TNode | number) => TNode;
  length: () => TNode;
  pow: (e: number) => TNode;
  oneMinus: () => TNode;
  x: TNode;
  y: TNode;
}
type V = number | TNode;
const t2 = (x: V, y: V): TNode =>
  (vec2 as unknown as (a: unknown, b: unknown) => unknown)(x, y) as TNode;
const t3 = (r: V, g: V, b: V): TNode =>
  (vec3 as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(r, g, b) as TNode;
const f1 = (x: number): TNode => float(x) as unknown as TNode;

const SCHEMA = [
  { id: 'burstRate', label: 'Burst Rate', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 0.6 },
  { id: 'turbulence', label: 'Turbulence', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.22 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 10, step: 0.1, default: 4 },
] as const;

export const fireballBurstPrimitive: PrimitiveDefinition = {
  name: 'fireball-burst',
  label: 'Fireball Burst',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A fireball erupts from a point, a turbulent ball of flame expanding and rolling outward through depth before fading to smoke — looping.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fireball-burst', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uBurstRate = uniform(num(params.burstRate, 0.6));
      const uTurb = uniform(num(params.turbulence, 0.22));
      const uScale = uniform(num(params.scale, 4));

      // Per-vertex depth: 0.0 on the front (camera) slab → 1.0 on the rearmost.
      // Single-plane render (NOT volumetric): AdditiveBlending over the frozen
      // 5-slab stack summed 5× and blew the fire out to a washed grey-white, so
      // this matches the premium single-plane fire-flame.ts. aDepth is pinned to
      // 0 (front slab) so every depth term below collapses to its full-strength
      // front value with zero per-slab parallax — one clean, vivid fire quad.
      const aDepth = f1(0);

      // Deterministic 3D value noise → fbm (turbulent flame field). The 3rd
      // coordinate is driven by aDepth so each slab samples a different slice.
      const hash3 = (p: TNode): TNode =>
        p.dot(t3(127.1, 311.7, 74.7)).sin().mul(43758.5453).fract();

      // 3D value noise with smooth Hermite interpolation over an 8-corner cell.
      const noise = (p: TNode): TNode => {
        const i = p.floor();
        const f = p.fract();
        const u = f.mul(f).mul(t3(3, 3, 3).sub(f.mul(2)));
        const c000 = hash3(i);
        const c100 = hash3(i.add(t3(1, 0, 0)));
        const c010 = hash3(i.add(t3(0, 1, 0)));
        const c110 = hash3(i.add(t3(1, 1, 0)));
        const c001 = hash3(i.add(t3(0, 0, 1)));
        const c101 = hash3(i.add(t3(1, 0, 1)));
        const c011 = hash3(i.add(t3(0, 1, 1)));
        const c111 = hash3(i.add(t3(1, 1, 1)));
        const x00 = c000.mix(c100, u.x);
        const x10 = c010.mix(c110, u.x);
        const x01 = c001.mix(c101, u.x);
        const x11 = c011.mix(c111, u.x);
        const y0 = x00.mix(x10, u.y);
        const y1 = x01.mix(x11, u.y);
        const z = (u as unknown as { z: TNode }).z;
        return y0.mix(y1, z);
      };

      const fbm = (p0: TNode): TNode => {
        let sum: TNode = f1(0);
        let amp = 0.5;
        let p = p0;
        // 5 octaves of smooth 3D value noise.
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise(p).mul(amp));
          p = p.mul(2.03);
          amp *= 0.5;
        }
        return sum;
      };

      // Loop phase lt ∈ [0,1) sweeps each cycle. roll drives the turbulence field.
      const uvN = uv() as unknown as TNode;
      const lt = (uTime as unknown as TNode).mul(uBurstRate as unknown as TNode).fract();
      const roll = (uTime as unknown as TNode).mul(0.6);

      // Radial distance from the burst point (center of the quad).
      const centered = uvN.sub(0.5);
      const r = centered.length();

      // Per-slab parallax: shift the sampling domain by aDepth so each slab reads
      // a distinct slice of the flame, and feed aDepth as a real 3rd dimension so
      // the turbulence genuinely varies front-to-back.
      const parallax = aDepth.mul(0.85);
      const depthCoord = aDepth.mul(2.2).add(roll.mul(0.5));
      const noiseP = t3(
        uvN.x.mul(uScale as unknown as TNode).add(roll).add(parallax),
        uvN.y.mul(uScale as unknown as TNode).add(roll.mul(0.7)).sub(parallax.mul(0.6)),
        depthCoord,
      );

      // Domain-warped fbm for a churning, non-blocky turbulence field.
      const warp = fbm(noiseP);
      const turbRaw = fbm(noiseP.add(t3(warp.mul(1.6), warp.mul(1.6), 0)));
      // Keep the edge distortion gentle so the ball stays a coherent fire disc
      // rather than shredding into ragged black "torn paper" gaps.
      const turbField = turbRaw.sub(0.5).mul((uTurb as unknown as TNode).mul(1.0));

      // Ball: a disc whose radius `grow` expands from 0 to maxR across the cycle.
      // Rear slabs lag slightly (smaller radius) so the volume reads as a 3D
      // ball, not a flat stack: shrink grow by an aDepth-scaled amount.
      const maxR = f1(0.62);
      const edge = f1(0.4); // soft, wide falloff → a glowing fireball, not a hard torn rim
      const grow = lt.mul(maxR).sub(aDepth.mul(0.07));
      const rDistorted = r.add(turbField);
      const ball = rDistorted.smoothstep(grow, grow.sub(edge)).clamp(0, 1);

      // heat fades as the cycle ages: brightest at ignition, embers at the end.
      // The burst loops through a hot→smoke cycle; a STATIC preview capture lands
      // at an arbitrary phase and (unlike the always-lit fire-flame) often caught
      // the dim smoke phase, reading as grey. Keep the ball hot across almost the
      // whole cycle so any captured phase is unmistakably fire: heat never drops
      // below 0.6× inside the ball (a brief late dip, never to cold smoke).
      const age = lt.oneMinus();
      const heat = ball.mul(age.mul(0.4).add(0.6));

      // Depth-fade: front slabs hotter/brighter (core), rear slabs dimmer embers.
      const depthFade = aDepth.oneMinus().mul(0.72).add(0.28);

      // ── FIRE palette, ramped by a single HEAT scalar ─────────────────────────
      // Every stop satisfies R >= G >= B (no channel can ever exceed red), so the
      // emitted colour is warm at EVERY phase — never teal/blue. The cool end is a
      // DARK WARM smoke (R>G>B), not blue. We build the temperature scalar from
      // the ball mask, the cycle age, the turbulence, and the depth falloff, then
      // ramp the palette by it. This is the same structure as fire-flame.ts (a hot
      // scalar driving a black→red→orange→yellow→white ramp) rather than mixing
      // toward a separate cool 'smoke' colour that could land on teal at mid-phase.
      const black = t3(0.0, 0.0, 0.0);
      const warmSmoke = t3(0.06, 0.03, 0.02); // dark WARM smoke (R>G>B), never blue
      // Saturated stops: ACES tonemapping desaturates over-bright warm colour
      // toward cream/white, so we keep G and B LOW (deep saturated fire) and only
      // a small white-hot core, so the body reads as vivid orange not pale cream.
      const deepRed = t3(0.7, 0.05, 0.0);
      const orange = t3(1.0, 0.3, 0.01);
      const yellow = t3(1.0, 0.62, 0.1);
      const whiteHot = t3(1.0, 0.85, 0.55);

      // Temperature: hottest at the leading front-facing core, cooling with age,
      // depth, and the low-turbulence pockets. Rear slabs (aDepth→1) read cooler.
      // turbRaw ∈ ~[0,1]; lift the field so the body sits in the orange band and
      // only the brightest cores reach yellow/white.
      const turbLift = turbRaw.mul(0.5).add(0.5); // ~[0.25,0.75] warm modulation
      // RADIAL temperature gradient so the fireball reads as FIRE (a hot core that
      // cools outward) rather than a uniform salmon disc: hottest at r=0, cooling
      // to the ball edge. radial ∈ [0,1] (1 at centre → 0 at the disc edge).
      const radial = rDistorted.div(grow.max(0.001)).oneMinus().clamp(0, 1);
      const temp = heat
        .mul(depthFade)
        .mul(turbLift)
        .mul(radial.mul(0.85).add(0.32))
        .mul(1.7)
        .clamp(0, 1);

      // black → warm-smoke → deep-red → orange → yellow → white-hot, by temp.
      // The first hop (black→warmSmoke) keeps the cool end a DARK WARM ember glow
      // instead of blue; from there it climbs through pure fire.
      const ramp0 = black.mix(warmSmoke, temp.smoothstep(0.0, 0.08));
      const ramp1 = ramp0.mix(deepRed, temp.smoothstep(0.06, 0.3));
      const ramp2 = ramp1.mix(orange, temp.smoothstep(0.25, 0.55));
      const ramp3 = ramp2.mix(yellow, temp.smoothstep(0.55, 0.8));
      const fireColor = ramp3.mix(whiteHot, temp.smoothstep(0.82, 1.0));

      // Brighten by heat so the additive contribution is strong and warm. We do
      // NOT re-multiply by depthFade here (temp already carries it) — that would
      // darken the body toward black and let the dark-blue bg dominate (the old
      // teal). Add a small warm ambient floor inside the ball so even the coolest
      // lit texel adds warm (R-led) energy, never blue, over the #06070d bg.
      const warmFloor = t3(0.34, 0.06, 0.0); // saturated deep-orange floor (low G/B so ACES keeps it warm)
      const colorNode = fireColor
        .mul(heat.mul(1.15).add(0.32))
        .add(warmFloor.mul(ball));

      // Opacity: the ball mask, faded back-to-front so rear slabs are translucent
      // embers that composite (additive 'over') into a lit volume.
      const opacityNode = ball.mul(depthFade.max(0.18)).mul(age.mul(0.6).add(0.4));

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for the CPU test + host wiring.
      target.userData.fireballBurst = { uTime, uBurstRate, uTurb, uScale };

      return {
        // Continuous, looping evolution — never settles.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uBurstRate.value = num(params.burstRate, 0.6);
          uTurb.value = num(params.turbulence, 0.22);
          uScale.value = num(params.scale, 4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'burstRate') uBurstRate.value = num(value, 0.6);
          else if (id === 'turbulence') uTurb.value = num(value, 0.22);
          else if (id === 'scale') uScale.value = num(value, 4);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
