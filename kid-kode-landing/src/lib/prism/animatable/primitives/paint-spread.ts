// paint-spread — paint blooms across the card from the center: an organic,
// ink-edged blot grows from a point to fill the surface and reveal the card.
// HARD / displacement primitive. Swaps the card panel's material for a
// MeshStandardNodeMaterial whose opacityNode is a smoothstep over a center-out
// radial distance d = length(uv-0.5), where the front edge is perturbed by a
// sin/fbm noise so the blot edge is ragged and organic rather than a clean
// circle. seek() advances uProgress 0 -> ~1.0 so the reveal grows continuously.
// DISTINCT from ink-spread (a wave-category fluid look): this is a center-out
// ALPHA reveal of the card surface itself, not a colored fluid wave.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, float, sin, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import {
  num,
  clamp,
  phase,
  type ControlValue,
  type PrimitiveDefinition,
} from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'noiseScale', label: 'Noise Scale', type: 'knob', min: 2, max: 12, step: 0.1, default: 6 },
  { id: 'wobble', label: 'Wobble', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.18 },
] as const;

export const paintSpreadPrimitive: PrimitiveDefinition = {
  name: 'paint-spread',
  label: 'Paint Spread',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Paint blooms across the card from the center, an organic ink-edged blot growing to fill the surface and reveal it.',
  create: defineAnimatable(
    { name: 'paint-spread', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      // uProgress = the growing blot radius. noiseScale = edge raggedness
      // frequency; wobble = how far the noise pushes the front in/out.
      const uProgress = uniform(0);
      const uNoiseScale = uniform(num(params.noiseScale, 6));
      const uWobble = uniform(num(params.wobble, 0.18));

      // Radial center-out distance: d = length(uv - 0.5). Max distance to a
      // corner is ~0.707, so a progress sweep across [0, ~1] fully covers.
      const u = uv();
      const d = u.sub(vec2(0.5, 0.5)).length();

      // Organic edge noise: a couple of layered sines of the scaled uv form a
      // cheap fbm-like value in roughly [-1, 1], scaled by wobble. Added to the
      // smoothstep edges so the reveal front is ragged rather than a clean ring.
      const sx = u.x.mul(uNoiseScale);
      const sy = u.y.mul(uNoiseScale);
      const n1 = sin(sx.mul(1.7).add(sy.mul(0.9)));
      const n2 = sin(sx.mul(0.6).sub(sy.mul(1.9)).add(2.3));
      const noise = n1.mul(0.6).add(n2.mul(0.4)).mul(uWobble);

      // opacityNode = smoothstep(uProgress, uProgress - edge, d - noise):
      // edge0 = uProgress (outer), edge1 = uProgress - edge (inner). Because
      // edge0 > edge1, the smoothstep is 1 where (d - noise) <= inner and falls
      // to 0 across the soft band — paint is opaque inside the noisy front and
      // grows outward as uProgress increases. The noise perturbs `d`, giving the
      // blot a ragged ink edge.
      const edge = float(0.08);
      const front = d.sub(noise);
      const opacityNode = smoothstep(uProgress, uProgress.sub(edge), front);

      const prevMat = mesh ? (mesh.material as Material) : null;
      const mat = new MeshStandardNodeMaterial({ transparent: true });
      if (prevMat) {
        const pm = prevMat as unknown as {
          color?: unknown;
          emissive?: unknown;
          emissiveIntensity?: number;
          roughness?: number;
          metalness?: number;
        };
        const nm = mat as unknown as {
          color: { copy: (c: unknown) => void };
          emissive: { copy: (c: unknown) => void };
          emissiveIntensity: number;
          roughness: number;
          metalness: number;
        };
        if (pm.color) nm.color.copy(pm.color);
        if (pm.emissive) nm.emissive.copy(pm.emissive);
        if (typeof pm.emissiveIntensity === 'number') nm.emissiveIntensity = pm.emissiveIntensity;
        if (typeof pm.roughness === 'number') nm.roughness = pm.roughness;
        if (typeof pm.metalness === 'number') nm.metalness = pm.metalness;
      }
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;
      if (mesh) mesh.material = mat;

      // Share the driving uniform handles with the host (userData is the
      // sanctioned scratch space for uniform handles — see contract.ts).
      target.userData.paintSpread = { uProgress, uNoiseScale, uWobble };

      const duration = () => num(params.duration, 1.4);

      return {
        duration,
        seek: (t) => {
          // uProgress sweeps 0 -> ~1.0 + a margin so the blot fully covers the
          // card (max radial distance to a corner ~0.707, plus the wobble band).
          const p = phase(t, duration());
          const wob = clamp(num(params.wobble, 0.18), 0, 0.4);
          uProgress.value = p * (0.85 + wob);
          // read knobs live so control changes apply on the next seek.
          uNoiseScale.value = num(params.noiseScale, 6);
          uWobble.value = wob;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'noiseScale') uNoiseScale.value = num(value, 6);
          else if (id === 'wobble') uWobble.value = clamp(num(value, 0.18), 0, 0.4);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
