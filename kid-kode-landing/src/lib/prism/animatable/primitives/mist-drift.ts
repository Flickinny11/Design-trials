// mist-drift — a low, thin mist drifts slowly sideways across the scene: soft,
// near-transparent, ground-hugging haze. MEDIUM / GPU / VOLUMETRIC primitive
// (smoke). The host builds the plane subject as a back-to-front stack of 5
// coplanar slabs, each vertex carrying a per-slab `aDepth` float (0 front → 1
// rear). One MeshBasicNodeMaterial is swapped onto the whole stack; the shader
// reads `aDepth` so each slab samples a DIFFERENT slice of the haze field —
// turning what used to be 5× flat overdraw into a real drifting VOLUME with
// front-to-back parallax and density falloff.
//
// Field: domain-warped fbm (fbm of a point offset by another fbm) with smooth
// Hermite value-noise over 5 octaves — kills the old blocky low-res look. The
// warp + the noise domain are both displaced by `aDepth`, so the mist genuinely
// churns THROUGH depth rather than repeating. Rear slabs are faded and tinted a
// touch cooler/darker for self-shadowed density. Soft, low-contrast — calm
// ground-hugging haze, not a blown-out cloud.
//
// DISTINCT from `fog-roll` (a coherent advecting FRONT with a leading edge) and
// `dust-cloud` (discrete drifting motes): mist-drift is a CALM, ground-hugging
// haze with no front and no particles — a thin sheet that slips sideways and is
// densest along the floor of the frame.
//
// seek() advances the time uniform (continuous loop, duration Infinity).
// onParamChange() + live param reads keep the controls tweakable with no
// rebuild. Uniform handles are published on target.userData for CPU tests.

import { Mesh, type Material, NormalBlending } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, attribute } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition, VOLUMETRIC_DEPTH_ATTR } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds, and value-noise / fbm pass nodes through helper functions that the
// strict overloads of the free TSL functions reject. Like nebula.ts, we work
// through a single permissive chainable node alias (method-chaining only, which
// every TSL node supports) so the helpers compose without fighting the inferred
// VarNode generics. The graph this builds is identical to the equivalent
// free-function form. (tsc strictness — matches the reference's discipline.)
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
  oneMinus: () => TNode;
  max: (x: TNode | number) => TNode;
  min: (x: TNode | number) => TNode;
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

const SCHEMA = [
  { id: 'drift', label: 'Drift', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.12 },
  { id: 'density', label: 'Density', type: 'fader', min: 0, max: 0.5, step: 0.01, default: 0.28 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 8, step: 0.1, default: 3 },
] as const;

