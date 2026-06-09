// fog — rolling VOLUMETRIC fog banks drift sideways across a 5-slab plane stack.
// HARD / GPU / volumetric primitive. The host builds the subject as a single
// Mesh of 5 coplanar quads (z 0 → -0.62), each vertex carrying the `aDepth`
// attribute (0 front → 1 rear). We swap the material for a MeshBasicNodeMaterial
// whose colorNode/opacityNode evaluate a domain-warped fbm fog field, but each
// slab samples a DIFFERENT slice of that field: aDepth parallaxes the noise
// domain AND drives the drift rate, so the five slabs read as genuine fog banks
// at varying depths rather than 5× identical overdraw. Rear slabs are fainter and
// cooler (depth-fade + self-shadow), so the stack composites front-to-back as a
// soft grey volume with a faint cool tint.
//
// seek() advances the time uniform (continuous loop, duration Infinity).
// onParamChange() + live reads keep the controls tweakable with no rebuild.
// Uniform handles are published on target.userData.fogUniforms for CPU tests.

import { Mesh, type Material, NormalBlending } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, attribute } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition, VOLUMETRIC_DEPTH_ATTR } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; value-noise / fbm pass nodes through helper functions that the strict
// overloads of the free TSL functions reject. Like nebula.ts, we work through a
// single permissive chainable node alias (method-chaining only, which every TSL
// node supports) so the helpers compose without fighting inferred VarNode
// generics. The graph this builds is identical to the free-function form.
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
  { id: 'speed', label: 'Speed', type: 'knob', min: 0, max: 3, step: 0.05, default: 0.6 },
  { id: 'density', label: 'Density', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 1 },
  { id: 'layers', label: 'Layers', type: 'knob', min: 1, max: 5, step: 1, default: 3 },
] as const;

export const fogPrimitive: PrimitiveDefinition = {
  name: 'fog',
  label: 'Fog',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  volumetric: true,
  defaultDriver: 'time',
  description:
    'Rolling volumetric fog banks drift sideways at varying depths, soft grey with a faint cool tint.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fog', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 0.6));
      const uDensity = uniform(num(params.density, 1));
      const uLayers = uniform(num(params.layers, 3));

      // Per-vertex depth across the 5-slab stack: 0 front → 1 rear.
      const aDepth = attribute(VOLUMETRIC_DEPTH_ATTR) as unknown as TNode;

      // Deterministic 2D value-noise hash → smooth value noise → fbm.
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();

      const noise = (p: TNode): TNode => {
        const i = p.floor();
        const f = p.fract();
        // smooth Hermite interpolant: f*f*(3-2f)
        const w = f.mul(f).mul(f1(3).sub(f.mul(2)));
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
        // 5 octaves of value noise → smooth, non-blocky bank structure.
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise(p).mul(amp));
          p = p.mul(2.03);
          amp *= 0.5;
        }
        return sum;
      };

      const t = (uTime as unknown as TNode).mul(uSpeed as unknown as TNode);

      // Each slab samples a DIFFERENT slice of the field. aDepth offsets the
      // noise domain (parallax) AND modulates the per-slab drift rate, so the
      // five slabs read as distinct fog banks gliding at different depths.
      const parallax = aDepth.mul(2.1);
      const slabDrift = t.mul(aDepth.mul(0.5).add(0.6));

      // Stretched horizontal coordinate: fog banks are wide and low. Sideways
      // advection drifts the field along x; aDepth feeds in as a real 3rd
      // dimension via the y-domain warp so the field genuinely varies in depth.
      const u0 = (uv() as unknown as TNode);
      const base = t2(
        u0.x.mul(2.6).sub(slabDrift).add(parallax),
        u0.y.mul(1.4).add(aDepth.mul(1.3)),
      );

      // Domain-warp the fbm (sample fbm at a point offset by another fbm) to
      // kill banding and give the rolling, churned look of real fog.
      const qx = fbm(base.add(t2(t.mul(0.18), 0)));
      const qy = fbm(base.add(t2(3.7, 1.9)).sub(t2(0, t.mul(0.12))));
      const warped = base.add(t2(qx, qy).mul(1.6));
      const fieldRaw = fbm(warped.add(t2(t.mul(0.05), 0)));

      // Number of active banks gates higher-frequency detail in smoothly via
      // uLayers (1..5): more layers → crisper, more turbulent fog.
      const detail = fbm(warped.mul(2.4).add(t2(t.mul(0.3), aDepth.mul(2)))).sub(0.5);
      const layerW = (uLayers as unknown as TNode).sub(1).div(4).clamp(0, 1);
      const field = fieldRaw.add(detail.mul(layerW).mul(0.45));

      // Vertical density gradient — thicker low (y near 0), thinner high.
      const vertical = u0.y.oneMinus().mul(0.85).add(0.25);

      // Density of this slab's fog, scaled by the density control.
      const dens = field
        .mul(vertical)
        .mul(uDensity as unknown as TNode)
        .smoothstep(0.18, 0.95)
        .clamp(0, 1);

      // Depth-fade: rear slabs fainter (self-shadow / density falloff) so the
      // stack reads as a lit volume with front-to-back occlusion.
      const depthFade = aDepth.oneMinus().mul(0.7).add(0.3);

      // Soft grey fog with a faint cool tint; rear slabs tinted a touch darker
      // and cooler so the volume reads as lit from the front.
      const near = t3(0.74, 0.78, 0.83);
      const far = t3(0.3, 0.36, 0.46);
      const tint = near.mix(far, aDepth);
      const dark = t3(0.1, 0.12, 0.16);
      const colorNode = dark.mix(tint, dens).mul(depthFade.mul(0.5).add(0.5));

      // Opacity links to density × depth-fade so banks read as denser (not just
      // brighter) and rear slabs contribute less — proper painter's compositing.
      const opacityNode = dens.mul(depthFade).mul(0.85).clamp(0, 1);

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
      target.userData.fogUniforms = { uTime, uSpeed, uDensity, uLayers };

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 0.6);
          uDensity.value = num(params.density, 1);
          uLayers.value = num(params.layers, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 0.6);
          else if (id === 'density') uDensity.value = num(value, 1);
          else if (id === 'layers') uLayers.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.fogUniforms;
          mat.dispose();
        },
      };
    },
  ),
};
