// sparkle-glints — tiny star-like glints twinkle on and off across the surface,
// like sun on water. HARD / GPU primitive (category 'shimmer'). Swaps the host
// plane's material for a MeshBasicNodeMaterial whose colorNode hashes the uv
// into a grid of cells; each cell has a deterministic twinkle phase driven by a
// time uniform, and where that phase exceeds a threshold a bright point blooms
// with a sharp pow falloff toward the cell centre. seek()/onParamChange()
// advance the time + live uniforms; dispose() restores the swapped material.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  floor,
  fract,
  sin,
  dot,
  abs,
  max,
  pow,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'density', label: 'Density', type: 'knob', min: 2, max: 24, step: 1, default: 9 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.4 },
  { id: 'threshold', label: 'Threshold', type: 'knob', min: 0, max: 0.99, step: 0.01, default: 0.72 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#fff6d8' },
] as const;

const TWO_PI = 6.283185307179586;

export const sparkleGlintsPrimitive: PrimitiveDefinition = {
  name: 'sparkle-glints',
  label: 'Sparkle Glints',
  category: 'shimmer',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Tiny star-like glints twinkle on and off across the surface, like sun on water.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'sparkle-glints', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#fff6d8'));
      const uTime = uniform(0);
      const uDensity = uniform(num(params.density, 9));
      const uSpeed = uniform(num(params.speed, 1.4));
      const uThreshold = uniform(num(params.threshold, 0.72));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Hash the uv into a grid of cells. Each cell (its integer coords) is
      // hashed deterministically into a 0..1 value; that value both offsets the
      // cell's twinkle phase (so cells light at different times) and gates which
      // cells ever sparkle. A sharp pow falloff toward each cell centre makes the
      // lit cell read as a tiny point of light, not a filled square.
      const u = uv();
      const grid = u.mul(uDensity);
      const cell = floor(grid); // integer cell coords (vec2)
      const local = fract(grid); // 0..1 within the cell (vec2)

      // Deterministic per-cell hash: fract(sin(dot(cell, k)) * big).
      const cellHash = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453));

      // Twinkle phase: sin(uTime*speed + cellHash*2π) in 0..1.
      const twinkle = sin(uTime.mul(uSpeed).add(cellHash.mul(float(TWO_PI)))).mul(0.5).add(0.5);

      // Gate: only cells whose phase exceeds the threshold contribute.
      const lit = max(twinkle.sub(uThreshold), float(0)).div(max(float(1).sub(uThreshold), float(0.001)));

      // Distance toward the cell centre (0.5, 0.5); sharp pow falloff -> a point.
      const d = abs(local.sub(vec2(0.5, 0.5)));
      const dist = max(d.x, d.y); // chebyshev radius, 0 at centre .. 0.5 at edge
      const falloff = pow(max(float(1).sub(dist.mul(2.0)), float(0)), float(7));

      // Bright star core, sharpened twinkle, tinted.
      const glint = pow(lit, float(2)).mul(falloff).mul(float(1.6));
      const colorNode = vec3(uR, uG, uB).mul(glint);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniform handles through the host-shared scratch space
      // (contract: userData is "Scratch space shared with the host (uniform
      // handles, etc.)"). Lets the host/tests observe driven state on CPU.
      target.userData.sparkleGlints = { uTime, uDensity, uSpeed, uThreshold, uR, uG, uB };

      return {
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDensity.value = num(params.density, 9);
          uSpeed.value = num(params.speed, 1.4);
          uThreshold.value = num(params.threshold, 0.72);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'density') uDensity.value = num(value, 9);
          else if (id === 'speed') uSpeed.value = num(value, 1.4);
          else if (id === 'threshold') uThreshold.value = num(value, 0.72);
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
