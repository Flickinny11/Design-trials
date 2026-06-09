// water-droplet — a clear water-droplet lens. HARD / GPU node-material primitive.
// Swaps the host sphere's material for a high-transmission MeshPhysicalNode-
// Material tuned to water (ior ~1.33, roughness 0), so it magnifies and refracts
// what's behind it. A subtle surface-tension wobble is applied as a *vertex*
// displacement via positionNode: each vertex is pushed along its local normal by
// sin(position*frequency + uTime) * amplitude, so the droplet's skin jiggles like
// real surface tension. seek() advances uTime and reads knobs live; onParamChange
// updates the live uniforms. dispose() restores the swapped material + disposes
// the created one. Distinct from glass-refraction (no wobble) and liquid-glass
// (normal-only perturbation): this is a true positional surface-tension jiggle on
// a water-tuned transmissive lens.

import { Mesh, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  positionLocal,
  normalLocal,
  float,
  sin,
  vec3,
  normalView,
  positionViewDirection,
  pow,
  max as tslMax,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

// Default thickness lowered 0.8 → 0.6: water (ior 1.33) at thickness 0.8
// magnifies hard enough that the droplet's on-axis centre samples the inverted
// dim periphery of the backdrop and reads near-black. 0.6 keeps an obvious
// lens magnify/invert while letting the centre actually sample the bright
// on-axis hero behind it. ior unchanged (1.33). Full 0.1..2 range retained.
const SCHEMA = [
  { id: 'ior', label: 'IOR', type: 'fader', min: 1.2, max: 1.5, step: 0.01, default: 1.33 },
  { id: 'wobble', label: 'Wobble', type: 'knob', min: 0, max: 0.1, step: 0.005, default: 0.04 },
  { id: 'thickness', label: 'Thickness', type: 'fader', min: 0.1, max: 2, step: 0.05, default: 0.6 },
  { id: 'frequency', label: 'Frequency', type: 'knob', min: 1, max: 12, step: 0.5, default: 6 },
] as const;

export const waterDropletPrimitive: PrimitiveDefinition = {
  name: 'water-droplet',
  label: 'Water Droplet',
  category: 'glass',
  difficulty: 'hard',
  subject: 'sphere',
  defaultDriver: 'time',
  description:
    "A clear water droplet lens — high-transmission sphere that magnifies and refracts what's behind it, with a moving surface tension wobble.",
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'water-droplet', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uWobble = uniform(num(params.wobble, 0.04));
      const uFreq = uniform(num(params.frequency, 6));

      // Surface-tension wobble: displace each vertex along its local normal by
      // sin(localPosition * frequency + time) * amplitude. Summing the three
      // axis components of the scaled position before the sine gives a coherent
      // moving ripple across the droplet's skin rather than an axis-aligned one.
      const p = positionLocal.mul(uFreq);
      const wave = sin(p.x.add(p.y).add(p.z).add(uTime));
      const displaced = positionLocal.add(normalLocal.mul(wave.mul(uWobble)));

      // Luminous internal CORE: the catalog preview rig renders tiles through a
      // scissored multi-view pass that does NOT populate three's transmission
      // render target, so a perfectly clear transmissive sphere has no backdrop
      // to refract and its on-axis centre reads pure black. We give the droplet a
      // genuine soft glow from within via an emissiveNode. `facing` (= n·viewDir)
      // peaks where the surface faces the camera — the geometric centre — and
      // falls to 0 at the rim (the complement of the fresnel rim). pow(facing,2)
      // keeps the glow tight to the on-axis core so the centre glows softly
      // instead of reading black, while the rim still catches the env + bokeh
      // through transmission. Cool water-blue tint.
      const facing = tslMax(normalView.dot(positionViewDirection), float(0));
      // Bright saturated cyan core so the droplet reads as a luminous water lens,
      // not a dull grey matte blob (the rig can't transmit a backdrop).
      const core = pow(facing, float(2)).mul(float(1.15));
      const emissive = vec3(0.32, 0.72, 1.0).mul(core);

      const mat = new MeshPhysicalNodeMaterial({
        transmission: 1,
        thickness: num(params.thickness, 0.6),
        roughness: 0,
        metalness: 0,
        ior: num(params.ior, 1.33),
        transparent: true,
      });
      (mat as unknown as { positionNode: unknown }).positionNode = displaced;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissive;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish the driven uniforms to the shared scratch space so the host (and
      // tests) can observe the live wobble state without reaching into the TSL
      // graph (headless has no GPU to read pixels from).
      target.userData.waterDroplet = { uTime, uWobble, uFreq };

      return {
        // Continuous looping effect — the droplet wobbles forever.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read knobs live so control changes apply with no rebuild.
          uWobble.value = num(params.wobble, 0.04);
          uFreq.value = num(params.frequency, 6);
          // ior + thickness are material scalars, not node uniforms — keep synced.
          mat.ior = num(params.ior, 1.33);
          mat.thickness = num(params.thickness, 0.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'wobble') uWobble.value = num(value, 0.04);
          else if (id === 'frequency') uFreq.value = num(value, 6);
          else if (id === 'ior') mat.ior = num(value, 1.33);
          else if (id === 'thickness') mat.thickness = num(value, 0.8);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
