// ink-bloom — a drop of ink blooms into water. HARD / GPU / volumetric smoke
// primitive. Swaps the host plane's material for a MeshBasicNodeMaterial whose
// density is a growing feathered blob centered on the plane, modulated by a
// domain-warped 5-octave fbm so the cloud unfurls with turbulent, curling
// tendrils. Because the host builds the subject as a 5-slab coplanar stack
// (volumetric: true), each slab reads its per-vertex `aDepth` (0 front → 1 rear)
// to parallax the noise domain and fade toward the back — so the bloom reads as
// a real diffusing VOLUME of ink, front-lit and self-occluding, not a flat
// dark-on-dark gradient. seek() advances uGrow 0->~0.92 (bloom radius) and uTime
// (turbulent unfurl clock); onParamChange() updates live uniforms. DISTINCT from
// ink-spread: this is a center-out diffusing cloud, not a directional spread.

import { Mesh, Color, NormalBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, attribute, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition, VOLUMETRIC_DEPTH_ATTR } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds, and value-noise / fbm pass nodes through helper functions that the
// strict overloads of the free TSL functions reject. Like nebula.ts / caustics.ts
// we work through a single permissive chainable node alias (method-chaining only,
// which every TSL node supports) so the helpers compose without fighting the
// inferred VarNode generics. The graph this builds is identical to the free-
// function form. (tsc strictness check — matches the reference's discipline.)
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
  pow: (e: number) => TNode;
  oneMinus: () => TNode;
  length: () => TNode;
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
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
  { id: 'turbulence', label: 'Turbulence', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.16 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 12, step: 0.1, default: 5 },
  { id: 'flow', label: 'Flow', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.6 },
  { id: 'tint', label: 'Ink', type: 'color', default: '#0b1124' },
] as const;

export const inkBloomPrimitive: PrimitiveDefinition = {
  name: 'ink-bloom',
  label: 'Ink Bloom',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  volumetric: true,
  defaultDriver: 'time',
  description:
    'A drop of ink blooms into water — a dark organic cloud unfurling and diffusing through depth with feathered, curling tendrils.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ink-bloom', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#0b1124'));

      const uGrow = uniform(0); // bloom radius 0 -> ~0.92
      const uTime = uniform(0); // turbulent unfurl clock
      const uTurb = uniform(num(params.turbulence, 0.16));
      const uScale = uniform(num(params.scale, 5));
      const uFlow = uniform(num(params.flow, 0.6));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Per-vertex slab depth: 0.0 front slab → 1.0 rearmost slab.
      const aDepth = attribute(VOLUMETRIC_DEPTH_ATTR) as unknown as TNode;

      // ── Deterministic 2D value-noise hash → smooth value noise → 5-octave fbm.
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
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise(p).mul(amp));
          p = p.mul(2.02);
          amp *= 0.5;
        }
        return sum;
      };

      const uTimeN = uTime as unknown as TNode;
      const uFlowN = uFlow as unknown as TNode;
      const uScaleN = uScale as unknown as TNode;
      const uTurbN = uTurb as unknown as TNode;
      const uGrowN = uGrow as unknown as TNode;

      const flowT = uTimeN.mul(uFlowN);

      // Per-slab parallax: each slab samples a different slice of the field so the
      // 5 coplanar quads do NOT collapse into identical overdraw — front slab is
      // shifted relative to the rear, giving real through-depth structure.
      const PARALLAX = 0.85;
      const slabShift = t2(aDepth.mul(PARALLAX), aDepth.mul(PARALLAX * 0.55));

      // Drift coordinate: scaled uv pushed by the flow clock + the slab offset.
      const baseUv = uv() as unknown as TNode;
      const p = baseUv
        .mul(uScaleN)
        .add(t2(flowT, flowT.mul(0.7)))
        .add(slabShift);

      // Domain-warped fbm: warp the sample point by an fbm at a drifted point so
      // the cloud edge curls and unfurls (premium nebula-style turbulence).
      const warp = t2(
        fbm(p.add(t2(flowT.mul(0.3), 1.7))),
        fbm(p.add(t2(8.3, flowT.mul(0.27).add(4.1)))),
      );
      const fbmField = fbm(p.add(warp.mul(uTurbN.mul(6).add(0.6))));

      // Distance from center, perturbed by the warped noise so the bloom edge is
      // feathered into turbulent tendrils. The warp magnitude scales with turb.
      const dist = baseUv.sub(t2(0.5, 0.5)).length();
      const d = dist.add(fbmField.sub(0.4375).mul(uTurbN));

      // density = 1 inside the growing radius, feathered to 0 just outside it.
      // smoothstep(uGrow, uGrow-edge, d): inverted edges so density is 1 when
      // d < uGrow-edge (inside the radius) and 0 when d > uGrow.
      const edge = f1(0.16);
      const density = smoothstep(
        uGrowN as never,
        uGrowN.sub(edge) as never,
        d as never,
      ) as unknown as TNode;

      // Add a fine wisp of the fbm field INTO the density so the interior is not a
      // flat disc but a turbulent, mottled ink cloud.
      const wisp = fbmField.smoothstep(0.35, 0.85).mul(0.5).add(0.5);
      const filled = density.mul(wisp);

      // Depth fade: rear slabs (aDepth→1) are fainter (density falloff) and a touch
      // darker (self-shadow), front slab (aDepth→0) reads brightest. This is what
      // makes the stack read as a lit volume with front-to-back occlusion.
      const depthFade = aDepth.oneMinus().mul(0.65).add(0.35); // 1.0 front → 0.35 rear
      const depthDark = aDepth.oneMinus().mul(0.4).add(0.6); // 1.0 front → 0.6 rear

      // Ink colour: base tint, brightened toward a luminous core where the cloud
      // is densest so it READS at tile size on the dark #06070d bg (was dark-on-
      // dark). A cool highlight rims the dense core; rear slabs are tinted darker.
      const baseCol = t3(uR as unknown as TNode, uG as unknown as TNode, uB as unknown as TNode);
      const coreGlow = filled.clamp(0, 1).pow(2.0); // hot interior
      const highlight = t3(0.42, 0.52, 0.85); // cool indigo bloom highlight
      const lit = baseCol
        .mul(1.6) // lift the ink off the background
        .add(highlight.mul(coreGlow.mul(0.9)))
        .mul(depthDark);

      const colorNode = lit;
      // Composited density: front-to-back fade + a touch of extra contrast.
      const alpha = filled.mul(depthFade).clamp(0, 1).pow(0.9);

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = alpha;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish live uniform handles to the shared scratch space (contract:
      // userData is "uniform handles, etc.") so the host/tests can observe.
      target.userData.inkBloom = { uGrow, uTime, uTurb, uScale, uFlow };

      // Bloom over the first ~3.6s; uGrow goes 0 -> ~0.92 then settles.
      const DURATION = 3.6;
      return {
        duration: () => DURATION,
        seek: (tt) => {
          uTime.value = tt * num(params.speed, 1);
          // grow phase 0..1 across the duration, eased toward a settled max.
          const ph = Math.min(Math.max(tt / DURATION, 0), 1);
          const grown = 1 - Math.pow(1 - ph, 2); // expo-ish ease-out
          uGrow.value = grown * 0.92;
          // live param reads (no rebuild)
          uTurb.value = num(params.turbulence, 0.16);
          uScale.value = num(params.scale, 5);
          uFlow.value = num(params.flow, 0.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'turbulence') uTurb.value = num(value, 0.16);
          else if (id === 'scale') uScale.value = num(value, 5);
          else if (id === 'flow') uFlow.value = num(value, 0.6);
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
