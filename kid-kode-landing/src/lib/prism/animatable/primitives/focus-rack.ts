// focus-rack — a cinematic rack-focus that pulls the card from a soft bokeh blur
// into razor sharpness, with a brief over-bloom at the snap. MEDIUM / blur.
//
// Headless GPU has no real depth-of-field, so the "blur" is expressed through
// CPU-observable proxies the preview rig renders faithfully: a bokeh swell
// (scale), a confidence rise (opacity), a deterministic multi-sample jitter that
// decays as focus resolves, and a brief emissive bloom spike at the focus snap.
//
//   b        = 1 - easeInOut(phase)        (1 = blurred at start -> 0 sharp at end)
//   scale    = 1 + b * overscale           (bokeh swell)
//   opacity  = lerp(0.4, 1, 1 - b)         (soft -> solid)
//   jitter   = deterministic per-frame offset, magnitude ∝ b
//   bloom    = bell spike near phase ~0.8  (the focus snap), * bloom knob
//
// All randomness is a deterministic hash of the frame index — reseeking is
// reproducible. CPU-driven; no TSL. dispose() restores transform + material.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'overscale', label: 'Bokeh Swell', type: 'knob', min: 0, max: 0.5, step: 0.01, default: 0.18 },
  { id: 'bloom', label: 'Bloom', type: 'knob', min: 0, max: 2, step: 0.05, default: 1.0 },
] as const;

/** Deterministic 0..1 hash from a scalar (no Math.random). */
const hash = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

interface MatEntry {
  mat: Material & { opacity: number; emissiveIntensity?: number };
  baseOpacity: number;
  baseEmissive: number;
}

/** Collect transparent-capable materials on a subtree, recording base values. */
function materialsOf(root: Object3D): MatEntry[] {
  const out: MatEntry[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        const mm = mat as Material & { opacity: number; emissiveIntensity?: number };
        mm.transparent = true;
        out.push({
          mat: mm,
          baseOpacity: mm.opacity,
          baseEmissive: typeof mm.emissiveIntensity === 'number' ? mm.emissiveIntensity : 0,
        });
      }
    }
  });
  return out;
}

export const focusRackPrimitive: PrimitiveDefinition = {
  name: 'focus-rack',
  label: 'Focus Rack',
  category: 'blur',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A cinematic rack-focus pulls the card from a soft bokeh blur into razor sharpness, with a brief over-bloom at the snap.',
  create: defineAnimatable(
    { name: 'focus-rack', category: 'blur', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseScale = { x: subject.scale.x, y: subject.scale.y, z: subject.scale.z };

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.2));
          // b: 1 (blurred) -> 0 (sharp), via easeInOut on the phase.
          const b = 1 - ease('easeInOut', p);
          const overscale = num(params.overscale, 0.18);
          const bloomAmt = num(params.bloom, 1.0);

          // Bokeh swell: scale up while blurred, settle to base as it sharpens.
          const s = 1 + b * overscale;
          subject.scale.set(baseScale.x * s, baseScale.y * s, baseScale.z * s);

          // Deterministic multi-sample jitter, magnitude proportional to b.
          // Derive a stable frame index from phase so reseeking reproduces.
          const fi = Math.round(p * 240);
          const jx = (hash(fi * 1.7 + 3.1) - 0.5) * 2 * b * 0.05;
          const jy = (hash(fi * 2.3 + 7.9) - 0.5) * 2 * b * 0.05;
          subject.position.x = baseX + jx;
          subject.position.y = baseY + jy;

          // Confidence rise: soft -> solid as focus resolves.
          const opacity = 0.4 + 0.6 * (1 - b);

          // Brief emissive bloom spike near the focus snap (phase ~0.8).
          const bell = Math.exp(-Math.pow((p - 0.8) / 0.08, 2));
          const bloom = bell * bloomAmt;

          for (const e of mats) {
            e.mat.opacity = e.baseOpacity * opacity;
            if (typeof e.mat.emissiveIntensity === 'number') {
              e.mat.emissiveIntensity = e.baseEmissive * (1 + bloom * 2.5);
            }
          }
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.position.y = baseY;
          subject.scale.set(baseScale.x, baseScale.y, baseScale.z);
          for (const e of mats) {
            e.mat.opacity = e.baseOpacity;
            if (typeof e.mat.emissiveIntensity === 'number') {
              e.mat.emissiveIntensity = e.baseEmissive;
            }
          }
        },
      };
    },
  ),
};
