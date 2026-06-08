// ring-wipe — an expanding bright ring sweeps outward from the card's center,
// revealing the card as the band passes each point. MEDIUM / GPU primitive.
// Swaps the host card's material for a MeshStandardNodeMaterial whose
// opacityNode = step(length(uv-0.5)*2, uProgress) (everything inside the
// growing radius is revealed) and whose emissiveNode boosts a bright band at
// the reveal front via smoothstep(uProgress, uProgress-edge, length(uv-0.5)*2).
// seek() advances uProgress 0 -> ~1.1 over an eased phase. The observable is
// uProgress.value, stashed on target.userData.
//
// DISTINCT from iris-wipe: iris uses a smoothstep mask (soft circle edge, no
// glowing front). ring-wipe uses a HARD step reveal AND a glowing front ring.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, length, step, smoothstep, clamp as tslClamp } from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, clamp, type EaseName, type PrimitiveDefinition } from '../contract';

// Radius runs to ~1.1 so the band finishes clearing the corners (length*2 of a
// uv corner is √2 ≈ 1.414, but the card reads as fully revealed well before).
const MAX_PROGRESS = 1.1;

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.2, unit: 's' },
  { id: 'ringGlow', label: 'Ring Glow', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.4 },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0.02, max: 0.5, step: 0.01, default: 0.16 },
  { id: 'ringColor', label: 'Ring Color', type: 'color', default: '#9fd0ff' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeOut',
    options: ['linear', 'easeOut', 'easeInOut', 'expoOut'],
  },
] as const;

export const ringWipePrimitive: PrimitiveDefinition = {
  name: 'ring-wipe',
  label: 'Ring Wipe',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'An expanding bright ring sweeps outward from the center, revealing the card as the band passes each point.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ring-wipe', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const prevMat = mesh ? (mesh.material as Material) : null;

      // Carry the card's base color/emissive into the node material so the
      // revealed surface matches the panel (graceful even if prevMat is plain).
      const srcStd = prevMat as unknown as {
        color?: Color;
        emissive?: Color;
        emissiveIntensity?: number;
        roughness?: number;
        metalness?: number;
      };
      const baseColor = srcStd?.color instanceof Color ? srcStd.color.clone() : new Color('#1b2444');
      const baseEmissive = srcStd?.emissive instanceof Color ? srcStd.emissive.clone() : new Color('#101a3a');
      const baseEmInt = srcStd?.emissiveIntensity ?? 0.42;

      const [rr0, rg0, rb0] = rgb(str(params.ringColor, '#9fd0ff'));

      const uProgress = uniform(0);
      const uGlow = uniform(num(params.ringGlow, 1.4));
      const uSoftness = uniform(clamp(num(params.softness, 0.16), 0.02, 0.5));
      const uRingR = uniform(rr0);
      const uRingG = uniform(rg0);
      const uRingB = uniform(rb0);
      const uBaseR = uniform(baseEmissive.r);
      const uBaseG = uniform(baseEmissive.g);
      const uBaseB = uniform(baseEmissive.b);
      const uBaseEmInt = uniform(baseEmInt);

      // Normalized distance from card center: 0 at center, ~1 at edge midpoints.
      const d = length(uv().sub(vec2(0.5, 0.5))).mul(2);

      // Hard reveal: opaque where d <= uProgress (step(edge, x) = 1 when x>=edge).
      const reveal = step(d, uProgress);

      // Bright front ring: a band just behind the reveal front. smoothstep(
      // uProgress, uProgress-softness, d) = 1 at d == uProgress, fading to 0 by
      // d == uProgress-softness (i.e. brightest right at the sweeping front).
      const band = smoothstep(uProgress, uProgress.sub(uSoftness), d).mul(reveal);

      // emissive = base panel glow + bright ring tint scaled by ringGlow.
      const baseEm = vec3(uBaseR, uBaseG, uBaseB).mul(uBaseEmInt);
      const ringEm = vec3(uRingR, uRingG, uRingB).mul(band).mul(uGlow);
      const emissiveNode = baseEm.add(ringEm);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      mat.color.setRGB(baseColor.r, baseColor.g, baseColor.b);
      mat.roughness = srcStd?.roughness ?? 0.32;
      mat.metalness = srcStd?.metalness ?? 0.45;
      // Cast node assignments like caustics.ts to dodge strict TSL typing.
      (mat as unknown as { opacityNode: unknown }).opacityNode = tslClamp(reveal, 0, 1);
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      if (mesh) mesh.material = mat;

      // Observable: stash the live uniform handles on userData.
      target.userData.ringProgress = uProgress;
      target.userData.ringGlow = uGlow;

      const applyPhase = (t: number) => {
        const dur = num(params.duration, 1.2);
        const p = ease(str(params.curve, 'easeOut') as EaseName, phase(t, dur));
        uProgress.value = p * MAX_PROGRESS;
      };

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          // Read live params so control changes apply without a rebuild.
          uGlow.value = num(params.ringGlow, 1.4);
          uSoftness.value = clamp(num(params.softness, 0.16), 0.02, 0.5);
          applyPhase(t);
        },
        onParamChange: (id, value) => {
          if (id === 'ringGlow') uGlow.value = num(value, 1.4);
          else if (id === 'softness') uSoftness.value = clamp(num(value, 0.16), 0.02, 0.5);
          else if (id === 'ringColor' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uRingR.value = r;
            uRingG.value = g;
            uRingB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.ringProgress;
          delete target.userData.ringGlow;
          mat.dispose();
        },
      };
    },
  ),
};
