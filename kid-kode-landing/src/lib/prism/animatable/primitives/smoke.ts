// smoke — a column of soft, rising grey-blue smoke with REAL volume. HARD / GPU
// / volumetric primitive. The host builds the plane subject as a 5-slab coplanar
// stack (volumetric:true), each vertex carrying an `aDepth` attribute (0 front →
// 1 rear). We swap the host plane's material for ONE MeshBasicNodeMaterial whose
// colorNode + opacityNode evaluate a multi-octave, domain-warped fbm that drifts
// upward over a uTime uniform and is SLICED THROUGH DEPTH by aDepth: each slab
// parallaxes into a different slice of the noise field and a 3rd noise dimension,
// so the stack reads as a true volume (front dense, rear faint, gentle curl)
// rather than 5× identical overdraw. seek() advances uTime; onParamChange()
// updates live speed/density/rise/tint uniforms. Mirrors nebula.ts in fbm /
// domain-warp / TNode casting / material-restore discipline.

import { Mesh, Color, NormalBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, attribute } from 'three/tsl';
import { defineAnimatable } from '../base';
import {
  num,
  str,
  VOLUMETRIC_DEPTH_ATTR,
  type ControlValue,
  type PrimitiveDefinition,
} from '../contract';

// See nebula.ts: TSL's per-call generic typing is far narrower than the runtime
// node graph it builds, so fbm/value-noise helpers that pass nodes through
// functions trip the strict overloads. We compose through one permissive
// chainable node alias (method-chaining only, which every TSL node supports) so
// the helpers compose without fighting the inferred VarNode generics. The graph
// is identical to the free-function form. (tsc strictness — matches nebula.ts.)
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
  smoothstep: (lo: number, hi: number) => TNode;
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

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 0.5 },
  { id: 'density', label: 'Density', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  { id: 'rise', label: 'Rise', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#9aa6c8' },
] as const;

export const smokePrimitive: PrimitiveDefinition = {
  name: 'smoke',
  label: 'Smoke',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  volumetric: true,
  defaultDriver: 'time',
  description:
    'A column of soft grey-blue smoke with real volume: domain-warped fbm rises and curls, front slabs dense, rear slabs faint.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'smoke', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#9aa6c8'));

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 0.5));
      const uDensity = uniform(num(params.density, 1));
      const uRise = uniform(num(params.rise, 1));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Per-vertex depth carried by the volumetric slab stack: 0 front → 1 rear.
      const aDepth = attribute(VOLUMETRIC_DEPTH_ATTR) as unknown as TNode;

      // ── Deterministic value-noise → fbm (smooth Hermite blend) ─────────────
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();

      const noise = (p: TNode): TNode => {
        const i = p.floor();
        const f = p.fract();
        const u = f.mul(f).mul(f1(3).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(t2(1, 0)));
        const c = hash(i.add(t2(0, 1)));
        const d = hash(i.add(t2(1, 1)));
        const ab = a.mix(b, u.x);
        const cd = c.mix(d, u.x);
        return ab.mix(cd, u.y);
      };

      // 5-octave fbm — enough octaves + smooth interp to kill the blocky tiling.
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

      const uvN = uv() as unknown as TNode;
      const drift = (uTime as unknown as TNode).mul(uSpeed as unknown as TNode);

      // Depth slices the field two ways for real volume:
      //  1) parallax — each rear slab is pushed further into the rising column,
      //  2) a 3rd noise dimension — aDepth shifts the domain so slabs differ.
      const depthSlice = aDepth.mul(0.9);
      const depth3 = aDepth.mul(4.7);

      // Base coordinate: scroll upward (rising plume), scale into noise domain,
      // parallax-offset rear slabs so they trail behind the front.
      const baseX = uvN.x.mul(3.0).add(depth3);
      const baseY = uvN.y.mul(3.4).sub(drift).sub(depthSlice);
      const u0 = t2(baseX, baseY);

      // Domain warp: offset the sample point by an fbm sampled at a drifted point
      // → churning, curling structure instead of straight vertical streaks.
      const wx = fbm(u0.add(t2(drift.mul(0.18), depth3)));
      const wy = fbm(u0.add(t2(2.7, 5.1)).sub(t2(0, drift.mul(0.22))));
      const curl = uRise as unknown as TNode;
      const warped = u0.add(t2(wx.sub(0.5), wy.sub(0.5)).mul(curl.mul(0.9).add(0.4)));

      // Smoke density from the warped fbm, biased so it reads as soft puffs.
      const raw = fbm(warped.add(t2(0, drift.mul(0.12)))).smoothstep(0.18, 0.92);

      // Denser toward the base of the column (uv.y == 0); rise lifts the falloff.
      const baseFalloff = f1(1).sub(uvN.y).pow(1).clamp(0, 1);
      const liftedFalloff = baseFalloff.mix(f1(1), (curl.mul(0.0)).add(0.15));

      // Depth fade: front slabs full strength, rear slabs faint (self-shadowing
      // density falloff through the volume). 0.3 floor keeps the rear readable.
      const depthFade = aDepth.oneMinus().mul(0.7).add(0.3);

      const density = raw
        .mul(uDensity as unknown as TNode)
        .mul(liftedFalloff)
        .mul(depthFade)
        .clamp(0, 1);

      // Soft grey-blue tint; brighten gently with puff density, tint rear slabs a
      // touch darker so the stack reads as a lit volume with front-to-back depth.
      const tint = t3(uR as unknown as TNode, uG as unknown as TNode, uB as unknown as TNode);
      const lit = tint.add(t3(0.06, 0.07, 0.1).mul(density));
      const depthDarken = aDepth.mul(0.28).oneMinus(); // 1 front → 0.72 rear
      const colorNode = lit.mul(depthDarken);

      const opacityNode = density;

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending, // smoke/cloud → painter 'over' composite
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for the CPU test + host wiring.
      target.userData.smoke = { uTime, uSpeed, uDensity, uRise, uR, uG, uB };

      return {
        // Stateful drifting haze — runs continuously off the time driver.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 0.5);
          else if (id === 'density') uDensity.value = num(value, 1);
          else if (id === 'rise') uRise.value = num(value, 1);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
