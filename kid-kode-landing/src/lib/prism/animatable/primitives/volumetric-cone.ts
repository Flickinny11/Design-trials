// volumetric-cone — a single cone of volumetric light beams down from an apex at
// top-center, widening downward, with dust motes drifting in the shaft as the
// cone slowly sweeps. HARD / GPU primitive. Swaps the host plane's material for a
// MeshBasicNodeMaterial whose opacityNode is the cone intensity: an angle test
// from the apex (atan/dot against a slowly-sweeping cone direction) selects the
// shaft, falloff with distance dims it, and an fbm-of-uv dust term modulates the
// volume. seek() advances a time uniform (sweep + dust drift). Numeric controls
// update uniforms via onParamChange and are also read live in seek.
//
// DISTINCT from godray/light-shafts (parallel/marched radial shafts): this is one
// coherent sweeping volumetric cone with an apex, soft angular edges, and dust.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  atan,
  abs,
  fract,
  floor,
  mix,
  smoothstep,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

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

      // Apex at top-center of the plane (uv y=1, x=0.5). Cone opens downward.
      const u = uv();
      const apex = vec2(0.5, 1.0);
      const rel = u.sub(apex); // fragment relative to apex
      const dist = rel.length();

      // Bearing of the fragment from the apex. Straight down is the -y axis;
      // atan(rel.x, -rel.y) measures the signed angle off the downward axis.
      const bearing = atan(rel.x, rel.y.negate());

      // Cone direction sweeps slowly side-to-side around straight-down.
      const sweepAngle = sin(uTime.mul(uSweep)).mul(0.45);
      const offAxis = abs(bearing.sub(sweepAngle));

      // Soft angular edges: inside the half-spread → 1, fading out past it.
      const cone = smoothstep(uSpread, uSpread.mul(0.45), offAxis);

      // Distance falloff: brightest near the apex, dimming down the shaft.
      const falloff = tslClamp(float(1).sub(dist.mul(0.85)), float(0), float(1));

      // Dusty volume: a cheap fbm of (uv*scale + time*drift). Two value-noise
      // octaves built from a hashed lattice keep it deterministic and GPU-light.
      const drift = vec2(uTime.mul(0.07), uTime.mul(-0.13));
      // TSL node values infer over-narrow VarNode types as helper params; type
      // the node args/locals as `any` so strict tsc accepts the lattice math.
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const fbm = (p: any) => {
        const hash = (cell: any) =>
          fract(sin(cell.x.mul(127.1).add(cell.y.mul(311.7))).mul(43758.5453));
        const noise = (q: any) => {
          const i = floor(q);
          const f = fract(q);
          const w: any = f.mul(f).mul(float(3).sub(f.mul(2))); // smoothstep weights
          const a = hash(i);
          const b = hash(i.add(vec2(1, 0)));
          const c = hash(i.add(vec2(0, 1)));
          const d = hash(i.add(vec2(1, 1)));
          return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
        };
        const p1 = p.add(drift);
        const p2 = p.mul(2.13).add(drift.mul(1.7));
        return noise(p1).mul(0.65).add(noise(p2).mul(0.35));
      };
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const dustTerm = fbm(u.mul(7.0));
      // 0.7 baseline + dust modulation, scaled by the dust control.
      const dusty = float(0.7).add(dustTerm.mul(0.3).mul(uDust));

      const intensityNode = cone.mul(falloff).mul(dusty).mul(uIntensity);
      const opacityNode = tslClamp(intensityNode, float(0), float(1));

      // Pale warm shaft color, slightly hotter near the apex.
      const warmCore = vec3(1.0, 0.96, 0.82);
      const warmEdge = vec3(0.78, 0.84, 1.0);
      const colorNode = mix(warmEdge, warmCore, falloff);

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
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
