// crystal-facet — a faceted crystal sphere catches light. The host sphere's
// material is swapped for a MeshPhysicalNodeMaterial whose normal/uv are
// quantized into hard facets (floor), and a sharp specular glint —
// pow(fresnel, high) modulated by a uTime sweep — races across those facets as
// the subject slowly turns. HARD / GPU (glass) primitive.
//
// seek() advances the time uniform AND rotates the subject (subject.rotation.y
// += per frame, CPU-observable), reads the knobs live, and pushes facet/sparkle
// uniforms. dispose() restores prevMat AND the subject's original rotation.

import { Mesh, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  normalLocal,
  floor,
  vec3,
  float,
  dot,
  pow,
  abs,
  sin,
  max,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'facets', label: 'Facets', type: 'knob', min: 2, max: 24, step: 1, default: 9 },
  { id: 'sparkle', label: 'Sparkle', type: 'knob', min: 0, max: 4, step: 0.05, default: 2 },
  { id: 'spin', label: 'Spin', type: 'knob', min: 0, max: 3, step: 0.05, default: 0.7, unit: 'rad/s' },
] as const;

export const crystalFacetPrimitive: PrimitiveDefinition = {
  name: 'crystal-facet',
  label: 'Crystal Facet',
  category: 'glass',
  difficulty: 'hard',
  subject: 'sphere',
  defaultDriver: 'time',
  description:
    'A faceted crystal catches light, sparkle glints racing across sharp facets as it turns.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'crystal-facet', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uFacets = uniform(num(params.facets, 9));
      const uSparkle = uniform(num(params.sparkle, 2));

      // Quantize the local normal into hard facets: floor(n * facets) / facets
      // gives a stepped normal, so lighting reads as flat triangular faces.
      const n = normalLocal;
      const facetN = floor(n.mul(uFacets)).div(uFacets);

      // Quantize uv into a faceted grid too (drives the glint banding).
      const fuv = floor(uv().mul(uFacets)).div(uFacets);

      // Cheap view-independent fresnel proxy from the faceted normal: rim where
      // the faceted normal's z component is small => grazing => bright.
      const fres = tslClamp(float(1).sub(abs(facetN.z)), float(0), float(1));

      // A sweep that travels over the facets driven by uTime: project the
      // faceted position+uv onto a moving phase so the glint races across faces.
      const sweep = sin(
        fuv.x.mul(6.2831).add(fuv.y.mul(3.14159)).add(dot(facetN, vec3(1, 1, 1)).mul(2)).add(uTime.mul(2.5)),
      );
      const sweepBand = max(sweep, float(0));

      // Sharp specular glint = pow(fresnel, high) modulated by the sweep, scaled
      // by sparkle. High exponent => narrow, sharp glints on the facet edges.
      const glint = pow(fres, float(6)).mul(sweepBand).mul(uSparkle);

      // Emissive picks up the glint as a cool-white sparkle over the facets.
      const emissive = vec3(0.7, 0.82, 1.0).mul(glint);

      const mat = new MeshPhysicalNodeMaterial({
        transparent: true,
        metalness: 0.1,
        roughness: 0.08,
        transmission: 0.6,
        thickness: 0.8,
        ior: 1.6,
      });
      // Faceted normal => hard flat faces. Glint => emissive sparkle.
      (mat as unknown as { normalNode: unknown }).normalNode = facetN;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissive;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Capture the subject's base rotation so dispose() can restore it exactly.
      const baseRotY = mesh ? mesh.rotation.y : 0;
      let lastT = 0;

      return {
        // Continuous, stateful turn — loop forever.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read knobs live so setControl applies with no rebuild.
          uFacets.value = num(params.facets, 9);
          uSparkle.value = num(params.sparkle, 2);
          // Slowly rotate the subject for life. Drive rotation directly from the
          // absolute clock so it is deterministic across seeks (not accumulated).
          if (mesh) {
            mesh.rotation.y = baseRotY + tt * num(params.spin, 0.7);
          }
          lastT = tt;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'facets') uFacets.value = num(value, 9);
          else if (id === 'sparkle') uSparkle.value = num(value, 2);
          else if (id === 'spin' && mesh) {
            // Re-apply rotation immediately at the current clock with new spin.
            mesh.rotation.y = baseRotY + lastT * num(value, 0.7);
          }
        },
        dispose: () => {
          if (mesh) {
            if (prevMat) mesh.material = prevMat;
            mesh.rotation.y = baseRotY;
          }
          mat.dispose();
        },
      };
    },
  ),
};
