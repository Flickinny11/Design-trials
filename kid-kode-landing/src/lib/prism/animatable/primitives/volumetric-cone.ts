// volumetric-cone — a single cone of volumetric light beams down from an apex at
// top-center, widening downward, with dust motes drifting in the shaft as the
// cone slowly sweeps. HARD / GPU / VOLUMETRIC primitive. The host builds the
// subject as a 5-slab coplanar stack (z 0 → -0.62), each vertex carrying the
// frozen `aDepth` attribute (0 front → 1 rear). We swap the host plane's
// material for a SINGLE MeshBasicNodeMaterial drawn across all slabs; the shader
// reads `aDepth` to (1) PARALLAX the dust field per slab so the shaft reads as a
// real haze volume rather than 5x identical overdraw, and (2) DEPTH-FADE rear
// slabs so the cone has front-to-back density falloff and self-occlusion. An
// angle test from the apex (atan against a slowly-sweeping cone direction)
// selects the shaft; falloff makes it denser near the apex; an fbm dust term
// modulates the volume. transparent + depthWrite:false + additive blending make
// the far-first slabs composite as glowing haze. seek() advances a time uniform.
//
// DISTINCT from godray/light-shafts (parallel/marched radial shafts): this is one
// coherent sweeping volumetric cone with an apex, soft angular edges, and depth.

import { Mesh, AdditiveBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, attribute, atan } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition, VOLUMETRIC_DEPTH_ATTR } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; value-noise / fbm pass nodes through helper functions that the strict
// overloads of the free TSL functions reject. Like nebula.ts, we work through a
// single permissive chainable node alias (method-chaining only, which every TSL
// node supports) so the helpers compose without fighting the inferred VarNode
// generics. The graph this builds is identical to the free-function form.
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  negate: () => TNode;
  abs: () => TNode;
  floor: () => TNode;
  fract: () => TNode;
  sin: () => TNode;
  length: () => TNode;
  oneMinus: () => TNode;
  dot: (x: TNode) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: TNode | number, hi: TNode | number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
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
  { id: 'sweep', label: 'Sweep', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.6 },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0.1, max: 1.2, step: 0.02, default: 0.5, unit: 'rad' },
  { id: 'dust', label: 'Dust', type: 'knob', min: 0, max: 1, step: 0.02, default: 0.6 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 2.5, step: 0.05, default: 1.2 },
] as const;

