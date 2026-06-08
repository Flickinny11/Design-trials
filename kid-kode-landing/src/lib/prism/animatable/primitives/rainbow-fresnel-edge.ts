// rainbow-fresnel-edge — a rainbow fresnel glow rims the edges of the surface,
// the spectral colors drifting slowly along the border. HARD / TSL primitive.
// Swaps the host card's panel material for a MeshStandardNodeMaterial whose
// emissiveNode adds a spectral cos-palette concentrated at the borders via an
// edge-distance fresnel proxy. seek() advances a time uniform so the hue drifts
// along the rim. DISTINCT from iridescence (full-surface oil-slick): the rainbow
// is concentrated at the edges only.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, min, pow, fract, cos, smoothstep, float, vec3 } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'drift', label: 'Drift', type: 'knob', min: 0, max: 2, step: 0.01, default: 0.35 },
  { id: 'edgeWidth', label: 'Edge Width', type: 'knob', min: 0.05, max: 0.4, step: 0.01, default: 0.16 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 4, step: 0.05, default: 1.6 },
  { id: 'bands', label: 'Bands', type: 'knob', min: 0.5, max: 6, step: 0.1, default: 2 },
  { id: 'power', label: 'Power', type: 'knob', min: 1, max: 6, step: 0.1, default: 3 },
] as const;

export const rainbowFresnelEdgePrimitive: PrimitiveDefinition = {
  name: 'rainbow-fresnel-edge',
  label: 'Rainbow Edge',
  category: 'shimmer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A rainbow fresnel glow rims the edges of the surface, the spectral colors drifting slowly along the border.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'rainbow-fresnel-edge', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDrift = uniform(num(params.drift, 0.35));
      const uEdgeWidth = uniform(num(params.edgeWidth, 0.16));
      const uIntensity = uniform(num(params.intensity, 1.6));
      const uBands = uniform(num(params.bands, 2));
      const uPower = uniform(num(params.power, 3));

      const u = uv();
      // Distance to the nearest border in 0..0.5 range.
      const edgeDist = min(u.x, min(float(1).sub(u.x), min(u.y, float(1).sub(u.y))));
      // Fresnel proxy: bright at the borders, fading inward, sharpened by power.
      const fresnel = pow(
        float(1).sub(smoothstep(float(0), uEdgeWidth, edgeDist)),
        uPower,
      );

      // A coordinate that runs along the border so the hue sweeps around the rim.
      const edgeCoord = u.x.add(u.y);
      const hue = fract(edgeCoord.mul(uBands).add(uTime.mul(uDrift)));
      // Cos-palette: 0.5 + 0.5*cos(2*PI*(hue + vec3(0,0.33,0.67))).
      const spectralColor = float(0.5).add(
        cos(hue.add(vec3(0, 0.33, 0.67)).mul(6.283185307179586)).mul(0.5),
      );

      const emissiveNode = spectralColor.mul(fresnel).mul(uIntensity);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish the live uniform handles onto the shared scratch space so the
      // host (and CPU-side inspection) can read the driven .value each frame.
      target.userData.rainbowFresnelEdge = {
        uTime,
        uDrift,
        uEdgeWidth,
        uIntensity,
        uBands,
        uPower,
      };

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.drift, 0.35);
          uEdgeWidth.value = num(params.edgeWidth, 0.16);
          uIntensity.value = num(params.intensity, 1.6);
          uBands.value = num(params.bands, 2);
          uPower.value = num(params.power, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'drift') uDrift.value = num(value, 0.35);
          else if (id === 'edgeWidth') uEdgeWidth.value = num(value, 0.16);
          else if (id === 'intensity') uIntensity.value = num(value, 1.6);
          else if (id === 'bands') uBands.value = num(value, 2);
          else if (id === 'power') uPower.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
