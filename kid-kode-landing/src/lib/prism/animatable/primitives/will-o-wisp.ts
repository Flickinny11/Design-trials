// will-o-wisp — a glowing ghost-light VOLUME. HARD / volumetric primitive. The
// host builds the plane as a 5-slab back-to-front stack (volumetric:true), each
// vertex carrying an `aDepth` float (0 front → 1 rear). We swap the stack's one
// material for a MeshBasicNodeMaterial that, per slab, samples a DIFFERENT slice
// of a domain-warped fbm tendril field: the noise domain is parallaxed by aDepth
// and aDepth is fed as a real 3rd noise dimension, so the wisp reads as genuine
// depth rather than 5x flat overdraw. A soft luminous core sits over drifting
// wispy tendrils; rear slabs fade + darken so the halo recedes behind the core.
// The whole stack bobs via uTime. seek() advances uTime; controls (wisps,
// driftSpeed, glowSize) read live. Additive blend + depthWrite:false composites
// the far-first slabs as a glowing volume. Mirrors nebula.ts fbm/warp + TNode
// casting discipline.

import { Mesh, type Material, AdditiveBlending } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, cos, attribute } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const MAX_WISPS = 6;

// Deterministic per-wisp parameters from an index hash — no Math.random.
const hash = (i: number): number => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// TSL's per-call generics are narrower than the node graph they build; fbm/noise
// pass nodes through helpers that the strict overloads reject. Like nebula.ts we
// work through one permissive chainable alias (method-chaining only, supported by
// every TSL node) so the helpers compose without fighting inferred generics. The
// built graph is identical to the free-function form. (Keeps strict tsc at 0.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  floor: () => TNode;
  fract: () => TNode;
  sin: () => TNode;
  cos: () => TNode;
  dot: (x: TNode) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: number, hi: number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  oneMinus: () => TNode;
  pow: (e: number) => TNode;
  length: () => TNode;
  negate: () => TNode;
  exp: () => TNode;
  max: (x: TNode | number) => TNode;
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
  { id: 'wisps', label: 'Wisps', type: 'knob', min: 2, max: 6, step: 1, default: 4 },
  { id: 'driftSpeed', label: 'Drift Speed', type: 'knob', min: 0.1, max: 2.5, step: 0.05, default: 0.8 },
  { id: 'glowSize', label: 'Glow Size', type: 'knob', min: 0.05, max: 0.3, step: 0.01, default: 0.16 },
] as const;

