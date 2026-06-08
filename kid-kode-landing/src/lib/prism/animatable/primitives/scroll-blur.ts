// scroll-blur — the card sharpens into focus across a scroll band. A defocus
// proxy (overscale + low opacity + tiny deterministic jitter) resolves as the
// scroll value approaches a focal point. Focus is a bell curve over scroll:
// sharpest (f≈1) at `focal`, blurriest (f≈0) far from it. CPU-driven and
// observable — scale shrinks toward 1, opacity rises toward 1, jitter vanishes
// as focus resolves. Distinct from scroll-fade-stack: this models a *defocus*
// resolving (overscale + jitter), not a fade-and-lift stacking band.
// Scroll/card/medium.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { clamp, num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'focal', label: 'Focal Point', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.5 },
  { id: 'width', label: 'Focus Width', type: 'knob', min: 0.1, max: 0.6, step: 0.01, default: 0.28 },
  { id: 'overscale', label: 'Defocus Scale', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.22 },
  { id: 'minOpacity', label: 'Min Opacity', type: 'fader', min: 0, max: 0.8, step: 0.01, default: 0.18 },
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

/** Read the host-supplied scroll value (0..1), tolerant of shape. */
function readScroll(userData: Record<string, unknown>): number {
  const s = userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return 0.5;
}

/** Deterministic [-1,1] jitter from an integer seed. */
const seededUnit = (seed: number): number => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
};

/** Bell curve in [0,1]: 1 at scroll===center, falling toward 0 with `width`. */
const bell = (scroll: number, center: number, width: number): number => {
  const w = Math.max(0.04, width);
  const d = (scroll - center) / w;
  return Math.exp(-(d * d));
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const scrollBlurPrimitive: PrimitiveDefinition = {
  name: 'scroll-blur',
  label: 'Scroll Blur',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'The card sharpens into focus across a scroll band — a defocus proxy (overscale + low opacity) resolving as you scroll into view.',
  create: defineAnimatable(
    { name: 'scroll-blur', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;
      const baseX = subject.position.x;
      const baseY = subject.position.y;

      const apply = (scroll: number) => {
        const focal = num(params.focal, 0.5);
        const width = num(params.width, 0.28);
        const overscale = num(params.overscale, 0.22);
        const minOpacity = num(params.minOpacity, 0.18);

        // Focus 0..1 (1 = sharp at the focal scroll value).
        const f = clamp(bell(scroll, focal, width), 0, 1);
        const defocus = 1 - f;

        // Overscale: blurrier => bigger (a defocus proxy).
        const s = 1 + defocus * overscale;
        subject.scale.set(baseSX * s, baseSY * s, baseSZ * s);

        // Opacity rises toward 1 as focus resolves.
        const opacity = lerp(minOpacity, 1, f);
        for (const m of mats) (m as Material & { opacity: number }).opacity = opacity;

        // Tiny deterministic positional jitter, scaled by defocus (vanishes at
        // sharp focus). Seeded by a coarse scroll bucket so it's reproducible.
        const bucket = Math.round(scroll * 240);
        const jx = seededUnit(bucket + 1) * 0.04 * defocus;
        const jy = seededUnit(bucket + 71) * 0.04 * defocus;
        subject.position.x = baseX + jx;
        subject.position.y = baseY + jy;
      };

      return {
        // Stateful, scroll-driven. Map t -> scroll over a nominal 4s sweep so the
        // picker tile plays even with no live scroll input.
        duration: () => Infinity,
        seek: (t) => {
          const ud = target.userData;
          const hasScroll = typeof ud.scroll === 'number' && Number.isFinite(ud.scroll as number);
          const scroll = hasScroll ? readScroll(ud) : clamp((t % 4) / 4, 0, 1);
          apply(scroll);
        },
        dispose: () => {
          subject.scale.set(baseSX, baseSY, baseSZ);
          subject.position.x = baseX;
          subject.position.y = baseY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
