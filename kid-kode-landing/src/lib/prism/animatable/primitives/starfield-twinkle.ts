// starfield-twinkle — a dense field of tiny stars twinkles across the card
// surface. MEDIUM / shimmer / TSL primitive. Swaps the host card's material for
// a MeshStandardNodeMaterial whose emissiveNode hashes the scaled uv into a
// sparse star field; each lit point pulses up and down out of phase via a sine
// of (uTime*rate + hash). seek() advances the time uniform; onParamChange()
// updates the live uniforms. DISTINCT from diamond-sparkle (few sharp glints):
// this is many small twinkling points, like a night sky.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec3,
  float,
  sin,
  floor,
  fract,
  length,
  step,
  smoothstep,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'density', label: 'Density', type: 'knob', min: 10, max: 60, step: 1, default: 32 },
  { id: 'rate', label: 'Rate', type: 'knob', min: 0.2, max: 6, step: 0.1, default: 2 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.4 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#cfe0ff' },
] as const;

export const starfieldTwinklePrimitive: PrimitiveDefinition = {
  name: 'starfield-twinkle',
  label: 'Starfield Twinkle',
  category: 'shimmer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A field of tiny stars twinkles across the surface, points fading up and down out of phase like a night sky.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'starfield-twinkle', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#cfe0ff'));

      const uTime = uniform(0);
      const uDensity = uniform(num(params.density, 32));
      const uRate = uniform(num(params.rate, 2));
      const uIntensity = uniform(num(params.intensity, 1.4));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Hashed star field: divide uv into `density` cells; a deterministic
      // sin-based hash of each cell id decides whether that cell holds a star
      // (step threshold) and seeds its twinkle phase. The star body is a small
      // round dot centered in its cell (smoothstep on distance from cell center).
      const grid = uv().mul(uDensity);
      const cell = floor(grid); // integer cell id (vec2)
      const local = fract(grid).sub(0.5); // -0.5..0.5 within the cell

      // sin-based deterministic hash → 0..1 (mirrors the index-hash idiom used
      // across the catalog: fract(sin(dot)*43758.5453)).
      const h = fract(
        sin(cell.x.mul(12.9898).add(cell.y.mul(78.233))).mul(43758.5453),
      );

      // Only ~8% of cells become stars (step at 0.92).
      const isStar = step(float(0.92), h);
      // Round dot, soft edge: bright at center, fading to 0 by radius 0.5.
      const dot = smoothstep(float(0.5), float(0.0), length(local));
      const star = isStar.mul(dot);

      // Out-of-phase twinkle: 0.5 + 0.5*sin(uTime*rate + h*2π).
      const twinkle = sin(uTime.mul(uRate).add(h.mul(6.28318))).mul(0.5).add(0.5);

      const emissiveNode = vec3(uR, uG, uB).mul(star).mul(twinkle).mul(uIntensity);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      // Keep the panel readable; the stars are an additive emissive layer.
      mat.color = new Color('#0a1024');
      mat.roughness = 0.5;
      mat.metalness = 0.2;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the time uniform on shared scratch space so the host (and tests)
      // can observe the advancing clock that drives the twinkle.
      target.userData.starfieldUTime = uTime;

      return {
        // Stateful/looping twinkle: animate continuously across t.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDensity.value = num(params.density, 32);
          uRate.value = num(params.rate, 2);
          uIntensity.value = num(params.intensity, 1.4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'density') uDensity.value = num(value, 32);
          else if (id === 'rate') uRate.value = num(value, 2);
          else if (id === 'intensity') uIntensity.value = num(value, 1.4);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
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
