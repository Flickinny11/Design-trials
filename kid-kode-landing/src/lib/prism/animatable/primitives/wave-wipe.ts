// wave-wipe — a sinusoidal wavy reveal front sweeps across the card. The reveal
// edge undulates like a tide line: front = uv.x + sin(uv.y*waves*2PI + phase)*amp,
// and the card's opacity is smoothstep(progress+soft, progress, front). MEDIUM /
// mask. Swaps the card panel's material for a MeshStandardNodeMaterial whose
// opacityNode is the wavy mask; seek() advances uProgress 0->~1.2 and ALSO drives
// uPhase so the wavy edge ripples as it sweeps. DISTINCT from zigzag-wipe (sharp):
// the front here is a smooth sine. CPU-observable via the uProgress/uPhase uniforms.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, sin, smoothstep, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const TWO_PI = Math.PI * 2;

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'waves', label: 'Waves', type: 'knob', min: 1, max: 8, step: 1, default: 3 },
  { id: 'amplitude', label: 'Amplitude', type: 'knob', min: 0, max: 0.3, step: 0.01, default: 0.12 },
] as const;

const SOFT = 0.08; // mask softness band

export const waveWipePrimitive: PrimitiveDefinition = {
  name: 'wave-wipe',
  label: 'Wave Wipe',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A sinusoidal wavy front sweeps across the card, the reveal edge undulating like a tide line.',
  create: defineAnimatable(
    { name: 'wave-wipe', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uProgress = uniform(0);
      const uPhase = uniform(0);
      const uWaves = uniform(num(params.waves, 3));
      const uAmp = uniform(num(params.amplitude, 0.12));

      // Wavy reveal front: the sine wobble (along uv.y) offsets the horizontal
      // sweep coordinate, so the visible edge undulates instead of being straight.
      const u = uv();
      const wob = sin(u.y.mul(uWaves).mul(float(TWO_PI)).add(uPhase)).mul(uAmp);
      const frontCoord = u.x.add(wob);
      // smoothstep(progress+soft, progress, front): pixels whose frontCoord is
      // below the advancing progress edge become transparent — the wave wipes
      // the card away as progress climbs.
      const opacityNode = smoothstep(uProgress.add(float(SOFT)), uProgress, frontCoord);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      // Preserve the card's premium look by copying base color/metalness if present.
      const prevMat = mesh ? (mesh.material as Material) : null;
      if (prevMat && (prevMat as unknown as { color?: { getHex(): number } }).color) {
        const pm = prevMat as unknown as {
          color?: { getHex(): number };
          roughness?: number;
          metalness?: number;
        };
        if (pm.color) (mat.color as { setHex(h: number): void }).setHex(pm.color.getHex());
        if (typeof pm.roughness === 'number') mat.roughness = pm.roughness;
        if (typeof pm.metalness === 'number') mat.metalness = pm.metalness;
      }
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      if (mesh) mesh.material = mat;

      return {
        // progress sweeps 0 -> ~1.2 across the duration; phase ripples the edge.
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          const dur = num(params.duration, 1.4);
          const p = dur <= 0 ? 1 : t / dur;
          const clamped = p < 0 ? 0 : p > 1 ? 1 : p;
          // sweep the reveal edge a little past 1 so the card fully clears.
          uProgress.value = clamped * 1.2;
          // ripple: phase advances with normalized time so the wavy edge also moves.
          uPhase.value = clamped * TWO_PI * 1.5;
          // live param reads (no rebuild needed).
          uWaves.value = num(params.waves, 3);
          uAmp.value = num(params.amplitude, 0.12);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'waves') uWaves.value = num(value, 3);
          else if (id === 'amplitude') uAmp.value = num(value, 0.12);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
