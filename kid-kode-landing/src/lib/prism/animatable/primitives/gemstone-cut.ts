// gemstone-cut — a faceted COLORED gemstone. The host card's panel material is
// swapped for a MeshPhysicalNodeMaterial that is fully transmissive
// (transmission=1) with high thickness and a saturated attenuationColor so the
// body absorbs light into a deep, jewel-toned glow (ruby/emerald/etc). roughness
// 0 and a gem-grade ior (~2.0) make it read as cut stone, not clear glass — this
// is the colored, ABSORBING cousin of crystal-facet's clear crystal.
//
// The normalNode is perturbed by a faceted cellular pattern (layered sin bands
// forming triangular cut facets) so the surface reads as a brilliant cut. A
// uTime uniform slowly ROTATES that facet pattern (the uv is run through a 2D
// rotation by uTime) so the bright facet sparkles travel across the stone.
//
// HARD / GPU (glass) primitive. flagRealGpu — real transmission/IBL absorption
// only renders correctly on a real GPU; headless swiftshader under-renders it.
//
// seek() advances uTime (CPU-observable via uniform .value), reads the knobs
// live, and pushes facet/ior uniforms. dispose() restores prevMat and disposes
// the swapped material.

import { Mesh, Color, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  normalLocal,
  vec2,
  vec3,
  float,
  sin,
  cos,
  abs,
  max,
  fract,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'gemColor', label: 'Gem Color', type: 'color', default: '#b5122e' },
  { id: 'facets', label: 'Facets', type: 'knob', min: 3, max: 12, step: 1, default: 7 },
  { id: 'ior', label: 'IOR', type: 'fader', min: 1.5, max: 2.4, step: 0.01, default: 2.0 },
] as const;

export const gemstoneCutPrimitive: PrimitiveDefinition = {
  name: 'gemstone-cut',
  label: 'Gemstone Cut',
  category: 'glass',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A faceted colored gemstone — transmissive with deep colored absorption and bright facet sparkles that rotate.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'gemstone-cut', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const [gr, gg, gb] = rgb(str(params.gemColor, '#b5122e'));
      const uTime = uniform(0);
      const uFacets = uniform(num(params.facets, 7));
      const uR = uniform(gr);
      const uG = uniform(gg);
      const uB = uniform(gb);

      // Rotate the uv around its centre by uTime so the whole faceted pattern
      // slowly turns and the bright cuts travel across the stone.
      const centered = uv().sub(vec2(0.5, 0.5));
      const ang = uTime.mul(0.6);
      const ca = cos(ang);
      const sa = sin(ang);
      const ruv = vec2(
        centered.x.mul(ca).sub(centered.y.mul(sa)),
        centered.x.mul(sa).add(centered.y.mul(ca)),
      ).add(vec2(0.5, 0.5));

      const sx = ruv.x.mul(uFacets);
      const sy = ruv.y.mul(uFacets);

      // Layered triangular cell bands — three directions of sin ridges combine
      // into a faceted, voronoi-ish cut pattern. abs() of the sins gives sharp
      // ridge lines (the facet edges).
      const band1 = abs(sin(sx.add(sy)));
      const band2 = abs(sin(sx.sub(sy).mul(0.86)));
      const band3 = abs(sin(sx.mul(1.31).add(uTime.mul(0.4))));
      // any: this is a fluent VarNode accumulator (max chain) — the narrow
      // VarNode typing fails strict tsc, mirror the splat-reveal / pool-caustics fix.
      let ridge: any = max(band1, band2); // eslint-disable-line @typescript-eslint/no-explicit-any
      ridge = max(ridge, band3);

      // Perturb the local normal by the ridge field so the faces tilt — a fake
      // bump that reads as cut facets under transmission/IBL. The perturbation is
      // derived from the rotating ruv so the highlights move.
      // any: components derive from the `ridge` accumulator (typed any), so the
      // vec3 overload resolution fails strict tsc unless we keep them loose.
      const px: any = sin(sx).mul(ridge).mul(0.5); // eslint-disable-line @typescript-eslint/no-explicit-any
      const py: any = cos(sy).mul(ridge).mul(0.5); // eslint-disable-line @typescript-eslint/no-explicit-any
      const pert: any = vec3(px, py, float(1)); // eslint-disable-line @typescript-eslint/no-explicit-any
      const perturbedN = normalLocal.add(pert).normalize();

      // Bright facet sparkles on the ridge lines — sharpened ridge, tinted with
      // a near-white sheen so cut edges glint as the pattern rotates.
      const sparkle: any = fract(ridge.mul(3.0)).mul(ridge); // eslint-disable-line @typescript-eslint/no-explicit-any
      const emissive = vec3(1.0, 0.96, 0.9).mul(sparkle).mul(0.6);

      const mat = new MeshPhysicalNodeMaterial({
        transparent: true,
        metalness: 0.0,
        roughness: 0.0,
        transmission: 1.0,
        thickness: 2.4,
        ior: num(params.ior, 2.0),
        attenuationDistance: 0.4,
      });
      // Saturated absorption colour => colored gem body (ruby/emerald/etc).
      mat.attenuationColor = new Color(gr, gg, gb);
      (mat as unknown as { normalNode: unknown }).normalNode = perturbedN;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissive;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish the facet-rotation clock uniform into the host scratch space
      // (contract: userData holds "uniform handles, etc.") so the master clock /
      // tooling can observe the live time-driven value.
      target.userData.gemstoneTime = uTime;

      return {
        // Continuous, stateful rotation of the facet pattern — loop forever.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read knobs live so setControl applies with no rebuild.
          uFacets.value = num(params.facets, 7);
          mat.ior = num(params.ior, 2.0);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'facets') uFacets.value = num(value, 7);
          else if (id === 'ior') mat.ior = num(value, 2.0);
          else if (id === 'gemColor' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
            mat.attenuationColor = new Color(r, g, b);
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
