// pointer-ripple — concentric ripples radiate from wherever the pointer touches
// the card surface, like a finger on water. HARD / GPU / pointer primitive.
// Swaps the card panel's material for a MeshStandardNodeMaterial whose
// emissiveNode adds animated rings centered at a uPointer (vec2) uniform:
//   r    = length(uv - uPointer)
//   ring = sin(r*freq - uTime*speed) * exp(-r*falloff) * intensity
//   emissive += tint * max(0, ring)
// seek() reads userData.pointer -> uPointer and advances uTime, so the rings
// animate continuously and re-center wherever the host reports the pointer.
// DISTINCT from spotlight-follow (a static hotspot): these are travelling rings.

import { Mesh, Color, Vector2, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, exp, length, max } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'freq', label: 'Frequency', type: 'knob', min: 8, max: 40, step: 0.5, default: 20 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.5, max: 12, step: 0.1, default: 5 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.4 },
  { id: 'falloff', label: 'Falloff', type: 'knob', min: 0.2, max: 6, step: 0.1, default: 2 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#5ad4ff' },
] as const;

function readPointer(userData: Record<string, unknown>): { x: number; y: number } {
  const p = userData.pointer as { x?: unknown; y?: unknown } | undefined;
  const x = p && typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5;
  const y = p && typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5;
  return { x, y };
}

export const pointerRipplePrimitive: PrimitiveDefinition = {
  name: 'pointer-ripple',
  label: 'Pointer Ripple',
  category: 'pointer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'pointer',
  description:
    'Ripples radiate from wherever the pointer touches the card surface, like a finger on water.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'pointer-ripple', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(typeof params.tint === 'string' ? params.tint : '#5ad4ff');

      const uTime = uniform(0);
      const uPointer = uniform(new Vector2(0.5, 0.5));
      const uFreq = uniform(num(params.freq, 20));
      const uSpeed = uniform(num(params.speed, 5));
      const uIntensity = uniform(num(params.intensity, 1.4));
      const uFalloff = uniform(num(params.falloff, 2));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Distance from the pointer in uv space; rings travel outward over time and
      // attenuate with radius. The clamped sine forms bright travelling crests.
      const r = length(uv().sub(uPointer));
      const wave = sin(r.mul(uFreq).sub(uTime.mul(uSpeed)));
      const env = exp(r.mul(uFalloff).negate());
      const ring = max(wave.mul(env).mul(uIntensity), float(0));
      const emissiveNode = vec3(uR, uG, uB).mul(ring);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      const applyPointer = () => {
        const { x, y } = readPointer(target.userData);
        uPointer.value.set(x, y);
      };

      return {
        // Stateful / continuously animated — never settles.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          applyPointer();
          // Read params live so control changes apply without a rebuild.
          uFreq.value = num(params.freq, 20);
          uSpeed.value = num(params.speed, 5);
          uIntensity.value = num(params.intensity, 1.4);
          uFalloff.value = num(params.falloff, 2);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'freq') uFreq.value = num(value, 20);
          else if (id === 'speed') uSpeed.value = num(value, 5);
          else if (id === 'intensity') uIntensity.value = num(value, 1.4);
          else if (id === 'falloff') uFalloff.value = num(value, 2);
          else if (id === 'tint' && typeof value === 'string') {
            const [r1, g1, b1] = rgb(value);
            uR.value = r1;
            uG.value = g1;
            uB.value = b1;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
