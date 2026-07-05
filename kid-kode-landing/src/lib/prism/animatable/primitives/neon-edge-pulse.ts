// neon-edge-pulse — a neon outline traces the card's border and pulses, glowing
// like a sign tube. MEDIUM / shimmer / TSL primitive. Swaps the host card's
// material for a MeshStandardNodeMaterial whose emissiveNode adds a uv-derived
// border band (smoothstep from the nearest edge) modulated by a sine pulse on a
// time uniform. seek() advances uTime; the effect loops forever (duration
// Infinity). onParamChange() keeps the live uniforms in sync.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, min, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.2, max: 8, step: 0.1, default: 3 },
  { id: 'thickness', label: 'Thickness', type: 'knob', min: 0.02, max: 0.2, step: 0.005, default: 0.08 },
  { id: 'baseGlow', label: 'Base Glow', type: 'knob', min: 0, max: 3, step: 0.05, default: 0.6 },
  { id: 'pulseGlow', label: 'Pulse Glow', type: 'knob', min: 0, max: 4, step: 0.05, default: 1.6 },
  { id: 'color', label: 'Color', type: 'color', default: '#00e5ff' },
] as const;

export const neonEdgePulsePrimitive: PrimitiveDefinition = {
  name: 'neon-edge-pulse',
  label: 'Neon Edge Pulse',
  category: 'shimmer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    "A neon outline traces the card's border and pulses, glowing like a sign tube — a looping idle effect.",
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'neon-edge-pulse', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.color, '#00e5ff'));

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 3));
      const uThickness = uniform(num(params.thickness, 0.08));
      const uBaseGlow = uniform(num(params.baseGlow, 0.6));
      const uPulseGlow = uniform(num(params.pulseGlow, 1.6));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Border band: distance to the nearest of the 4 edges in uv space, run
      // through smoothstep(thickness, 0, d) so the band is bright at the edge
      // (d=0) and falls off toward the interior.
      const u = uv();
      const edgeDist = min(min(u.x, float(1).sub(u.x)), min(u.y, float(1).sub(u.y)));
      const edge = smoothstep(uThickness, float(0), edgeDist);

      // Pulse: 0.5 + 0.5*sin(uTime*speed) — a smooth breathing glow.
      const pulse = float(0.5).add(sin(uTime.mul(uSpeed)).mul(0.5));
      const glow = uBaseGlow.add(pulse.mul(uPulseGlow));

      const emissiveNode = vec3(uR, uG, uB).mul(edge).mul(glow);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the live uniform handles on the shared scratch space so the host
      // (and tests) can observe the animated clock/controls without reading pixels.
      target.userData.neonEdgePulse = { uTime, uSpeed, uThickness, uBaseGlow, uPulseGlow };

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 3);
          uThickness.value = num(params.thickness, 0.08);
          uBaseGlow.value = num(params.baseGlow, 0.6);
          uPulseGlow.value = num(params.pulseGlow, 1.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 3);
          else if (id === 'thickness') uThickness.value = num(value, 0.08);
          else if (id === 'baseGlow') uBaseGlow.value = num(value, 0.6);
          else if (id === 'pulseGlow') uPulseGlow.value = num(value, 1.6);
          else if (id === 'color' && typeof value === 'string') {
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
