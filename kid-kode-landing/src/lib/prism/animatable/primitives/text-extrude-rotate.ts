// text-extrude-rotate — glyphs rise out of depth with a rotation: each starts
// far back in -Z while turned away (rotation.y), then extrudes forward toward
// the viewer (z -> 0 via expoOut) and rotates to face front (rotation.y -> 0
// via easeOut), scaling 0.5 -> 1 and fading in, staggered per glyph index.
// CPU-driven and observable: each glyph's position.z AND rotation.y change in
// sequence. DISTINCT from text-extrude (z only, no rotation). Text primitive
// (medium / text); subject is the host's glyph-child Group. Restored on dispose.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'depth', label: 'Depth', type: 'fader', min: 2, max: 10, step: 0.1, default: 5 },
  { id: 'turnDeg', label: 'Turn', type: 'knob', min: 30, max: 180, step: 1, default: 90, unit: 'deg' },
] as const;

/** Collect the per-glyph children (each glyph mesh) of the subject group. */
function glyphsOf(root: Object3D): Object3D[] {
  return root.children.length > 0 ? [...root.children] : [root];
}

/** Transparent-capable materials on a glyph subtree (for opacity ramp). */
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

export const textExtrudeRotatePrimitive: PrimitiveDefinition = {
  name: 'text-extrude-rotate',
  label: 'Text Extrude Rotate',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glyphs rise out of depth with a rotation, extruding forward from far in Z while turning to face the viewer.',
  create: defineAnimatable(
    { name: 'text-extrude-rotate', category: 'text', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const glyphs = glyphsOf(subject);
      const N = glyphs.length;
      // Capture base transforms + materials so dispose restores exactly.
      const baseZ = glyphs.map((g) => g.position.z);
      const baseRotY = glyphs.map((g) => g.rotation.y);
      const baseScale = glyphs.map((g) => g.scale.clone());
      const mats = glyphs.map((g) => materialsOf(g));

      // Per-glyph window: each glyph fires over `window` of the global phase,
      // offset by `i*stagger`. Tuned so the last glyph still completes by t=dur.
      const stagger = N > 1 ? 0.5 / N : 0;
      const win = clamp(1 - stagger * (N - 1), 0.15, 1);

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          const dur = num(params.duration, 1.6);
          const depth = num(params.depth, 5);
          const startTurn = (num(params.turnDeg, 90) * Math.PI) / 180;
          const ph = phase(t, dur);
          for (let i = 0; i < N; i++) {
            const local = clamp((ph - i * stagger) / win, 0, 1);
            // extrude forward: from -depth (far) to 0 (settled) via expoOut.
            glyphs[i].position.z = baseZ[i] + (1 - ease('expoOut', local)) * -depth;
            // rotate to face viewer: from startTurn to 0 via easeOut.
            glyphs[i].rotation.y = baseRotY[i] + (1 - ease('easeOut', local)) * startTurn;
            // scale lerp 0.5 -> 1.
            const s = 0.5 + 0.5 * local;
            const bs = baseScale[i];
            glyphs[i].scale.set(bs.x * s, bs.y * s, bs.z * s);
            // opacity ramps in with the local phase.
            for (const m of mats[i]) (m as Material & { opacity: number }).opacity = local;
          }
        },
        dispose: () => {
          for (let i = 0; i < N; i++) {
            glyphs[i].position.z = baseZ[i];
            glyphs[i].rotation.y = baseRotY[i];
            glyphs[i].scale.copy(baseScale[i]);
            for (const m of mats[i]) (m as Material & { opacity: number }).opacity = 1;
          }
        },
      };
    },
  ),
};
