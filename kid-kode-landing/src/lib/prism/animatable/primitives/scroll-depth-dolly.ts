// scroll-depth-dolly — scroll dollies the card through DEPTH: position.z lerps
// from farZ → nearZ as the page scrolls, rushing toward then past the viewer.
// A perspective scale (lerp 0.4..1.4) is coupled to the same scroll so the card
// reads as physically approaching, and (when fadeEnds is on) it dissolves at the
// extremes so it appears to pass through/by the viewer. CPU/transform primitive
// (easy / scroll). Reads target.userData.scroll (0..1; falls back to a CPU phase
// sweep when no scroll driver is wired).
//
// DISTINCT from scroll-zoom (scale only): this moves position.z *and* couples
// scale + opacity, so the motion is a true depth dolly, not a flat zoom.
// Restores position.z, scale, and opacity in dispose.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, bool, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'farZ', label: 'Far Z', type: 'fader', min: -12, max: -2, step: 0.1, default: -8 },
  { id: 'nearZ', label: 'Near Z', type: 'fader', min: 0, max: 6, step: 0.1, default: 3 },
  { id: 'fadeEnds', label: 'Fade Ends', type: 'toggle', default: true },
] as const;

/** Collect transparent-capable materials on a subtree, and snapshot base opacity. */
function materialsOf(root: Object3D): Array<Material & { opacity: number }> {
  const out: Array<Material & { opacity: number }> = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        mat.transparent = true;
        out.push(mat as Material & { opacity: number });
      }
    }
  });
  return out;
}

export const scrollDepthDollyPrimitive: PrimitiveDefinition = {
  name: 'scroll-depth-dolly',
  label: 'Scroll Depth Dolly',
  category: 'scroll',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll dollies the card through depth — rushing toward then past the viewer as the page moves.',
  create: defineAnimatable(
    { name: 'scroll-depth-dolly', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseZ = subject.position.z;
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;
      const mats = materialsOf(subject);
      const baseOpacity = mats.map((m) => m.opacity);

      return {
        // Scroll-driven scrub: continuous timeline so a CPU clock fallback also
        // sweeps the full dolly when no scroll driver is wired.
        duration: () => Infinity,
        seek: (t) => {
          const ud = target.userData as { scroll?: unknown };
          const scroll =
            typeof ud.scroll === 'number' && Number.isFinite(ud.scroll)
              ? clamp(ud.scroll, 0, 1)
              : phase(t % 4, 4);

          const farZ = num(params.farZ, -8);
          const nearZ = num(params.nearZ, 3);

          // Dolly: z lerps far → near as scroll advances. The card rushes in.
          subject.position.z = baseZ + (farZ + (nearZ - farZ) * scroll);

          // Coupled perspective scale: distant = small, near = large.
          const s = 0.4 + (1.4 - 0.4) * scroll;
          subject.scale.set(baseSX * s, baseSY * s, baseSZ * s);

          // Fade at the extremes so it dissolves as it recedes far away or
          // rushes past the viewer. A tent peaking in the mid-range (full
          // opacity) and falling to ~0 at scroll 0 and scroll 1.
          let fade = 1;
          if (bool(params.fadeEnds, true)) {
            // distance from the midpoint, normalized 0 (center) .. 1 (an end)
            const edge = Math.abs(scroll - 0.5) * 2;
            // hold full opacity through the middle, fall off only near the ends
            fade = clamp(1 - Math.max(0, edge - 0.4) / 0.6, 0, 1);
          }
          for (let i = 0; i < mats.length; i++) {
            mats[i].opacity = baseOpacity[i] * fade;
          }
        },
        dispose: () => {
          subject.position.z = baseZ;
          subject.scale.set(baseSX, baseSY, baseSZ);
          for (let i = 0; i < mats.length; i++) {
            mats[i].opacity = baseOpacity[i];
          }
        },
      };
    },
  ),
};
