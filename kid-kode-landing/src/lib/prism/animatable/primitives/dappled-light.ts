// dappled-light — warm sunlight filtering through a leaf canopy: bright caustic
// blotches of dappled sun drift and shimmer across the surface while cool
// leaf-shadow pools between them. HARD / caustics primitive. Swaps the host
// plane's material for a MeshBasicNodeMaterial whose colorNode builds the dapple
// from a layered field: a domain-warped fbm canopy multiplied by an animated
// worley-cellular "light pool" pattern, thresholded through a soft smoothstep
// (lo..hi gap = contrast) and mapped to a warm dappled-sunlight palette.
//
// DISTINCT from caustics (sharp, bright filaments): this is soft, drifting
// leaf-shadow dapple — wide warm sun-blotches over cool shade, gentle motion.
//
// Uniform handles are published on target.userData so the CPU conformance test
// can observe a concrete .value change across the timeline (headless has no GPU
// to read pixels from).

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, min } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; like nebula.ts we work through a single permissive chainable node
// alias (method-chaining only, which every TSL node supports) so the noise /
// worley helpers compose without fighting the inferred VarNode generics. The
// graph this builds is identical to the equivalent free-function form. (tsc
// strictness check — matches nebula.ts casting discipline.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  floor: () => TNode;
  fract: () => TNode;
  sin: () => TNode;
  cos: () => TNode;
  abs: () => TNode;
  dot: (x: TNode) => TNode;
  length: () => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: TNode | number, hi: TNode | number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
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
const minN = (a: TNode, b: TNode): TNode =>
  (min as unknown as (a: unknown, b: unknown) => unknown)(a, b) as TNode;

