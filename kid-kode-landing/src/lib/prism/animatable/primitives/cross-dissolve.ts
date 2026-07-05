// cross-dissolve — the card cross-fades through a brief desaturated tint dip,
// like a film cross-fade between two shots. MEDIUM / fade primitive. CPU-driven
// and observable: opacity follows 1 - dipDepth*sin(phase*PI) (full at both ends,
// lowest at mid), and simultaneously a found material's emissiveIntensity is
// pushed toward a neutral mid then recovered — a symmetric tint shift, NOT a
// monotone fade-to-black. Restores opacity + emissive in dispose.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

/** A material that exposes the transparent opacity + standard emissive knob. */
type EmissiveMat = Material & { opacity: number; emissiveIntensity?: number };

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  { id: 'dipDepth', label: 'Dip Depth', type: 'fader', min: 0.2, max: 0.9, step: 0.01, default: 0.6 },
  { id: 'tint', label: 'Tint', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.7 },
] as const;

/** Collect transparent-capable materials on a subtree, marking them transparent. */
function materialsOf(root: Object3D): EmissiveMat[] {
  const out: EmissiveMat[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        mat.transparent = true;
        out.push(mat as EmissiveMat);
      }
    }
  });
  return out;
}

/** Find the first material on the subtree that exposes emissiveIntensity. */
function firstEmissive(mats: EmissiveMat[]): EmissiveMat | null {
  for (const m of mats) {
    if (typeof m.emissiveIntensity === 'number') return m;
  }
  return null;
}

export const crossDissolvePrimitive: PrimitiveDefinition = {
  name: 'cross-dissolve',
  label: 'Cross Dissolve',
  category: 'fade',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card cross-dissolves through a brief desaturated tint dip, like a film cross-fade between two shots.',
  create: defineAnimatable(
    { name: 'cross-dissolve', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      // Snapshot base opacity + emissiveIntensity for live restore.
      const baseOpacity = mats.map((m) => m.opacity);
      const tinted = firstEmissive(mats);
      const baseEmissive = tinted ? (tinted.emissiveIntensity as number) : 0;
      // Neutral mid the emissive dips toward (desaturated, lower-energy).
      const NEUTRAL_MID = baseEmissive * 0.15;

      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.0));
          // sin(p*PI): 0 at both ends, 1 at the midpoint — symmetric dip.
          const dip = Math.sin(p * Math.PI);
          const dipDepth = clamp(num(params.dipDepth, 0.6), 0.2, 0.9);
          const opacity = 1 - dipDepth * dip;
          for (const m of mats) m.opacity = opacity;

          if (tinted) {
            // Tint knob scales how far the emissive falls toward the neutral mid.
            const tint = clamp(num(params.tint, 0.7), 0, 1);
            const target = baseEmissive + (NEUTRAL_MID - baseEmissive) * tint;
            tinted.emissiveIntensity = baseEmissive + (target - baseEmissive) * dip;
          }
        },
        dispose: () => {
          mats.forEach((m, i) => {
            m.opacity = baseOpacity[i];
          });
          if (tinted) tinted.emissiveIntensity = baseEmissive;
        },
      };
    },
  ),
};
