// iridescent-glass — a soap-bubble thin-film iridescence shimmers over a
// transmissive sphere, hues shifting with view angle and cycling over time.
// HARD / GPU node-material primitive. Companion to glass-refraction.ts and
// fresnel-glow.ts: swaps the host sphere's material for a transmissive
// MeshPhysicalNodeMaterial and drives an emissive iridescent rim built from a
// cosine hue palette (Iñigo-Quílez style) whose phase = fresnel*thickness +
// uTime*hueSpeed. seek() advances the time uniform AND rotates the sphere so
// play is CPU-observable; controls flow live via seek() (numeric reads) and
// onParamChange (uniforms). The material's own `iridescence` property is set
// too for the thin-film look. prevMat restored in dispose.

import { Mesh, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  vec3,
  float,
  cos,
  normalView,
  positionViewDirection,
  oneMinus,
  pow,
  max as tslMax,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'hueSpeed', label: 'Hue speed', type: 'knob', min: 0, max: 4, step: 0.05, default: 1.2 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.4 },
  { id: 'thickness', label: 'Thickness', type: 'knob', min: 0.5, max: 8, step: 0.1, default: 3 },
  { id: 'rotateSpeed', label: 'Rotate speed', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.4 },
] as const;

export const iridescentGlassPrimitive: PrimitiveDefinition = {
  name: 'iridescent-glass',
  label: 'Iridescent Glass',
  category: 'glass',
  difficulty: 'hard',
  subject: 'sphere',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Soap-bubble thin-film iridescence shimmers over a transmissive sphere, hues shifting with view.',
  create: defineAnimatable(
    { name: 'iridescent-glass', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uHueSpeed = uniform(num(params.hueSpeed, 1.2));
      const uIntensity = uniform(num(params.intensity, 1.4));
      const uThickness = uniform(num(params.thickness, 3));

      // Fresnel: 1 - (normal . viewDir). Bright at grazing angles — the rim,
      // where a soap film's iridescence is most visible.
      const facing = tslMax(normalView.dot(positionViewDirection), float(0));
      const fresnel = oneMinus(facing);

      // Thin-film phase: the perceived path difference grows toward the rim and
      // with film thickness, and scrolls over time so the hues cycle.
      const phase = fresnel.mul(uThickness).add(uTime.mul(uHueSpeed));

      // Cosine palette (IQ): out = a + b*cos(2π*(c*t + d)) per channel. With the
      // three channels phase-shifted, sweeping `phase` walks the full hue wheel —
      // the soap-bubble rainbow.
      const TWO_PI = float(6.2831853);
      const r = cos(phase.add(0.0).mul(TWO_PI)).mul(0.5).add(0.5);
      const g = cos(phase.add(0.3333).mul(TWO_PI)).mul(0.5).add(0.5);
      const b = cos(phase.add(0.6667).mul(TWO_PI)).mul(0.5).add(0.5);

      // Weight the iridescent color by the fresnel rim (squared to tighten it)
      // and the intensity knob, so the film glows at the edges, not the center.
      const rim = pow(fresnel, float(1.6)).mul(uIntensity);
      const emissiveNode = vec3(r, g, b).mul(rim);

      const mat = new MeshPhysicalNodeMaterial();
      mat.transmission = 1;
      mat.ior = 1.4;
      mat.thickness = 0.5;
      mat.roughness = 0.05;
      mat.metalness = 0;
      mat.transparent = true;
      // Drive the material's own thin-film iridescence too (the PBR look).
      mat.iridescence = 1;
      mat.iridescenceIOR = 1.3;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      const baseRotY = mesh ? mesh.rotation.y : 0;

      return {
        // Looping/stateful effect — hues cycle continuously.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uHueSpeed.value = num(params.hueSpeed, 1.2);
          uIntensity.value = num(params.intensity, 1.4);
          uThickness.value = num(params.thickness, 3);
          if (mesh) mesh.rotation.y = baseRotY + t * num(params.rotateSpeed, 0.4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'hueSpeed') uHueSpeed.value = num(value, 1.2);
          else if (id === 'intensity') uIntensity.value = num(value, 1.4);
          else if (id === 'thickness') uThickness.value = num(value, 3);
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