const SCHEMA = [
  { id: 'drift', label: 'Drift', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.25 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 2, max: 10, step: 0.1, default: 4 },
  { id: 'contrast', label: 'Contrast', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
] as const;

export const dappledLightPrimitive: PrimitiveDefinition = {
  name: 'dappled-light',
  label: 'Dappled Light',
  category: 'caustics',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Warm sunlight filters through leaves, bright caustic blotches of dappled sun drifting over cool leaf-shadow like a forest canopy.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'dappled-light', category: 'caustics', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDrift = uniform(num(params.drift, 0.25));
      const uScale = uniform(num(params.scale, 4));
      // contrast widens/narrows the smoothstep lo..hi gap around the midpoint.
      const uLo = uniform(0.5 - num(params.contrast, 0.5) * 0.45);
      const uHi = uniform(0.5 + num(params.contrast, 0.5) * 0.45);

      // Publish handles so the host (and the CPU test) can read/observe them.
      target.userData.uTime = uTime;
      target.userData.uDrift = uDrift;
      target.userData.uScale = uScale;
      target.userData.uLo = uLo;
      target.userData.uHi = uHi;

      // Deterministic 2D value-noise hash → smooth value noise → fbm.
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();

      // Vector hash for worley feature points (one cell → a jittered point).
      const hash2 = (p: TNode): TNode => {
        const a = p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();
        const b = p.dot(t2(269.5, 183.3)).sin().mul(43758.5453).fract();
        return t2(a, b);
      };

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

      // 5-octave fbm for organic, soft leaf-canopy structure.
      const fbm = (p0: TNode): TNode => {
        let sum = f1(0);
        let amp = 0.5;
        let p = p0;
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise(p).mul(amp));
          p = p.mul(2.03);
          amp *= 0.5;
        }
        return sum;
      };

      // Animated worley / cellular distance field — the moving "light pools".
      // For the cell containing q and its 8 neighbours, find the nearest
      // jittered, time-animated feature point. Inverting the distance gives
      // bright caustic blobs that drift and pulse. 9-tap unrolled (cheap, GPU).
      const worley = (q: TNode, tt: TNode): TNode => {
        const ip = q.floor();
        const fp = q.fract();
        let dmin = f1(8);
        const offs: Array<[number, number]> = [
          [-1, -1], [0, -1], [1, -1],
          [-1, 0], [0, 0], [1, 0],
          [-1, 1], [0, 1], [1, 1],
        ];
        for (const [ox, oy] of offs) {
          const cell = ip.add(t2(ox, oy));
          // animate each feature point on a per-cell phase so pools shimmer.
          const rnd = hash2(cell);
          const phase = rnd.mul(6.2831853);
          const wob = t2(
            tt.add(phase.x).sin().mul(0.5).add(0.5),
            tt.add(phase.y).cos().mul(0.5).add(0.5),
          );
          const fpt = t2(ox, oy).add(wob);
          const diff = fpt.sub(fp);
          const dist = diff.length();
          dmin = minN(dmin, dist);
        }
        return dmin;
      };

      // Canopy drift: horizontal sway + a slower vertical bob.
      const tt = (uTime as unknown as TNode).mul(uDrift as unknown as TNode);
      const drift = t2(tt, (uTime as unknown as TNode).mul(0.2));
      const base = (uv() as unknown as TNode).mul(uScale as unknown as TNode).add(drift);

      // Domain-warp the canopy fbm by a second fbm so blotches feel organic and
      // never grid-aligned (the gold-standard nebula trick).
      const warp = t2(
        fbm(base.add(t2(tt.mul(0.3), 1.7))),
        fbm(base.add(t2(4.4, tt.mul(0.25)))),
      );
      const canopy = fbm(base.add(warp.mul(1.6)));

      // Worley light-pools at a slightly larger scale, drifting on their own
      // clock for parallax against the canopy. d small = pool centre = bright.
      const wq = (uv() as unknown as TNode)
        .mul((uScale as unknown as TNode).mul(0.6))
        .add(t2(tt.mul(0.7), tt.mul(0.5)));
      const pools = worley(wq, (uTime as unknown as TNode).mul(0.9))
        .smoothstep(0.0, 0.55) // distance → 0 at centre, 1 at edge
        .oneMinus(); // invert: 1 at pool centre (bright sun), 0 between

      // Combine: the canopy gates the worley pools (light only passes where the
      // leaves part), then square the pools for tighter, brighter caustic cores.
      const field = canopy.mul(0.55).add(pools.pow(1.6).mul(0.75));

      // Soft bright patches and shadows via the contrast-driven smoothstep.
      const dapple = field.smoothstep(
        uLo as unknown as TNode,
        uHi as unknown as TNode,
      );

      // Warm dappled-sunlight palette: deep cool leaf-shade → mossy mid →
      // warm sun → hot golden caustic core. Three-stop ramp keyed on dapple.
      const shade = t3(0.04, 0.09, 0.06); // cool forest-floor shadow
      const moss = t3(0.16, 0.26, 0.12); // dappled leaf-green midtone
      const sun = t3(1.0, 0.86, 0.5); // warm sunlight
      const lo = shade.mix(moss, dapple.smoothstep(0.0, 0.45));
      let col = lo.mix(sun, dapple.smoothstep(0.4, 0.9));

      // Hot golden bloom where the brightest pools punch through — gives the
      // caustic sparkle a premium, lit-from-behind feel without blowing out.
      const core = dapple.clamp(0, 1).pow(3.5).mul(0.9);
      col = col.add(t3(core, core.mul(0.8), core.mul(0.45)));

      const colorNode = col;

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => Infinity,
        seek: (ttSeek) => {
          uTime.value = ttSeek;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.drift, 0.25);
          uScale.value = num(params.scale, 4);
          const c = num(params.contrast, 0.5);
          uLo.value = 0.5 - c * 0.45;
          uHi.value = 0.5 + c * 0.45;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'drift') uDrift.value = num(value, 0.25);
          else if (id === 'scale') uScale.value = num(value, 4);
          else if (id === 'contrast') {
            const c = num(value, 0.5);
            uLo.value = 0.5 - c * 0.45;
            uHi.value = 0.5 + c * 0.45;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.uTime;
          delete target.userData.uDrift;
          delete target.userData.uScale;
          delete target.userData.uLo;
          delete target.userData.uHi;
        },
      };
    },
  ),
};