export const mistDriftPrimitive: PrimitiveDefinition = {
  name: 'mist-drift',
  label: 'Mist Drift',
  category: 'smoke',
  difficulty: 'medium',
  subject: 'plane',
  volumetric: true,
  defaultDriver: 'time',
  description:
    'A low, thin mist drifts slowly sideways across the scene — soft, near-transparent, ground-hugging haze with real front-to-back depth.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'mist-drift', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDrift = uniform(num(params.drift, 0.12));
      const uDensity = uniform(num(params.density, 0.28));
      const uScale = uniform(num(params.scale, 3));

      // Per-slab depth: 0.0 on the front (camera-facing) slab → 1.0 on the
      // rearmost slab. Constant within each slab, so each slab samples a
      // distinct slice of the field below.
      const aDepth = attribute(VOLUMETRIC_DEPTH_ATTR) as unknown as TNode;

      // ── smooth value-noise + fbm (pure TSL, deterministic) ───────────────
      // Sin-hash value noise with a proper Hermite (smoothstep) interpolant,
      // stacked over 5 octaves for a soft, wispy field with no blocky steps.
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();

      const noise = (p: TNode): TNode => {
        const i = p.floor();
        const f = p.fract();
        const w = f.mul(f).mul(f1(3).sub(f.mul(2))); // f*f*(3-2f)
        const a = hash(i);
        const b = hash(i.add(t2(1, 0)));
        const c = hash(i.add(t2(0, 1)));
        const d = hash(i.add(t2(1, 1)));
        const ab = a.mix(b, w.x);
        const cd = c.mix(d, w.x);
        return ab.mix(cd, w.y);
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

      const u = uv() as unknown as TNode;
      const t = uTime as unknown as TNode;
      const drift = uDrift as unknown as TNode;
      const scale = uScale as unknown as TNode;

      // Sideways drift: x carried by time*drift, a barely-perceptible vertical
      // seep (time*0.05) so the sheet feels alive without rising.
      const flow = t2(t.mul(drift), t.mul(0.05));

      // Depth parallax: each slab is pushed through the noise domain by aDepth,
      // so the front slab and the rear slab show genuinely different mist. Kept
      // SMALL (<=0.2) so the slabs decorrelate without introducing banding.
      const parallax = t2(aDepth.mul(0.2), aDepth.mul(0.12));
      const base = u.mul(scale).add(flow).add(parallax);

      // Domain warp: offset the sample point by an fbm sampled at a drifted,
      // depth-shifted point. This is what gives premium churn vs. flat bands.
      const wx = fbm(base.add(t2(t.mul(0.07), aDepth.mul(1.7))));
      const wy = fbm(base.add(t2(3.3, 1.7)).sub(t2(t.mul(0.05), aDepth.mul(1.3))));
      const warped = base.add(t2(wx, wy).mul(0.85));

      const fieldRaw = fbm(warped).clamp(0, 1);

      // Ground-hugging envelope: dense near the bottom (uv.y → 0), thinning to
      // nothing by mid-frame so the mist stays low and calm. Slightly softened
      // (raised top edge) so the volume reads, not a hard band.
      const env = u.y.smoothstep(0.72, 0.02);

      // Depth-fade: rear slabs fainter (self-shadow / density falloff). Floor
      // raised to >= 0.5 so the rear of the volume isn't near-black; still
      // front-weighted.
      const depthFade = aDepth.oneMinus().mul(0.5).add(0.5);

      // Low-contrast lift: pull the field toward a soft mid value so the haze
      // is calm and readable, never a high-contrast blocky blob. Widened lower
      // edge + a small additive floor so the haze body reads at tile size
      // instead of sitting near-black.
      const field = fieldRaw.smoothstep(0.1, 0.8).mul(0.82).add(0.18);

      // Low-alpha haze: field gated by the floor envelope and depth-fade,
      // scaled by density. Each slab contributes a thin layer; 5 'over'
      // composites build the soft volume. Ceiling lifted so the calm haze is
      // legible rather than vanishing into the dark bg.
      const density = uDensity as unknown as TNode;
      const alpha = field
        .mul(env)
        .mul(depthFade)
        .mul(density)
        .mul(1.5)
        .clamp(0, 0.6);

      // Soft, near-white-grey tint; very slightly cool so it reads as haze.
      // Brightened so the volume isn't near-black; rear slabs kept lighter too.
      const front = t3(0.96, 0.98, 1.0);
      const rear = t3(0.64, 0.7, 0.78);
      const colorNode = front.mix(rear, aDepth.mul(0.85)) as unknown;
      const opacityNode = alpha as unknown;

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for CPU-observable verification.
      target.userData.mistDriftUniforms = { uTime, uDrift, uDensity, uScale };

      return {
        // Continuous, calm drifting haze — runs off the time driver.
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.drift, 0.12);
          uDensity.value = num(params.density, 0.28);
          uScale.value = num(params.scale, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'drift') uDrift.value = num(value, 0.12);
          else if (id === 'density') uDensity.value = num(value, 0.28);
          else if (id === 'scale') uScale.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.mistDriftUniforms;
          mat.dispose();
        },
      };
    },
  ),
};
