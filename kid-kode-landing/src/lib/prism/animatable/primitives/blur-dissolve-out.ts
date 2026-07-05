// blur-dissolve-out — defocus-to-nothing EXIT. CPU-observable transform/material
// primitive (medium / blur category). This is a CPU-observable APPROXIMATION of a
// gaussian defocus dissolving the subject away: no true gaussian sampling is
// performed. The DISTINCT inverse of blur-in (which is an entrance settling into
// focus). It reads as a card swelling out of focus while fading by combining
// four observable channels:
//   1. scale eases from 1.0 up to (1 + blurGrow) via easeIn (the subject swells),
//   2. opacity falls linearly from 1 down to 0 (resolves into nothing),
//   3. a deterministic multi-sample jitter on position whose amplitude GROWS
//      with phase, reading as a widening defocus circle-of-confusion,
//   4. an optional emissive bloom that rises mid-animation then is gone (a soft
//      glow flare as the card dissolves), bell-shaped in phase.
// All channels are driven live from params inside seek() (no rebuild on tweak).

import { Mesh, MeshStandardMaterial, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'blurGrow', label: 'Blur Grow', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.3 },
  { id: 'bloom', label: 'Bloom', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.8 },
] as const;

/** Collect transparent-capable materials on a subtree. */
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

/** Deterministic, index-seeded pseudo-noise in [-1, 1]. No deps, no Math.random. */
function jitter(seed: number): number {
  const s = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

export const blurDissolveOutPrimitive: PrimitiveDefinition = {
  name: 'blur-dissolve-out',
  label: 'Blur Dissolve Out',
  category: 'blur',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Card softens and swells out of focus as it fades away — a defocus-to-nothing exit/transition (approximation, no true gaussian).',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'blur-dissolve-out', category: 'blur', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseScale = subject.scale.clone();

      // Capture base emissive intensity per standard material so bloom restores.
      const emissiveMats = mats.filter(
        (m): m is MeshStandardMaterial =>
          (m as MeshStandardMaterial).emissiveIntensity !== undefined,
      );
      const baseEmissive = emissiveMats.map((m) => m.emissiveIntensity);

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const dur = num(params.duration, 1.2);
          const p = phase(t, dur);
          const blurGrow = num(params.blurGrow, 0.3);
          const bloom = num(params.bloom, 0.8);

          // 1. Scale swells 1 -> (1 + blurGrow), accelerating via easeIn.
          const swell = 1 + blurGrow * ease('easeIn', p);
          subject.scale.set(
            baseScale.x * swell,
            baseScale.y * swell,
            baseScale.z * swell,
          );

          // 2. Opacity fades linearly 1 -> 0.
          const opacity = clamp(1 - p, 0, 1);

          // 4. Bloom: bell-shaped flare that rises mid then is gone (sin(pi*p)).
          //    Scale by the linear fade so emissive also vanishes by the end.
          const bell = Math.sin(Math.PI * p);
          const bloomBoost = bloom * bell;
          for (let i = 0; i < emissiveMats.length; i++) {
            emissiveMats[i].emissiveIntensity = baseEmissive[i] + bloomBoost;
          }
          for (const m of mats) (m as Material & { opacity: number }).opacity = opacity;

          // 3. Defocus jitter: amplitude GROWS with phase (widening circle of
          //    confusion). Multi-sample average of several deterministic offsets
          //    so it reads as a smeared blur rather than a single shake.
          const amp = blurGrow * p * 0.06 + 0.0;
          const step = Math.floor(p * 24);
          let jx = 0;
          let jy = 0;
          const SAMPLES = 4;
          for (let s = 0; s < SAMPLES; s++) {
            jx += jitter(step + s * 3 + 1);
            jy += jitter(step * 2 + s * 5 + 7);
          }
          jx /= SAMPLES;
          jy /= SAMPLES;
          subject.position.x = baseX + jx * amp;
          subject.position.y = baseY + jy * amp;
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.position.y = baseY;
          subject.scale.copy(baseScale);
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
          for (let i = 0; i < emissiveMats.length; i++) {
            emissiveMats[i].emissiveIntensity = baseEmissive[i];
          }
        },
      };
    },
  ),
};
