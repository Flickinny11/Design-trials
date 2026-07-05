// fade-checker — the card resolves in as a soft checkerboard. The panel face is
// divided into `cells` x `cells` cells; parity-0 cells fade in over the first
// portion of the timeline and parity-1 cells over the second, so the surface
// materializes in two interleaved passes. MEDIUM / TSL primitive. Swaps the
// host card's material for a MeshStandardNodeMaterial whose opacityNode is a
// smoothstep on uProgress per checker cell. seek() advances uProgress 0->1.
//
// DISTINCT from blinds-wipe (which sweeps full stripes): here the reveal is a
// 2D checker parity, not a 1D stripe sweep.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, floor, fract, step, smoothstep, mix, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'cells', label: 'Cells', type: 'knob', min: 4, max: 16, step: 1, default: 8 },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0.02, max: 0.6, step: 0.01, default: 0.25 },
] as const;

export const fadeCheckerPrimitive: PrimitiveDefinition = {
  name: 'fade-checker',
  label: 'Checker Fade',
  category: 'fade',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Card fades in as a soft checkerboard, alternating cells resolving in two interleaved passes.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fade-checker', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uProgress = uniform(0);
      const uCells = uniform(num(params.cells, 8));
      const uSoft = uniform(num(params.softness, 0.25));

      // Checker parity in [0,1]: 0 for one set of cells, 1 for the alternating set.
      const u = uv();
      const cx = floor(u.x.mul(uCells));
      const cy = floor(u.y.mul(uCells));
      // parity = step(0.5, fract((cx + cy) * 0.5)) -> 0 or 1
      const parity = step(float(0.5), fract(cx.add(cy).mul(0.5)));

      // Two interleaved passes. parity-0 reveals over [0, 0.6] of uProgress,
      // parity-1 over [0.4, 1.0]. A per-cell start offset = parity * 0.4.
      const start = parity.mul(0.4);
      // local phase for this cell: how far uProgress has advanced past `start`,
      // scaled so each pass spans ~0.6 of the timeline.
      const local = uProgress.sub(start).div(float(0.6));
      // soft edge so cells dissolve in rather than pop.
      const reveal = smoothstep(float(0), uSoft, local);

      // Keep a floor of visibility so the card is never fully invisible at the
      // very start (reads better in the gallery), but the checker still resolves.
      const opacityNode = mix(float(0.04), float(1), reveal);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;
      // Copy a little surface character from the original panel material.
      const prevStd = mesh ? (mesh.material as unknown as { color?: { clone?: () => unknown } }) : null;
      if (mesh && prevStd && prevStd.color && typeof prevStd.color.clone === 'function') {
        (mat as unknown as { color: unknown }).color = prevStd.color.clone();
      }

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const dur = num(params.duration, 1.2);
          const p = dur <= 0 ? 1 : Math.max(0, Math.min(1, t / dur));
          uProgress.value = p;
          // Read structural params live so control changes apply on next seek.
          uCells.value = num(params.cells, 8);
          uSoft.value = num(params.softness, 0.25);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'cells') uCells.value = num(value, 8);
          else if (id === 'softness') uSoft.value = num(value, 0.25);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
