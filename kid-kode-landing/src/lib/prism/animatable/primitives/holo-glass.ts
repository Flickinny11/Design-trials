// holo-glass — a holographic transmissive panel: clear glass overlaid with a
// shifting iridescent HUD sheen that drifts with time. HARD / GPU node-material
// primitive. Swaps the host card's material for a transmissive
// MeshPhysicalNodeMaterial (transmission=1, low roughness, ior~1.4) and overlays
// a thin moving rainbow via emissiveNode: a banded hue = fract(dot(uv,dir)*bands
// + uTime*drift) is fed through a phase-shifted cosine palette to make a
// rainbow stripe pattern that scrolls over the clear glass. DISTINCT from
// iridescent-glass (full thin-film iridescence on a sphere) and holographic
// (opaque foil) — here it's CLEAR glass with a holo sheen overlay only.
//
// seek() advances the time uniform (CPU-observable via uTime.value) AND nudges
// the card's rotation so play is observable without a GPU; numeric controls are
// read live in seek() and mirrored through onParamChange to the uniforms.
// prevMat is restored in dispose along with the rotation and the created
// material is disposed.

import { Mesh, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, dot, fract, cos } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'drift', label: 'Drift', type: 'knob', min: 0, max: 3, step: 0.05, default: 0.6 },
  { id: 'bands', label: 'Bands', type: 'knob', min: 1, max: 6, step: 0.1, default: 3 },
  { id: 'sheen', label: 'Sheen', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.6 },
] as const;

export const holoGlassPrimitive: PrimitiveDefinition = {
  name: 'holo-glass',
  label: 'Holo Glass',
  category: 'glass',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A holographic transmissive panel — clear glass overlaid with a shifting iridescent HUD sheen that drifts with time.',
  create: defineAnimatable(
    { name: 'holo-glass', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDrift = uniform(num(params.drift, 0.6));
      const uBands = uniform(num(params.bands, 3));
      const uSheen = uniform(num(params.sheen, 0.6));

      // Holographic HUD sheen over clear glass. A diagonal projection of uv,
      // scaled by `bands`, scrolled by uTime*drift, wrapped to [0,1) with fract,
      // gives a moving banded coordinate. A phase-shifted cosine palette turns
      // that scalar into a rainbow; weight by sheen so it's a thin overlay.
      const u = uv();
      const dir = vec2(float(0.7071), float(0.7071)); // diagonal sweep
      const hue = fract(dot(u, dir).mul(uBands).add(uTime.mul(uDrift)));
      const TWO_PI = float(6.283185307);
      const holo = vec3(
        cos(hue.add(0.0).mul(TWO_PI)).mul(0.5).add(0.5),
        cos(hue.add(0.33).mul(TWO_PI)).mul(0.5).add(0.5),
        cos(hue.add(0.67).mul(TWO_PI)).mul(0.5).add(0.5),
      );
      const emissiveNode = holo.mul(uSheen);

      const mat = new MeshPhysicalNodeMaterial();
      mat.transmission = 1;
      mat.thickness = 0.5;
      mat.roughness = 0.05;
      mat.ior = 1.4;
      mat.metalness = 0;
      mat.transparent = true;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      const baseRotY = mesh ? mesh.rotation.y : 0;

      return {
        // Looping/stateful effect — the holo sheen drifts continuously.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.drift, 0.6);
          uBands.value = num(params.bands, 3);
          uSheen.value = num(params.sheen, 0.6);
          // CPU-observable motion: the panel rocks gently as the sheen drifts.
          if (mesh) mesh.rotation.y = baseRotY + Math.sin(t * 0.6) * 0.18;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'drift') uDrift.value = num(value, 0.6);
          else if (id === 'bands') uBands.value = num(value, 3);
          else if (id === 'sheen') uSheen.value = num(value, 0.6);
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
