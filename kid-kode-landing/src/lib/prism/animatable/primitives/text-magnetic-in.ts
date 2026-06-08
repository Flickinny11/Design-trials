// text-magnetic-in — glyphs fly in from deterministically scattered positions
// (and a random-looking tumble) and snap into their slots as if yanked by a
// magnet. CPU transform/material primitive (hard / text). For subject:'text'
// the host hands a Group of glyph meshes; we decompose per-glyph. Each glyph i
// gets a deterministic scatter offset + rotation from an index hash (no
// Math.random), then:
//   local  = clamp((phase - i*stagger)/window, 0, 1)
//   e      = easeOut(local)            // magnetic snap, fast then settling
//   pos    = lerp(rest + scatter, rest, e)
//   rot    = lerp(scatterRot, 0, e)
//   op     = clamp(local * ~2, 0, 1)
// Observable on CPU: each glyph's position converges from a large scattered
// offset to its rest slot across the phase, rotation lerps to 0, opacity ramps.
// Distinct from text-cascade (vertical drop only) and scramble (no flight in
// from scatter). Restores position/rotation/opacity in dispose.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'scatter', label: 'Scatter', type: 'fader', min: 1, max: 6, step: 0.1, default: 3 },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.3, step: 0.005, default: 0.08 },
] as const;

/** Deterministic pseudo-random in [0,1) from an integer seed (no Math.random). */
function hash01(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

interface Glyph {
  obj: Object3D;
  rest: { x: number; y: number; z: number };
  baseRot: { x: number; y: number; z: number };
  // Unit-magnitude scatter direction (scaled live by the `scatter` control).
  dir: { x: number; y: number; z: number };
  // Scatter start rotation (radians), scaled by `scatter` live too.
  rot: { x: number; y: number; z: number };
  mats: Array<Material & { opacity: number }>;
}

/** Collect transparent-capable materials on a subtree (forces transparent). */
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

export const textMagneticInPrimitive: PrimitiveDefinition = {
  name: 'text-magnetic-in',
  label: 'Text Magnetic In',
  category: 'text',
  difficulty: 'hard',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glyphs fly in from scattered positions and snap into their slots as if pulled by a magnet.',
  create: defineAnimatable(
    { name: 'text-magnetic-in', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;

      // Per-glyph decomposition: each direct child is one glyph. Fall back to
      // the root itself as a single "glyph" if the subject has no children.
      const children = root.children.length > 0 ? [...root.children] : [root];
      const glyphs: Glyph[] = children.map((obj, i) => {
        // Deterministic scatter direction on the unit sphere(-ish) + a tumble,
        // derived from the glyph index hash. No Math.random — reseekable.
        const a = hash01(i * 3 + 1) * Math.PI * 2; // azimuth
        const r = 0.4 + hash01(i * 3 + 2) * 0.6; // radial weight in XY
        const zJit = (hash01(i * 3 + 3) - 0.5) * 1.2; // some depth
        const dir = { x: Math.cos(a) * r, y: Math.sin(a) * r, z: zJit };
        const rot = {
          x: (hash01(i * 5 + 7) - 0.5) * Math.PI, // up to ±~1.57 rad
          y: (hash01(i * 5 + 11) - 0.5) * Math.PI,
          z: (hash01(i * 5 + 13) - 0.5) * Math.PI,
        };
        return {
          obj,
          rest: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
          baseRot: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
          dir,
          rot,
          mats: materialsOf(obj),
        };
      });
      const N = glyphs.length;

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          const dur = num(params.duration, 1.4);
          const scatter = num(params.scatter, 3);
          const stagger = clamp(num(params.stagger, 0.08), 0, 0.3);
          const p = phase(t, dur);
          // Window left after the last glyph's start so every glyph completes
          // by p=1 even at max stagger.
          const win = clamp(1 - stagger * Math.max(0, N - 1), 0.001, 1);

          for (let i = 0; i < N; i++) {
            const g = glyphs[i];
            const local = clamp((p - i * stagger) / win, 0, 1);
            // easeOut: fast magnetic pull early, decelerating into the slot.
            const e = ease('easeOut', local);
            const k = 1 - e; // scatter weight: 1 at start, 0 settled
            g.obj.position.x = g.rest.x + g.dir.x * scatter * k;
            g.obj.position.y = g.rest.y + g.dir.y * scatter * k;
            g.obj.position.z = g.rest.z + g.dir.z * scatter * k;
            g.obj.rotation.x = g.baseRot.x + g.rot.x * k;
            g.obj.rotation.y = g.baseRot.y + g.rot.y * k;
            g.obj.rotation.z = g.baseRot.z + g.rot.z * k;
            const op = clamp(local * 2, 0, 1);
            for (const m of g.mats) m.opacity = op;
          }
        },
        dispose: () => {
          for (const g of glyphs) {
            g.obj.position.set(g.rest.x, g.rest.y, g.rest.z);
            g.obj.rotation.set(g.baseRot.x, g.baseRot.y, g.baseRot.z);
            for (const m of g.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