export const willOWispPrimitive: PrimitiveDefinition = {
  name: 'will-o-wisp',
  label: "Will-o'-Wisp",
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  volumetric: true,
  defaultDriver: 'time',
  description:
    'A glowing ghost-light volume — a soft luminous core wreathed in wispy tendrils that drift and bob, its halo receding through depth like a marsh spirit.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'will-o-wisp', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDrift = uniform(num(params.driftSpeed, 0.8));
      const uGlow = uniform(num(params.glowSize, 0.16));
      // uCount gates each orb's contribution (1 active / 0 off) so the wisp count
      // is a live uniform with no rebuild.
      const uCount = uniform(num(params.wisps, 4));

      // Per-vertex depth (0 front slab → 1 rear slab); constant within each slab.
      const aDepth = attribute('aDepth') as unknown as TNode;

      const u = uv() as unknown as TNode;
      // Larger glowSize -> softer/wider orbs (smaller falloff).
      const falloff = (f1(1).div(uGlow as unknown as TNode)) as unknown as TNode;
      const driftT = (uTime as unknown as TNode).mul(uDrift as unknown as TNode);

      // --- domain-warped fbm tendril field (per nebula.ts) ---------------------
      const noiseHash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();

      const noise = (p: TNode): TNode => {
        const i = p.floor();
        const f = p.fract();
        const sm = f.mul(f).mul(f1(3).sub(f.mul(2))); // f*f*(3-2f)
        const a = noiseHash(i);
        const b = noiseHash(i.add(t2(1, 0)));
        const c = noiseHash(i.add(t2(0, 1)));
        const d = noiseHash(i.add(t2(1, 1)));
        return a.mix(b, sm.x).mix(c.mix(d, sm.x), sm.y);
      };

      const fbm = (p0: TNode): TNode => {
        let sum = f1(0);
        let amp = 0.5;
        let p = p0;
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise(p).mul(amp));
          p = p.mul(2.02);
          amp *= 0.5;
        }
        return sum;
      };

      // aDepth as a real 3rd noise dimension + a per-slab parallax shove so each
      // slab samples a DIFFERENT tendril slice (no flat overdraw).
      const depthOff = t2(aDepth.mul(0.9), aDepth.mul(-0.7));
      const dShift = t2(aDepth.mul(17.3), aDepth.mul(8.1)); // decorrelate per slab

      // Wispy tendrils: warp the sample point by a slow fbm, then sample density.
      const tendrilBase = u.mul(3.4).add(depthOff).add(dShift);
      const wx = fbm(tendrilBase.add(t2(driftT.mul(0.18), driftT.mul(0.11))));
      const wy = fbm(tendrilBase.add(t2(4.7, 2.1)).sub(t2(driftT.mul(0.14), driftT.mul(0.2))));
      const warp = t2(wx, wy);
      const tendril = fbm(tendrilBase.add(warp.mul(1.6)).add(t2(driftT.mul(0.07), 0)))
        .smoothstep(0.42, 0.92);

      // --- soft luminous core orbs --------------------------------------------
      // Accumulate orbs. `any` alias dodges narrow VarNode typing on reassign.
      let glow: any = float(0); // eslint-disable-line @typescript-eslint/no-explicit-any
      for (let k = 0; k < MAX_WISPS; k++) {
        const bx = -0.32 + hash(k * 3 + 1) * 0.64;
        const by = -0.32 + hash(k * 3 + 2) * 0.64;
        const sx = 0.5 + hash(k * 7 + 3) * 1.5;
        const sy = 0.5 + hash(k * 7 + 5) * 1.5;
        const range = 0.18 + hash(k * 11 + 7) * 0.22;
        const pulse = 1.0 + hash(k * 13 + 9) * 2.5;

        // gentle whole-volume bob + per-orb wander; rear slabs parallax-shifted.
        const cx = f1(bx).add(driftT.mul(sx).sin().mul(range));
        const cy = f1(by)
          .add(driftT.mul(sy).cos().mul(range))
          .add((uTime as unknown as TNode).mul(0.6).sin().mul(0.05)); // gentle global bob
        const center = vec2(cx as unknown as never, cy as unknown as never);

        const parallax = (depthOff as unknown as { mul: (n: number) => unknown }).mul(0.18);
        const d = (u as unknown as { sub: (c: unknown) => TNode })
          .sub((center as unknown as { add: (p: unknown) => unknown }).add(parallax))
          .length();
        const bob = float(0.6).add(sin(uTime.mul(pulse)).mul(0.4));
        const orb = (d.mul(falloff).negate() as unknown as TNode).exp().mul(bob as unknown as TNode);
        const active = (uCount as unknown as TNode).sub(f1(k + 0.5)).clamp(0, 1);

        glow = glow.add(orb.mul(active as unknown as TNode));
      }

      // Combine bright core orbs with the wispy tendril haze. Lifted so the
      // ghost-light core glow and its tendrils clearly read at tile size.
      const coreGlow = (glow as TNode).max(0).mul(1.6);
      const field = coreGlow.add(coreGlow.mul(tendril).mul(0.7)).add(tendril.mul(0.3));

      // Depth-fade: rear slabs fainter (halo recedes) and slightly cooler/darker
      // so the stack reads as a lit volume with front-to-back occlusion. Floor
      // raised so the rear halo isn't near-black.
      const depthFade = aDepth.oneMinus().mul(0.55).add(0.45);
      const opacity = field.mul(depthFade).mul(1.25).clamp(0, 1);

      // Pale cyan/green core, greener soft halo, rear slabs tinted darker.
      const core = t3(0.66, 1.0, 0.88);
      const halo = t3(0.26, 0.78, 0.5);
      const litTint = halo.mix(core, opacity);
      // rear slabs lean toward a deep teal so depth reads as cooler shadow.
      const rearTint = t3(0.12, 0.42, 0.34);
      const tinted = litTint.mix(rearTint, aDepth.mul(0.55));
      const colorNode = tinted.mul(field.clamp(0, 1).add(0.5)).mul(1.3);

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacity;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniform handles on the shared scratch space (host can drive
      // them; tests observe the advancing clock without reaching into pixels).
      target.userData.wispUniforms = { uTime, uDrift, uGlow, uCount };

      return {
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.driftSpeed, 0.8);
          uGlow.value = clamp(num(params.glowSize, 0.16), 0.05, 0.3);
          uCount.value = clamp(num(params.wisps, 4), 2, MAX_WISPS);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'driftSpeed') uDrift.value = num(value, 0.8);
          else if (id === 'glowSize') uGlow.value = clamp(num(value, 0.16), 0.05, 0.3);
          else if (id === 'wisps') uCount.value = clamp(num(value, 4), 2, MAX_WISPS);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
