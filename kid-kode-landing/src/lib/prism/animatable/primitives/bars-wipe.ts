// bars-wipe — a row of vertical bars sweeps across the card. The card surface
// is divided into N columns along uv.x; col = floor(uv.x*bars) indexes the bar,
// local = fract(uv.x*bars) is that bar's own 0..1 width, and stagger = col/bars
// offsets each bar's reveal front so the sweep travels across columns. Each bar
// reveals along its own width via a smoothstep front, giving a travelling-bars
// look. DISTINCT from blinds-wipe (slats open in place, in unison) — here the
// reveal front MOVES across the bars.
// MEDIUM / mask / GPU node-material primitive: swap the host card's material for
// a MeshStandardNodeMaterial whose opacityNode is the staggered per-bar front;
// seek() advances uProgress 0 -> 1.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, floor, fract, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, phase, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 2.5, step: 0.1, default: 1.2, unit: 's' },
  { id: 'bars', label: 'Bars', type: 'knob', min: 3, max: 16, step: 1, default: 8 },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0.02, max: 0.5, step: 0.01, default: 0.15 },
] as const;

export const barsWipePrimitive: PrimitiveDefinition = {
  name: 'bars-wipe',
  label: 'Bars Wipe',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    "A row of vertical bars sweeps across the card, each bar's reveal front travelling and the bars staggered.",
  create: defineAnimatable(
    { name: 'bars-wipe', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      // Preserve the card's tint so the bars reveal the original colour.
      const prevMat = mesh ? (mesh.material as Material) : null;
      let baseColor: Color | null = null;
      if (prevMat && (prevMat as unknown as { color?: Color }).color) {
        baseColor = (prevMat as unknown as { color: Color }).color.clone();
      }

      const uProgress = uniform(0);
      const uBars = uniform(num(params.bars, 8));
      const uSoft = uniform(num(params.softness, 0.15));

      // Column index + that column's own local 0..1 width along uv.x.
      const u = uv();
      const scaled = u.x.mul(uBars);
      const col = floor(scaled);
      const local = fract(scaled);
      // Per-bar stagger: later columns lag, so the reveal front travels across.
      const stagger = col.div(uBars);
      // Front position for this bar = uProgress * (1 + stagger). smoothstep over
      // [front - soft, front] against `local` reveals each bar along its width.
      const front = uProgress.mul(stagger.add(1));
      const reveal = smoothstep(front.sub(uSoft), front, local);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      if (baseColor) mat.color = baseColor;
      (mat as unknown as { opacityNode: unknown }).opacityNode = reveal;

      if (mesh) mesh.material = mat;

      // Publish the live progress uniform so the host/driver (and tests) can
      // observe the sweep on the CPU.
      target.userData.barsProgress = uProgress;
      target.userData.barsCount = uBars;

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const dur = num(params.duration, 1.2);
          // progress 0 -> 1 drives every bar's travelling reveal front.
          uProgress.value = phase(t, dur);
          // Read controls live so a change applies on the next seek.
          uBars.value = num(params.bars, 8);
          uSoft.value = num(params.softness, 0.15);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'bars') uBars.value = num(value, 8);
          else if (id === 'softness') uSoft.value = num(value, 0.15);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
