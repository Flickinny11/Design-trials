// light-sweep — a single clean specular band glances diagonally across the card
// surface, like light catching glossy plastic. MEDIUM / shimmer primitive. Swaps
// the host card's material for a MeshStandardNodeMaterial whose emissiveNode adds
// a moving diagonal band: b = smoothstep(width, 0, abs(dot(uv, dir) - uSweep));
// emissive += tint * b * intensity. seek() advances uSweep across the surface so
// the band loops continuously. DISTINCT from holographic (rainbow foil) and
// metallic-sheen — one crisp specular streak, no rainbow.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  dot,
  abs,
  smoothstep,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
  { id: 'width', label: 'Width', type: 'knob', min: 0.04, max: 0.4, step: 0.01, default: 0.14 },
  { id: 'angleDeg', label: 'Angle', type: 'knob', min: -90, max: 90, step: 1, default: 35, unit: 'deg' },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.6 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#ffffff' },
] as const;

// The diagonal projection dot(uv, dir) spans roughly [-1, 1] (uv centered to
// [-0.5, 0.5] then projected); sweep travels a little past both edges so the
// band enters and exits cleanly.
const SWEEP_LO = -1.2;
const SWEEP_HI = 1.2;
const SWEEP_SPAN = SWEEP_HI - SWEEP_LO;

export const lightSweepPrimitive: PrimitiveDefinition = {
  name: 'light-sweep',
  label: 'Light Sweep',
  category: 'shimmer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A bright specular band sweeps diagonally across the card surface, like light glancing off glossy plastic.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'light-sweep', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#ffffff'));

      const uSweep = uniform(SWEEP_LO);
      const uWidth = uniform(num(params.width, 0.14));
      const uIntensity = uniform(num(params.intensity, 1.6));
      const uDirX = uniform(Math.cos((num(params.angleDeg, 35) * Math.PI) / 180));
      const uDirY = uniform(Math.sin((num(params.angleDeg, 35) * Math.PI) / 180));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Project the centered uv onto the (normalized-ish) sweep direction, then
      // build a soft band at the moving offset uSweep. smoothstep(width, 0, d)
      // is 1 at the band centre (d=0) and falls to 0 at d=width.
      const centered = uv().sub(vec2(0.5, 0.5));
      const dir = vec2(uDirX, uDirY);
      const proj = dot(centered, dir);
      const d = abs(proj.sub(uSweep));
      const band = smoothstep(uWidth, float(0), d);

      const emissiveNode = vec3(uR, uG, uB).mul(band).mul(uIntensity);

      // Keep the card's gloss; the band lives in emissive so it reads as a
      // specular streak over the existing PBR surface.
      const mat = new MeshStandardNodeMaterial({
        transparent: true,
        roughness: 0.28,
        metalness: 0.5,
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      const dirRadFor = (deg: number) => (deg * Math.PI) / 180;

      return {
        // Looping/stateful: the band sweeps forever.
        duration: () => Infinity,
        seek: (t) => {
          const speed = num(params.speed, 1);
          // Phase loops 0..1; map onto the sweep travel range.
          const ph = ((t * speed * 0.4) % 1 + 1) % 1;
          uSweep.value = SWEEP_LO + ph * SWEEP_SPAN;
          // Publish the band position into host scratch so the driver (and CPU
          // observers) can read the loop phase without poking the GPU.
          target.userData.lightSweep = uSweep.value;
          // Read params live so control changes apply with no rebuild.
          uWidth.value = num(params.width, 0.14);
          uIntensity.value = num(params.intensity, 1.6);
          const rad = dirRadFor(num(params.angleDeg, 35));
          uDirX.value = Math.cos(rad);
          uDirY.value = Math.sin(rad);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'width') uWidth.value = num(value, 0.14);
          else if (id === 'intensity') uIntensity.value = num(value, 1.6);
          else if (id === 'angleDeg') {
            const rad = dirRadFor(num(value, 35));
            uDirX.value = Math.cos(rad);
            uDirY.value = Math.sin(rad);
          } else if (id === 'tint' && typeof value === 'string') {
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
