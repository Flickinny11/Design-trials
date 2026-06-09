// wispy-smoke — thin curling wisps of smoke that rise and dissipate, slower and
// softer than billowing smoke. HARD / GPU / VOLUMETRIC primitive. The host builds
// the plane subject as a back-to-front stack of 5 coplanar slabs (one Mesh) and
// carries a per-vertex `aDepth` float (0 = front, 1 = rearmost). We swap the
// material for a transparent MeshBasicNodeMaterial whose color + alpha come from a
// domain-warped fbm (nebula-grade: 5 octaves, smooth Hermite interp, warped by a
// second fbm) sampled with the uv ADVECTED UPWARD and a HORIZONTAL CURL. aDepth
// parallaxes the field per slab (genuine 3rd noise dimension + a domain offset) so
// the 5 slabs sample DIFFERENT slices of curling smoke, and depth-fades/darkens
// rear slabs so the stack reads as a lit volume with front-to-back occlusion —
// front denser, rear wispier. NormalBlending (smoke, not energy). Distinct from
// smoke.ts: curling thin filaments that thin out toward the TOP as they rise.

import { Mesh, Color, NormalBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, attribute } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';
import { VOLUMETRIC_DEPTH_ATTR } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; value-noise / fbm pass nodes through helper functions that the strict
// overloads of the free TSL functions reject. Like nebula.ts we work through one
// permissive chainable node alias (method-chaining only, which every TSL node
// supports) so the helpers compose without fighting the inferred VarNode generics.
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
  max: (x: TNode | number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  smoothstep: (lo: number, hi: number) => TNode;
  oneMinus: () => TNode;
  pow: (e: number) => TNode;
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
  { id: 'rise', label: 'Rise', type: 'knob', min: 0, max: 1.5, step: 0.05, default: 0.4 },
  { id: 'curl', label: 'Curl', type: 'knob', min: 0, max: 1.5, step: 0.05, default: 0.5 },
  { id: 'density', label: 'Density', type: 'knob', min: 0, max: 1.5, step: 0.05, default: 0.5 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#b8bccb' },
] as const;

export const wispySmokePrimitive: PrimitiveDefinition = {
  name: 'wispy-smoke',
  label: 'Wispy Smoke',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  volumetric: true,
  defaultDriver: 'time',
  description:
    'Thin curling wisps of smoke rise and dissipate through real depth, slower and softer than billowing smoke.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'wispy-smoke', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#b8bccb'));

      const uTime = uniform(0);
      const uRise = uniform(num(params.rise, 0.4));
      const uCurl = uniform(num(params.curl, 0.5));
      const uDensity = uniform(num(params.density, 0.5));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Publish uniform handles so the host (and CPU tests) can read live state.
      target.userData.wispySmoke = { uTime, uRise, uCurl, uDensity };

      // Per-vertex depth: 0 on the front (camera-facing) slab → 1 on the rearmost.
      const aDepth = attribute(VOLUMETRIC_DEPTH_ATTR) as unknown as TNode;

      // ── value-noise → fbm (nebula-grade: deterministic hash, smooth Hermite) ──
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
        let sum = f1(0);
        let amp = 0.5;
        let p = p0;
        // 5 octaves of value noise for smooth, non-blocky structure.
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise(p).mul(amp));
          p = p.mul(2.02);
          amp *= 0.5;
        }
        return sum;
      };

      const uTimeN = uTime as unknown as TNode;
      const uRiseN = uRise as unknown as TNode;
      const uCurlN = uCurl as unknown as TNode;
      const uDensityN = uDensity as unknown as TNode;

      const coord = uv() as unknown as TNode;

      // Per-slab parallax: each slab (distinct aDepth) gets shifted into a DIFFERENT
      // slice of the field, so the 5 coplanar slabs are not identical overdraw.
      const parallax = aDepth.mul(0.85);

      // Advect the sample upward (rise) — subtracting from y scrolls the field down
      // so wisps appear to climb. Rear slabs lag slightly for a sheared plume.
      const advectedY = coord.y.add(uTimeN.mul(uRiseN)).add(parallax.mul(0.35));
      // Horizontal curl: serpentine the column with a sine of (uv.y*k + time),
      // phase-offset per slab so tendrils swirl in depth, not in lockstep.
      const k = f1(6.0);
      const curlOffset = (sin as unknown as (x: TNode) => TNode)(
        coord.y.mul(k).add(uTimeN).add(aDepth.mul(2.1)),
      ).mul(uCurlN.mul(0.18));
      const curledX = coord.x.add(curlOffset).add(parallax.mul(0.5));

      const base = t2(curledX.mul(2.4), advectedY.mul(2.4));

      // Domain-warp the fbm (sample fbm at a point offset by another fbm) — the
      // nebula gold-standard that kills blocky low-res value noise. Drift the warp
      // in time and through depth so curls evolve and differ slab-to-slab.
      const t = uTimeN.mul(uRiseN);
      const wx = fbm(base.add(t2(t.mul(0.2), t.mul(0.13))).add(aDepth.mul(1.7)));
      const wy = fbm(base.add(t2(4.4, 2.1)).sub(t2(t.mul(0.15), t.mul(0.22))));
      const warp = t2(wx, wy);

      const warped = base.add(warp.mul(1.4));
      // Final density field; the aDepth term genuinely varies the structure with
      // depth (a real 3rd noise dimension), not just a 2D offset.
      const f = fbm(warped.add(t2(0, t.mul(0.5))).add(aDepth.mul(0.9)));

      // Thin the field into wisps: sharpen and bias low so only filaments show.
      const filament = f.sub(0.46).max(f1(0)).mul(2.7);

      // Alpha fades toward the TOP (uv.y == 1): wisps dissipate as they rise.
      const fadeTop = coord.y.oneMinus().clamp(0, 1);

      // Depth-fade: rear slabs (aDepth→1) are fainter for density falloff and a
      // self-shadowed front-to-back read. depthFade: 1.0 front → 0.32 rear.
      const depthFade = aDepth.oneMinus().mul(0.68).add(0.32);

      const amount = filament.mul(uDensityN).mul(fadeTop).mul(depthFade);

      // Soft grey; lighten faintly where the wisp is densest, and tint rear slabs a
      // touch darker so the stack occludes convincingly (lit-volume read).
      const depthTint = aDepth.oneMinus().mul(0.22).add(0.78); // 1.0 front → 0.78 rear
      const colorNode = t3(uR as unknown as TNode, uG as unknown as TNode, uB as unknown as TNode)
        .mul(depthTint)
        .add(t3(0.06, 0.06, 0.07).mul(amount));
      const opacityNode = amount.clamp(0, 0.78);

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Stateful, continuously drifting wisps — runs off the time driver.
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uRise.value = num(params.rise, 0.4);
          uCurl.value = num(params.curl, 0.5);
          uDensity.value = num(params.density, 0.5);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rise') uRise.value = num(value, 0.4);
          else if (id === 'curl') uCurl.value = num(value, 0.5);
          else if (id === 'density') uDensity.value = num(value, 0.5);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.wispySmoke;
          mat.dispose();
        },
      };
    },
  ),
};
