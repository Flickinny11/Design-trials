// scroll-zoom — scroll position scrubs the card's scale through a focal pass.
// CPU/transform primitive (medium / scroll). Reads target.userData.scroll
// (0..1; falls back to phase(t) when no scroll driver is wired). In linear
// mode scale = lerp(minScale, maxScale, scroll); in focal mode scale follows a
// bell curve that peaks at scroll 0.5 (a zoom-in/zoom-out focal pass).
// Distinct from scroll-rotate-3d (rotation) and scrub-morph (geometry) — this
// is pure scroll-driven uniform zoom. Restores scale in dispose.

import { type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, bool, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'minScale', label: 'Min Scale', type: 'fader', min: 0.4, max: 1, step: 0.01, default: 0.6 },
  { id: 'maxScale', label: 'Max Scale', type: 'fader', min: 1, max: 2.5, step: 0.01, default: 1.8 },
  { id: 'focal', label: 'Focal Bell', type: 'toggle', default: false },
] as const;

export const scrollZoomPrimitive: PrimitiveDefinition = {
  name: 'scroll-zoom',
  label: 'Scroll Zoom',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll position zooms the card in and out — scrubbing scroll scales it smoothly through a focal pass.',
  create: defineAnimatable(
    { name: 'scroll-zoom', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseX = subject.scale.x;
      const baseY = subject.scale.y;
      const baseZ = subject.scale.z;

      return {
        // Scroll-driven scrub: long, continuous timeline so a CPU clock fallback
        // also sweeps the full focal pass.
        duration: () => Infinity,
        seek: (t) => {
          // Prefer the host's scroll driver; fall back to a CPU phase sweep.
          const ud = target.userData as { scroll?: unknown };
          const scroll =
            typeof ud.scroll === 'number' && Number.isFinite(ud.scroll)
              ? clamp(ud.scroll, 0, 1)
              : phase(t % 4, 4);

          const minScale = num(params.minScale, 0.6);
          const maxScale = num(params.maxScale, 1.8);

          // Linear ramp, or a focal bell that peaks at scroll 0.5.
          let amount: number;
          if (bool(params.focal, false)) {
            // bell: 0 at the ends, 1 at the midpoint (focal pass).
            amount = 1 - Math.abs(scroll - 0.5) * 2;
          } else {
            amount = scroll;
          }
          const s = minScale + (maxScale - minScale) * amount;

          subject.scale.set(baseX * s, baseY * s, baseZ * s);
        },
        dispose: () => {
          subject.scale.set(baseX, baseY, baseZ);
        },
      };
    },
  ),
};
