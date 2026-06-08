// text-typewriter-cursor — glyphs of the `text` subject appear one at a time in
// strict sequence (glyph i is fully visible, opacity 1, once phase > i/N, else
// fully hidden), and a discrete BLOCK cursor pulses at the typing head: the
// next-to-reveal glyph (or the last revealed one once finished) has its
// emissive intensity AND scale blinked by 0.5 + 0.5*sign(sin(t*blinkRate)), so
// a hard block strobes where the caret sits. This is DISTINCT from `typewriter`
// (which softly cross-fades each glyph and has no discrete block caret): here
// reveals are crisp step toggles and the cursor is a separate hard-blinking
// glyph. CPU-driven and observable: the count of opaque glyphs grows with t,
// and the cursor glyph's emissiveIntensity / scale oscillate.

import { Mesh, MeshStandardMaterial, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, bool, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.8, unit: 's' },
  { id: 'blinkRate', label: 'Blink Rate', type: 'knob', min: 2, max: 10, step: 0.1, default: 6, unit: 'hz' },
  { id: 'holdCursor', label: 'Hold Cursor', type: 'toggle', default: true },
] as const;

interface GlyphRec {
  obj: Object3D;
  mats: Array<Material & { opacity: number }>;
  emissives: MeshStandardMaterial[];
  baseScale: { x: number; y: number; z: number };
  baseEmissive: number[];
}

/** Collect transparent-capable materials on an object (and its subtree). */
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

/** Collect MeshStandardMaterials (those carrying emissiveIntensity) on a subtree. */
function emissivesOf(root: Object3D): MeshStandardMaterial[] {
  const out: MeshStandardMaterial[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        if (mat instanceof MeshStandardMaterial) out.push(mat);
      }
    }
  });
  return out;
}

export const textTypewriterCursorPrimitive: PrimitiveDefinition = {
  name: 'text-typewriter-cursor',
  label: 'Typewriter Cursor',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Letters appear one at a time with a blinking block cursor trailing the last typed glyph.',
  create: defineAnimatable(
    { name: 'text-typewriter-cursor', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      const glyphs: GlyphRec[] = root.children.map((obj) => {
        const emissives = emissivesOf(obj);
        return {
          obj,
          mats: materialsOf(obj),
          emissives,
          baseScale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
          baseEmissive: emissives.map((m) => m.emissiveIntensity),
        };
      });
      const N = Math.max(1, glyphs.length);

      const dur = () => num(params.duration, 1.8);

      return {
        duration: dur,
        seek: (t) => {
          const p = phase(t, dur());
          const blinkRate = clamp(num(params.blinkRate, 6), 2, 10);
          const holdCursor = bool(params.holdCursor, true);

          // Strict sequential reveal: glyph i is opaque/full-scale once p > i/N.
          let revealedCount = 0;
          for (let i = 0; i < glyphs.length; i++) {
            const shown = p > i / N;
            if (shown) revealedCount++;
            const g = glyphs[i];
            const sc = shown ? 1 : 0;
            g.obj.scale.set(g.baseScale.x * sc, g.baseScale.y * sc, g.baseScale.z * sc);
            for (const m of g.mats) m.opacity = shown ? 1 : 0;
            // Reset emissive to base for every glyph; the cursor override below
            // re-blinks the head glyph.
            for (let e = 0; e < g.emissives.length; e++) {
              g.emissives[e].emissiveIntensity = g.baseEmissive[e];
            }
          }

          // Discrete block cursor: 0.5 + 0.5*sign(sin(t*blinkRate)) -> {0, 0.5, 1}.
          const s = Math.sin(t * blinkRate);
          const blink = 0.5 + 0.5 * Math.sign(s);

          // Cursor head: the next-to-reveal glyph while typing; once finished,
          // the last glyph (kept blinking only when holdCursor is on).
          const finished = revealedCount >= glyphs.length;
          let cursorIdx = -1;
          if (!finished) {
            cursorIdx = clamp(revealedCount, 0, glyphs.length - 1);
          } else if (holdCursor && glyphs.length > 0) {
            cursorIdx = glyphs.length - 1;
          }

          if (cursorIdx >= 0) {
            const g = glyphs[cursorIdx];
            // Make the caret glyph visible as a block (full scale + opacity)
            // even if not yet "typed", then blink its emissive + scale.
            const baseS = g.baseScale;
            const scalePulse = 0.85 + 0.45 * blink; // 0.85 .. 1.30
            g.obj.scale.set(baseS.x * scalePulse, baseS.y * scalePulse, baseS.z * scalePulse);
            for (const m of g.mats) m.opacity = Math.max(m.opacity, 0.4 + 0.6 * blink);
            for (let e = 0; e < g.emissives.length; e++) {
              // Drive emissive between a dim floor and a bright block flash.
              g.emissives[e].emissiveIntensity = g.baseEmissive[e] + 1.6 * blink;
            }
          }
        },
        dispose: () => {
          for (const g of glyphs) {
            g.obj.scale.set(g.baseScale.x, g.baseScale.y, g.baseScale.z);
            for (const m of g.mats) m.opacity = 1;
            for (let e = 0; e < g.emissives.length; e++) {
              g.emissives[e].emissiveIntensity = g.baseEmissive[e];
            }
          }
        },
      };
    },
  ),
};
