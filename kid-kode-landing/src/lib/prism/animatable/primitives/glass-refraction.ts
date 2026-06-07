// glass-refraction — a slowly rotating transmissive glass sphere with a fresnel
// rim. HARD / GPU node-material primitive. Template companion to shimmer.ts:
// swaps the host sphere's material for a MeshPhysicalNodeMaterial configured for
// transmission, and adds a fresnel emissive rim so the glass reads even without
// an environment map. seek() drives rotation.y from t * rotateSpeed; control
// changes flow live through seek() (numeric reads) and onParamChange (uniforms).

import { Mesh, Color, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  vec3,
  float,
  normalView,
  positionViewDirection,
  oneMinus,
  pow,
  max as tslMax,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'rotateSpeed', label: 'Rotate speed', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.6 },
  { id: 'ior', label: 'IOR', type: 'knob', min: 1, max: 2.5, step: 0.01, default: 1.5 },
  { id: 'roughness', label: 'Roughness', type: 'knob', min: 0, max: 0.5, step: 0.01, default: 0.05 },
  { id: 'rimColor', label: 'Rim color', type: 'color', default: '#a978ff' },
] as const;

export const glassRefractionPrimitive: PrimitiveDefinition = {
  name: 'glass-refraction',
  label: 'Glass refraction',
  category: 'glass',
  difficulty: 'hard',
  subject: 'sphere',
  defaultDriver: 'time',
  description:
    'A slowly rotating transmissive glass sphere with a fresnel rim that reads without an env map.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'glass-refraction', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const [r0, g0, b0] = rgb(str(params.rimColor, '#a978ff'));
      const uRimR = uniform(r0);
      const uRimG = uniform(g0);
      const uRimB = uniform(b0);

      // Fresnel: facing ratio from view normal vs. view direction. oneMinus
      // gives a rim that brightens at grazing angles; pow(...,2) tightens it.
      const facing = tslMax(normalView.dot(positionViewDirection), float(0));
      const fresnel = oneMinus(facing);
      const rim = vec3(uRimR, uRimG, uRimB).mul(pow(fresnel, float(2)));

      const mat = new MeshPhysicalNodeMaterial();
      mat.transmission = 1;
      mat.ior = num(params.ior, 1.5);
      mat.thickness = 0.5;
      mat.roughness = num(params.roughness, 0.05);
      mat.metalness = 0;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = rim;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      const baseRotY = mesh ? mesh.rotation.y : 0;

      return {
        duration: () => Infinity,
        seek: (t: number) => {
          if (!mesh) return;
          mesh.rotation.y = baseRotY + t * num(params.rotateSpeed, 0.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'ior') mat.ior = num(value, 1.5);
          else if (id === 'roughness') mat.roughness = num(value, 0.05);
          else if (id === 'rimColor' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uRimR.value = r;
            uRimG.value = g;
            uRimB.value = b;
          }
        },
        dispose: () => {
          if (mesh) {
            mesh.rotation.y = baseRotY;
            if (prevMat) mesh.material = prevMat;
          }
          mat.dispose();
        },
      };
    },
  ),
};
