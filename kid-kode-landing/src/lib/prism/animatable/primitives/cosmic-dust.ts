// cosmic-dust — vast clouds of cosmic dust drift through starlight: a soft-lit
// nebular haze layered with distant pinprick stars. HARD / GPU / volumetric
// primitive. Swaps the host plane's material for a MeshBasicNodeMaterial whose
// colorNode shades drifting fbm haze through a soft cosmic palette (deep blue ->
// teal -> magenta) via smoothstep bands, and whose opacityNode = cloud + stars
// (a hashed faint star field that twinkles slightly). seek() advances uTime
// slowly; onParamChange() updates the live drift/scale/starDensity uniforms.
// Mirrors nebula.ts / caustics.ts in structure, casting, and material restore.
//
// DISTINCT from nebula (denser churning plasma, no stars) and clouds (white
// cumulus over blue sky): cosmic-dust is soft, deep, and sparsely lit, with an
// overlaid pinprick star field — a nebular dust cloud, not plasma or cumulus.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; helper functions that thread nodes through fbm/hash trip the strict
// overloads. Like nebula.ts, we work through a single permissive chainable node
// alias (method-chaining only, which every TSL node supports) so the helpers
// compose without fighting the inferred VarNode generics. The graph this builds
// is identical to the equivalent free-function form. (tsc strictness check —
// matches the references' casting discipline.)
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
  smoothstep: (lo: number | TNode, hi: number | TNode) => TNode;
  step: (edge: number | TNode) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  pow: (e: number) => TNode;
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
  { id: 'drift', label: 'Drift', type: 'knob', min: 0.01, max: 0.6, step: 0.01, default: 0.12 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 8, step: 0.1, default: 3 },
  { id: 'starDensity', label: 'Star Density', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
] as const;

export const cosmicDustPrimitive: PrimitiveDefinition = {
  name: 'cosmic-dust',
  label: 'Cosmic Dust',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Vast clouds of cosmic dust drift through starlight, soft lit nebular haze layered with distant pinprick stars.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'cosmic-dust', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDrift = uniform(num(params.drift, 0.12));
      const uScale = uniform(num(params.scale, 3));
      const uStarDensity = uniform(num(params.starDensity, 0.5));

      // Publish handles so the host (and the CPU test) can observe .value.
      target.userData.cosmicDust = { uTime, uDrift, uScale, uStarDensity };

      // Deterministic 2D value-noise hash → smooth value noise → fbm. All node
      // expressions, so the chain compiles under the WebGPU node material.
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();

      const noise = (p: TNode): TNode => {
        const i = p.floor();
        const f = p.fract();
        // smooth Hermite interpolant: f*f*(3-2f)
        const u = f.mul(f).mul(f1(3).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(t2(1, 0)));
        const c = hash(i.add(t2(0, 1)));
        const d = hash(i.add(t2(1, 1)));
        const ab = a.mix(b, u.x);
        const cd = c.mix(d, u.x);
        return ab.mix(cd, u.y);
      };

      const fbm = (p0: TNode): TNode => {
        let sum: TNode = f1(0);
        let amp = 0.5;
        let p = p0;
        // 5 octaves of value noise → soft, layered haze
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise(p).mul(amp));
          p = p.mul(2.02);
          amp *= 0.5;
        }
        return sum;
      };

      const uTimeN = uTime as unknown as TNode;
      const uDriftN = uDrift as unknown as TNode;
      const uScaleN = uScale as unknown as TNode;
      const uStarN = uStarDensity as unknown as TNode;

      const uvN = uv() as unknown as TNode;
      const t = uTimeN; // slow master clock (seek advances uTime slowly)

      // Drifting nebular haze: sample fbm at scaled uv offset by a slow drift —
      // mostly horizontal (uTime*drift) with a gentle vertical creep (uTime*0.1).
      const drift = t2(t.mul(uDriftN), t.mul(0.1));
      const hazeP = uvN.mul(uScaleN).add(drift);
      const cloudRaw = fbm(hazeP).clamp(0, 1);

      // Soft 2-3 color cosmic palette: deep blue -> teal -> magenta, banded via
      // smoothstep on the haze density.
      const deepBlue = t3(0.05, 0.09, 0.26);
      const teal = t3(0.10, 0.42, 0.5);
      const magenta = t3(0.55, 0.16, 0.5);
      const loBand = deepBlue.mix(teal, cloudRaw.smoothstep(0.3, 0.62));
      const palette = loBand.mix(magenta, cloudRaw.smoothstep(0.58, 0.9));

      // Keep it soft + deep: gentle internal glow where density peaks, no hard
      // cores (that would read as plasma, not dust).
      const glow = cloudRaw.pow(2.0).mul(0.5);
      const cloudColor = palette.mul(cloudRaw.mul(0.8).add(0.25)).add(t3(glow.mul(0.4), glow.mul(0.5), glow.mul(0.6)));

      // Faint star field: hash a coarse cell grid, step on the hash so only the
      // brightest cells light up (gated by starDensity), and twinkle each star
      // slightly over time via a per-cell sine phase.
      const starCell = uvN.mul(uScaleN.mul(28)).add(t2(2.7, 9.1));
      const starId = starCell.floor();
      const starHash = hash(starId);
      // threshold: higher starDensity → lower edge → more stars survive the step.
      const starEdge = f1(0.985).sub(uStarN.mul(0.05));
      const starHit = starHash.step(starEdge);
      // per-star twinkle: a slow sine in [0.35, 1] keyed off the cell hash phase.
      const twPhase = starHash.mul(6.2831).add(t.mul(2.0));
      const twinkle = twPhase.sin().mul(0.5).add(0.5).mul(0.65).add(0.35);
      const stars = starHit.mul(twinkle).mul(uStarN.mul(0.6).add(0.4));

      const colorNode = cloudColor.add(t3(stars, stars, stars.mul(1.1)));
      // opacityNode = cloud + stars (soft haze body plus pinprick stars).
      const opacityNode = cloudRaw.mul(0.85).add(stars).clamp(0, 1);

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Continuous, stateful drift — never settles.
        duration: () => Infinity,
        seek: (tt) => {
          // Advance uTime slowly so the dust drifts gently rather than racing.
          uTime.value = tt * 0.25;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.drift, 0.12);
          uScale.value = num(params.scale, 3);
          uStarDensity.value = num(params.starDensity, 0.5);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'drift') uDrift.value = num(value, 0.12);
          else if (id === 'scale') uScale.value = num(value, 3);
          else if (id === 'starDensity') uStarDensity.value = num(value, 0.5);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.cosmicDust;
        },
      };
    },
  ),
};