export const volumetricConePrimitive: PrimitiveDefinition = {
  name: 'volumetric-cone',
  label: 'Volumetric Cone',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  volumetric: true,
  defaultDriver: 'time',
  description:
    'A cone of volumetric light beams down from a point, dust motes drifting in the shaft as it slowly sweeps.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'volumetric-cone', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSweep = uniform(num(params.sweep, 0.6));
      const uSpread = uniform(num(params.spread, 0.5));
      const uDust = uniform(num(params.dust, 0.6));
      const uIntensity = uniform(num(params.intensity, 1.2));

      // Per-vertex slab depth: 0.0 on the FRONT (camera) slab → 1.0 on the
      // rearmost slab. Constant within each slab, so each of the 5 coplanar
      // quads samples a distinct slice of the volume.
      const aDepth = attribute(VOLUMETRIC_DEPTH_ATTR) as unknown as TNode;

      // Deterministic 2D value-noise → smooth value noise → fbm (nebula pattern).
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
        // 5 octaves of value noise → no blocky low-res look.
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise(p).mul(amp));
          p = p.mul(2.02);
          amp *= 0.5;
        }
        return sum;
      };

      const u = uv() as unknown as TNode;
      const tt = (uTime as unknown as TNode);

      // Apex at top-center of the plane (uv y=1, x=0.5). Cone opens downward.
      const apex = t2(0.5, 1.0);
      const rel = u.sub(apex); // fragment relative to apex
      const dist = rel.length();

      // Bearing of the fragment from the apex. atan(rel.x, -rel.y) measures the
      // signed angle off the straight-down axis.
      const bearing = (atan as unknown as (y: TNode, x: TNode) => TNode)(rel.x, rel.y.negate());

      // Cone direction sweeps slowly side-to-side around straight-down.
      const sweepAngle = tt.mul(uSweep as unknown as TNode).sin().mul(0.45);
      const offAxis = bearing.sub(sweepAngle).abs();

      // Soft angular edges: inside the half-spread → 1, fading out past it.
      const sp = uSpread as unknown as TNode;
      const cone = offAxis.smoothstep(sp, sp.mul(0.45));

      // Distance falloff: brightest/densest near the apex, dimming down the shaft.
      const falloff = f1(1).sub(dist.mul(0.85)).clamp(0, 1);

      // --- VOLUME via aDepth -------------------------------------------------
      // 1) Parallax: each slab samples a different slice of the dust field. Push
      //    the sample domain along the view by an aDepth-scaled offset AND feed
      //    aDepth as a genuine 3rd noise dimension (folded into the 2D lattice),
      //    so the field really varies through depth instead of 5x overdraw.
      const drift = t2(tt.mul(0.07), tt.mul(-0.13));
      const parallax = t2(aDepth.mul(0.6), aDepth.mul(-0.35));
      const depthSlice = aDepth.mul(11.3); // distinct lattice offset per slab
      const dustP = u.mul(7.0).add(drift).add(parallax).add(t2(depthSlice, depthSlice.mul(0.7)));
      const dustTerm = fbm(dustP);

      // Sparse drifting motes: sharpen the fbm peaks so bright specks pop in the
      // shaft rather than a uniform haze.
      const motes = dustTerm.clamp(0, 1).pow(2.4).mul(0.9);
      // Dust density: a 0.7 baseline haze + fbm body + bright motes, the whole
      // modulation scaled by the Dust control. At Dust=0 → flat 0.7 shaft.
      const dustGain = f1(0.7).add(dustTerm.mul(0.3).add(motes).mul(uDust as unknown as TNode));

      // 2) Depth-fade: rear slabs fainter (density falloff / self-shadow). Front
      //    slab (aDepth 0) → ~1.0, rear (aDepth 1) → ~0.3.
      const depthFade = aDepth.oneMinus().mul(0.7).add(0.3);

      // Cone density: angular gate × apex falloff × dust × depth-fade. Boost the
      // near-apex region so the cone is visibly denser at the top.
      const apexBoost = falloff.pow(1.6).mul(0.8).add(0.5);
      const density = cone
        .mul(falloff)
        .mul(apexBoost)
        .mul(dustGain)
        .mul(depthFade)
        .mul(uIntensity as unknown as TNode);

      const opacityNode = density.clamp(0, 1);

      // Warm shaft, slightly hotter near the apex; rear slabs tinted a touch
      // cooler/darker so the stack reads as a lit volume with front-to-back depth.
      const warmCore = t3(1.0, 0.96, 0.82);
      const warmEdge = t3(0.78, 0.84, 1.0);
      const baseCol = warmEdge.mix(warmCore, falloff);
      const depthTint = aDepth.oneMinus().mul(0.45).add(0.55); // rear slabs darker
      const colorNode = baseCol.mul(depthTint);

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the live uniform handles via the shared scratch space so the host
      // (and tests) can observe the animation clock advancing on CPU.
      target.userData.volumetricCone = { uTime, uSweep, uSpread, uDust, uIntensity };

      return {
        // Looping/continuous sweep — purely stateful in time.
        duration: () => Infinity,
        seek: (t) => {
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uSweep.value = num(params.sweep, 0.6);
          uSpread.value = num(params.spread, 0.5);
          uDust.value = num(params.dust, 0.6);
          uIntensity.value = num(params.intensity, 1.2);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'sweep') uSweep.value = num(value, 0.6);
          else if (id === 'spread') uSpread.value = num(value, 0.5);
          else if (id === 'dust') uDust.value = num(value, 0.6);
          else if (id === 'intensity') uIntensity.value = num(value, 1.2);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
