// iris-wipe — a circular iris opens from the card's center and reveals it
// outward, like a camera iris. MEDIUM / GPU primitive. Swaps the host card's
// material for a MeshStandardNodeMaterial whose opacityNode is a smoothstep
// mask over (uRadius - length(uv - center)): pixels inside the growing circle
// are opaque, outside transparent. seek() grows uRadius 0 -> ~0.8 over an eased
// phase. The observable is uRadius.value, stashed on target.userData.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, length, smoothstep, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, clamp, type EaseName, type PrimitiveDefinition } from '../contract';

const MAX_RADIUS = 0.8;

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.2, unit: 's' },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0.005, max: 0.4, step: 0.005, default: 0.08 },
  { id: 'centerBias', label: 'Center Bias', type: 'knob', min: -0.3, max: 0.3, step: 0.01, default: 0 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeOut', 'easeInOut', 'expoOut'],
  },
] as const;

export const irisWipePrimitive: PrimitiveDefinition = {
  name: 'iris-wipe',
  label: 'Iris Wipe',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A circular iris opens from the center, revealing the card outward — a camera iris.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'iris-wipe', category: 'mask', schema: SCHEMA },
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

      const uRadius = uniform(0);
      const uSoftness = uniform(clamp(num(params.softness, 0.08), 0.005, 0.4));
      // centerBias nudges the iris origin off-center along the diagonal.
      const uCenterX = uniform(0.5 + num(params.centerBias, 0));
      const uCenterY = uniform(0.5 + num(params.centerBias, 0));

      // Growing circular reveal: distance from the (biased) center, mask = 1
      // inside (uRadius - softness) fading to 0 at uRadius.
      const d = length(uv().sub(vec2(uCenterX, uCenterY)));
      const inner = uRadius.sub(uSoftness);
      // smoothstep(edge1, edge0, x): 1 when x<=inner, 0 when x>=uRadius.
      const mask = smoothstep(uRadius, inner, d);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      const [cr, cg, cb] = [baseColor.r, baseColor.g, baseColor.b];
      const [er, eg, eb] = [baseEmissive.r, baseEmissive.g, baseEmissive.b];
      mat.color.setRGB(cr, cg, cb);
      mat.emissive.setRGB(er, eg, eb);
      mat.emissiveIntensity = srcStd?.emissiveIntensity ?? 0.42;
      mat.roughness = srcStd?.roughness ?? 0.32;
      mat.metalness = srcStd?.metalness ?? 0.45;
      // Cast opacityNode like caustics.ts to dodge strict TSL typing.
      (mat as unknown as { opacityNode: unknown }).opacityNode = mask.mul(float(1));

      if (mesh) mesh.material = mat;

      // Observable: stash the radius uniform handle on userData.
      target.userData.irisRadius = uRadius;

      const applyPhase = (t: number) => {
        const dur = num(params.duration, 1.2);
        const p = ease(str(params.curve, 'easeInOut') as EaseName, phase(t, dur));
        uRadius.value = p * MAX_RADIUS;
      };

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          // Read live params so control changes apply without a rebuild.
          uSoftness.value = clamp(num(params.softness, 0.08), 0.005, 0.4);
          const cx = 0.5 + num(params.centerBias, 0);
          uCenterX.value = cx;
          uCenterY.value = cx;
          applyPhase(t);
        },
        onParamChange: (id, value) => {
          if (id === 'softness') uSoftness.value = clamp(num(value, 0.08), 0.005, 0.4);
          else if (id === 'centerBias') {
            const cx = 0.5 + num(value, 0);
            uCenterX.value = cx;
            uCenterY.value = cx;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.irisRadius;
          mat.dispose();
        },
      };
    },
  ),
};
