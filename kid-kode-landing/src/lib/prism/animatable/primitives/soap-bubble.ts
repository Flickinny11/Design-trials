// soap-bubble — a thin-film soap bubble. HARD / GPU node-material primitive.
// Swaps the host sphere's material for a transmissive MeshPhysicalNodeMaterial
// (transmission 1, ior ~1.2, roughness 0, thin thickness) and drives TWO live
// effects:
//
//   1. Iridescent thin-film tint — a fresnel-driven cosine hue palette (IQ
//      style) whose phase scrolls with uTime*filmShift, applied as an
//      emissiveNode rim AND mirrored onto the material's own PBR `iridescence`.
//   2. A wobbling membrane — a positionNode displacement = sin(positionLocal*f
//      + uTime)*wobble pushed along the local normal, so the bubble's skin
//      breathes with surface tension.
//
// Distinct from iridescent-glass (which is a faceted/static-shaped fresnel
// shimmer): this is a thin-film *bubble* whose actual geometry wobbles via a
// positionNode and whose swirl drifts. seek() advances uTime, reads knobs live,
// and slowly tumbles the sphere so play is CPU-observable; onParamChange()
// keeps uniforms in sync. prevMat restored in dispose().

import { Mesh, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  positionLocal,
  normalLocal,
  vec3,
  float,
  sin,
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
  { id: 'filmShift', label: 'Film shift', type: 'knob', min: 0, max: 4, step: 0.05, default: 1.1 },
  { id: 'wobble', label: 'Wobble', type: 'knob', min: 0, max: 0.08, step: 0.002, default: 0.03 },
  { id: 'thickness', label: 'Thickness', type: 'fader', min: 0.05, max: 1.2, step: 0.01, default: 0.25 },
] as const;

export const soapBubblePrimitive: PrimitiveDefinition = {
  name: 'soap-bubble',
  label: 'Soap Bubble',
  category: 'glass',
  difficulty: 'hard',
  subject: 'sphere',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A thin-film soap bubble — transmissive sphere swirled with shifting iridescent interference colors and a wobbling skin.',
  create: defineAnimatable(
    { name: 'soap-bubble', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uFilmShift = uniform(num(params.filmShift, 1.1));
      const uWobble = uniform(num(params.wobble, 0.03));

      // ── Thin-film iridescence ────────────────────────────────────────────
      // Fresnel: bright at grazing angles, where a soap film's color is richest.
      const facing = tslMax(normalView.dot(positionViewDirection), float(0));
      const fresnel = oneMinus(facing);
      // Interference phase grows toward the rim and scrolls with time so the
      // bubble's hues swirl continuously.
      const phase = fresnel.mul(float(3.0)).add(uTime.mul(uFilmShift));
      const TWO_PI = float(6.2831853);
      const r = cos(phase.add(0.0).mul(TWO_PI)).mul(0.5).add(0.5);
      const g = cos(phase.add(0.3333).mul(TWO_PI)).mul(0.5).add(0.5);
      const b = cos(phase.add(0.6667).mul(TWO_PI)).mul(0.5).add(0.5);
      // Concentrate the color on the rim (squared fresnel) — the film glows at
      // the edge of the bubble, faint through the transmissive center.
      const rim = pow(fresnel, float(1.5));
      const emissiveNode = vec3(r, g, b).mul(rim);

      // ── Wobbling membrane (surface tension) ──────────────────────────────
      // A low-frequency sine of local position, phase-driven by time, summed
      // across axes and pushed along the local normal. Annotate the fluent
      // accumulator as `any` to dodge the narrow VarNode typing under strict tsc.
      const f = float(2.4);
      const p = positionLocal.mul(f);
      let breathe: any = sin(p.x.add(uTime)).add(sin(p.y.add(uTime.mul(1.3))));
      breathe = breathe.add(sin(p.z.add(uTime.mul(0.8))));
      const displaced = positionLocal.add(normalLocal.mul(breathe.mul(uWobble)));

      const mat = new MeshPhysicalNodeMaterial();
      mat.transmission = 1;
      mat.thickness = num(params.thickness, 0.25);
      mat.roughness = 0;
      mat.metalness = 0;
      mat.ior = 1.2;
      mat.transparent = true;
      // The material's own thin-film term for the PBR soap-film look.
      mat.iridescence = 1;
      mat.iridescenceIOR = 1.3;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;
      (mat as unknown as { positionNode: unknown }).positionNode = displaced;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      const baseRotY = mesh ? mesh.rotation.y : 0;

      // Publish driven uniforms so the host (and tests) can observe live state.
      target.userData.soapBubble = { uTime, uFilmShift, uWobble };

      return {
        // Looping/continuous effect — the film swirls forever.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
          // Read knobs live so control changes apply with no rebuild.
          uFilmShift.value = num(params.filmShift, 1.1);
          uWobble.value = num(params.wobble, 0.03);
          // thickness is a material scalar, not a node uniform — keep in sync.
          mat.thickness = num(params.thickness, 0.25);
          // Slow tumble so play is CPU-observable (rotation differs frame-to-frame).
          if (mesh) mesh.rotation.y = baseRotY + t * 0.35;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'filmShift') uFilmShift.value = num(value, 1.1);
          else if (id === 'wobble') uWobble.value = num(value, 0.03);
          else if (id === 'thickness') mat.thickness = num(value, 0.25);
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
