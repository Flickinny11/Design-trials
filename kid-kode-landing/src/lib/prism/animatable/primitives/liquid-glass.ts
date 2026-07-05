// liquid-glass — molten glass blobs flow over the sphere. HARD / GPU primitive.
// Swaps the host sphere's material for a transmissive MeshPhysicalNodeMaterial
// with high clearcoat, whose normalNode is perturbed by a sum of moving sine
// lobes (fake metaballs) over local position, driven by a uTime uniform so the
// highlights flow like liquid. seek() advances uTime + reads knobs live;
// onParamChange() updates the live uniforms. dispose() restores the swapped
// material and disposes the created one.

import { Mesh, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  positionLocal,
  normalLocal,
  vec3,
  float,
  sin,
  normalize,
  normalView,
  positionViewDirection,
  pow,
  max as tslMax,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'flow', label: 'Flow', type: 'knob', min: 0, max: 4, step: 0.05, default: 1.2, unit: 'x' },
  { id: 'viscosity', label: 'Viscosity', type: 'knob', min: 0.5, max: 8, step: 0.1, default: 3 },
  { id: 'ior', label: 'IOR', type: 'knob', min: 1, max: 2.4, step: 0.01, default: 1.5 },
] as const;

export const liquidGlassPrimitive: PrimitiveDefinition = {
  name: 'liquid-glass',
  label: 'Liquid Glass',
  category: 'glass',
  difficulty: 'hard',
  subject: 'sphere',
  defaultDriver: 'time',
  description:
    'Molten glass blobs flow over the sphere — animated normal distortion on a transmissive surface.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'liquid-glass', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uFlow = uniform(num(params.flow, 1.2));
      const uViscosity = uniform(num(params.viscosity, 3));

      // Fake-metaball normal perturbation: three moving sine lobes over local
      // position, summed, scaled by viscosity (lobe scale) and time (flow).
      // Adding the perturbation to the base local normal and renormalizing
      // makes the highlights ripple/flow like molten glass.
      const p = positionLocal.mul(uViscosity);
      const t = uTime.mul(uFlow);

      const lobeX = sin(p.y.add(t)).add(sin(p.z.sub(t.mul(1.3))));
      const lobeY = sin(p.z.add(t.mul(0.8))).add(sin(p.x.sub(t.mul(1.1))));
      const lobeZ = sin(p.x.add(t.mul(1.2))).add(sin(p.y.sub(t.mul(0.9))));

      const perturb = vec3(lobeX, lobeY, lobeZ).mul(float(0.5));
      const flowingNormal = normalize(normalLocal.add(perturb));

      // Luminous internal CORE: the catalog preview rig renders tiles through a
      // scissored multi-view pass that does NOT populate three's transmission
      // render target, so a perfectly clear transmissive sphere has no backdrop
      // to refract and its on-axis centre reads pure black. We light the molten
      // glass from within via an emissiveNode. `facing` (= n·viewDir) peaks where
      // the surface faces the camera — the geometric centre — and falls to 0 at
      // the rim (the complement of the fresnel rim). pow(facing,2) keeps the glow
      // tight to the on-axis core so the centre glows softly instead of black,
      // while the rim still catches the env + clearcoat highlights. Cool
      // blue-white tint.
      const facing = tslMax(normalView.dot(positionViewDirection), float(0));
      // Bright saturated blue core so it reads as luminous glass, not grey clay.
      const core = pow(facing, float(2)).mul(float(1.1));
      const emissive = vec3(0.4, 0.6, 1.0).mul(core);

      const mat = new MeshPhysicalNodeMaterial({
        transmission: 1,
        // thickness lowered 1.2 → 0.9: a touch less magnification so the molten
        // centre samples the bright on-axis backdrop hero rather than the dim
        // inverted periphery. The clearcoat surface highlights are unchanged.
        thickness: 0.9,
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        ior: num(params.ior, 1.5),
        transparent: true,
      });
      (mat as unknown as { normalNode: unknown }).normalNode = flowingNormal;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissive;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish the driven uniforms to the shared scratch space so the host (and
      // tests) can observe the live animation state without reaching into the
      // TSL graph.
      target.userData.liquidGlass = { uTime, uFlow, uViscosity };

      return {
        // Looping/continuous effect — flows forever.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read knobs live so control changes apply with no rebuild.
          uFlow.value = num(params.flow, 1.2);
          uViscosity.value = num(params.viscosity, 3);
          // ior is a material scalar, not a node uniform — keep it in sync.
          mat.ior = num(params.ior, 1.5);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'flow') uFlow.value = num(value, 1.2);
          else if (id === 'viscosity') uViscosity.value = num(value, 3);
          else if (id === 'ior') mat.ior = num(value, 1.5);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
