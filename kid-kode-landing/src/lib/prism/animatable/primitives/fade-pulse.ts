// fade-pulse — the card breathes its opacity in a slow, endless loop: a calm
// idle attention pulse (easy / fade). Distinct from blink (hard on/off) and
// flash (one-shot): opacity glides sinusoidally between minOpacity and 1, with
// an optional tiny coupled scale breathe. Purely stateful → duration() is
// Infinity; seek(t) reads params LIVE so control tweaks apply with no rebuild.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.5, max: 4, step: 0.05, default: 1.4, unit: 'hz' },
  { id: 'minOpacity', label: 'Min Opacity', type: 'fader', min: 0.2, max: 0.9, step: 0.01, default: 0.45 },
  { id: 'scaleBreathe', label: 'Scale Breathe', type: 'knob', min: 0, max: 0.06, step: 0.002, default: 0.02 },
] as const;

/** Collect transparent-capable materials on a subtree (mirrors slide.ts). */
function materialsOf(root: Object3D): Material[] {
  const out: Material[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        mat.transparent = true;
        out.push(mat);
      }
    }
  });
  return out;
}

export const fadePulsePrimitive: PrimitiveDefinition = {
  name: 'fade-pulse',
  label: 'Fade Pulse',
  category: 'fade',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Card breathes its opacity in a slow loop — a calm idle attention pulse.',
  create: defineAnimatable(
    { name: 'fade-pulse', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      // Capture base opacities + base scale so dispose restores exactly.
      const baseOpacity = mats.map((m) => (m as Material & { opacity: number }).opacity);
      const baseScaleX = subject.scale.x;
      const baseScaleY = subject.scale.y;
      const baseScaleZ = subject.scale.z;
      return {
        duration: () => Infinity,
        seek: (t) => {
          const speed = num(params.speed, 1.4);
          const minOp = clamp(num(params.minOpacity, 0.45), 0.2, 0.9);
          const breathe = num(params.scaleBreathe, 0.02);
          // 0.5 + 0.5*sin → glides smoothly in [0,1]; never a hard edge.
          const wave = 0.5 + 0.5 * Math.sin(t * speed);
          const op = minOp + (1 - minOp) * wave;
          for (let i = 0; i < mats.length; i++) {
            (mats[i] as Material & { opacity: number }).opacity = op * baseOpacity[i];
          }
          // Tiny coupled scale breathe, in phase with the opacity wave.
          const s = 1 + breathe * (wave - 0.5) * 2;
          subject.scale.set(baseScaleX * s, baseScaleY * s, baseScaleZ * s);
        },
        dispose: () => {
          for (let i = 0; i < mats.length; i++) {
            (mats[i] as Material & { opacity: number }).opacity = baseOpacity[i];
          }
          subject.scale.set(baseScaleX, baseScaleY, baseScaleZ);
        },
      };
    },
  ),
};
