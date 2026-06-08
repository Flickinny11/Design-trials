// checker-wipe — the card reveals as a checkerboard: cells pop in across two
// interleaved diagonal passes. The card surface is divided into a `cells` x
// `cells` grid; cell = floor(uv*cells); parity = fract((cell.x+cell.y)*0.5)*2
// labels the two checker colours; diag = (cell.x+cell.y)/(2*cells) is the
// diagonal sweep coordinate. A cell turns on (opacity 1) when its threshold —
// diag*0.5 offset by parity*0.5*0.5 — has been passed by uProgress, so the two
// parities reveal as two interleaved diagonal passes.
// MEDIUM / mask / GPU node-material primitive. Swaps the host card's material
// for a MeshStandardNodeMaterial whose opacityNode is a softened step; seek()
// advances uProgress 0 -> 1. DISTINCT from blinds-wipe (continuous stripes):
// this is discrete cells with a per-parity diagonal offset.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, floor, fract, step, smoothstep, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, phase, type ControlValue, type PrimitiveDefinition } from '../contract';

const ACCENT = '#5d8bff';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 2.5, step: 0.1, default: 1.2, unit: 's' },
  { id: 'cells', label: 'Cells', type: 'knob', min: 4, max: 16, step: 1, default: 8 },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.08 },
] as const;

export const checkerWipePrimitive: PrimitiveDefinition = {
  name: 'checker-wipe',
  label: 'Checker Wipe',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The card reveals in a checkerboard, alternating cells popping in across two interleaved diagonal passes.',
  create: defineAnimatable(
    { name: 'checker-wipe', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      // Preserve the card's tint so the cells reveal the original colour.
      const prevMat = mesh ? (mesh.material as Material) : null;
      let tint: [number, number, number] = rgb(ACCENT);
      if (prevMat && (prevMat as unknown as { color?: Color }).color) {
        const c = (prevMat as unknown as { color: Color }).color;
        tint = [c.r, c.g, c.b];
      }

      const uProgress = uniform(0);
      const uCells = uniform(num(params.cells, 8));
      const uSoftness = uniform(num(params.softness, 0.08));
      const uR = uniform(tint[0]);
      const uG = uniform(tint[1]);
      const uB = uniform(tint[2]);

      // Checkerboard reveal.
      //   cell   = floor(uv * cells)                  -> integer grid coords
      //   parity = fract((cell.x + cell.y) * 0.5) * 2 -> 0 / 1 checker label
      //   diag   = (cell.x + cell.y) / (2 * cells)    -> diagonal sweep coord
      // A cell's threshold is diag*0.5 + parity*0.5*0.5 so the two parities
      // read as two interleaved diagonal passes. The cell turns on where its
      // threshold is below uProgress (softened by a smoothstep band).
      const u = uv();
      const cell = floor(u.mul(uCells));
      const sum = cell.x.add(cell.y);
      const parity = fract(sum.mul(0.5)).mul(2);
      const diag = sum.div(uCells.mul(2));
      const threshold = diag.mul(0.5).add(parity.mul(0.5 * 0.5));
      // Hard step matches the spec; a softness band feathers the cell edges.
      const hard = step(threshold, uProgress);
      const soft = smoothstep(threshold, threshold.add(uSoftness.add(float(0.0001))), uProgress);
      const mask: any = hard.max(soft);

      const colorNode = vec3(uR, uG, uB);
      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = mask;

      if (mesh) mesh.material = mat;

      // Publish live uniform handles so the host/driver (and tests) can observe
      // the reveal progress / cell count on the CPU.
      target.userData.checkerProgress = uProgress;
      target.userData.checkerCells = uCells;

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const dur = num(params.duration, 1.2);
          // progress 0 -> 1: cells turn on by the diagonal sweep.
          uProgress.value = phase(t, dur);
          // Read controls live so a change applies on the next seek.
          uCells.value = num(params.cells, 8);
          uSoftness.value = num(params.softness, 0.08);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'cells') {
            uCells.value = num(value, 8);
          } else if (id === 'softness') {
            uSoftness.value = num(value, 0.08);
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
