// text-draw-on — each glyph draws itself on with a left-to-right alpha wipe, as
// if ink were flowing into the letterforms. TSL / node-material primitive
// (text / medium). For subject:'text' the host hands a Group of glyph meshes; we
// decompose it per-glyph and swap each glyph's material for a
// MeshStandardNodeMaterial whose opacityNode wipes across that glyph's own width:
//
//   opacityNode = smoothstep(uReveal - soft, uReveal, uv.x)
//
// where uReveal sweeps 0 -> 1 across the glyph's local uv.x. Per glyph i the
// reveal is driven from a STAGGERED local phase so the glyphs ink on in
// sequence. seek() advances each per-glyph uReveal uniform; the value is also
// mirrored into the bound instance's `reveals` array (exposed on
// target.userData) so a headless CPU test can observe the wipe without a GPU.
//
// CPU-observable: each glyph's reveal value (uniform.value) climbs 0 -> 1 in
// sequence across the timeline. Deterministic — no Math.random. Restores the
// original glyph materials in dispose().

import { Mesh, type Material, type Object3D } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, smoothstep, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type ControlValue, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 5, step: 0.1, default: 1.8, unit: 's' },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.18 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

interface GlyphWipe {
  mesh: Mesh;
  prevMat: Material | Material[] | null;
  mat: MeshStandardNodeMaterial;
  /** Per-glyph reveal uniform driving the wipe edge across uv.x. */
  uReveal: ReturnType<typeof uniform>;
  /** Per-glyph soft-edge uniform (width of the smoothstep ramp). */
  uSoft: ReturnType<typeof uniform>;
}

/** Read the first base color off a glyph mesh material (to preserve its hue). */
function baseColorOf(mesh: Mesh): { color: unknown; emissive: unknown } {
  const m = mesh.material;
  const first = (Array.isArray(m) ? m[0] : m) as unknown as {
    color?: unknown;
    emissive?: unknown;
  };
  return { color: first?.color, emissive: first?.emissive };
}

export const textDrawOnPrimitive: PrimitiveDefinition = {
  name: 'text-draw-on',
  label: 'Text Draw On',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Each glyph draws itself on with a left-to-right alpha wipe, like ink flowing into the letterforms.',
  create: defineAnimatable(
    { name: 'text-draw-on', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;

      // Per-glyph decomposition: each direct child is one glyph. Fall back to the
      // root itself as a single "glyph" if the subject has no children.
      const children: Object3D[] = root.children.length > 0 ? [...root.children] : [root];

      const glyphs: GlyphWipe[] = [];
      for (const child of children) {
        // Only meshes can carry a node material; skip non-mesh chrome.
        if (!(child as Mesh).isMesh) continue;
        const mesh = child as Mesh;

        const uReveal = uniform(0);
        const uSoft = uniform(num(params.softness, 0.18));

        // opacityNode = smoothstep(uReveal - soft, uReveal, uv.x): a wipe whose
        // edge sweeps across this glyph's own width (uv.x in 0..1). At
        // uReveal=0 the whole glyph is hidden; at uReveal=1 it is fully inked.
        const u = uv();
        const lo = uReveal.sub(uSoft);
        const opacityNode = smoothstep(lo, uReveal, u.x);

        const { color, emissive } = baseColorOf(mesh);
        const mat = new MeshStandardNodeMaterial({
          transparent: true,
          roughness: 0.3,
          metalness: 0.3,
        });
        // Preserve the glyph's hue so the catalog tile stays on-palette.
        if (color) (mat as unknown as { color: unknown }).color = color;
        if (emissive) (mat as unknown as { emissive: unknown }).emissive = emissive;
        (mat as unknown as { emissiveIntensity: number }).emissiveIntensity = 0.6;
        // CAST node assignment to dodge strict TSL typing (mirrors caustics.ts).
        (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

        const prevMat = mesh.material;
        mesh.material = mat;

        glyphs.push({ mesh, prevMat, mat, uReveal, uSoft });
      }
      const N = glyphs.length;

      // Mirror per-glyph reveal values onto userData so a CPU/headless test can
      // observe the wipe without invoking a GPU (uniform.value is updated each
      // seek). Also re-readable as a stable handle for the host.
      const reveals: number[] = new Array(N).fill(0);
      target.userData.textDrawOnReveals = reveals;

      return {
        duration: () => num(params.duration, 1.8),
        seek: (t) => {
          // Read params live so control changes apply on the next seek (no rebuild).
          const dur = num(params.duration, 1.8);
          const p = ease(str(params.curve, 'easeOut') as EaseName, phase(t, dur));
          const stagger = clamp(num(params.stagger, 0.6), 0, 1);
          const soft = clamp(num(params.softness, 0.18), 0, 0.4);

          for (let i = 0; i < N; i++) {
            // Glyph i's start offset along the master phase. stagger=0 → all glyphs
            // ink together; stagger=1 → spread fully across [0,1].
            const start = N > 1 ? (i / N) * stagger : 0;
            const span = 1 - start;
            // Local 0..1 progress; hidden before its turn, inked after.
            const local = span <= 0 ? 1 : clamp((p - start) / span, 0, 1);

            const g = glyphs[i];
            // Expand the reveal edge slightly past 1 so the trailing soft ramp
            // fully clears the glyph's right edge when local hits 1.
            const reveal = local * (1 + soft);
            g.uReveal.value = reveal;
            g.uSoft.value = soft;
            reveals[i] = reveal;
          }
        },
        onParamChange: (id: string, value: ControlValue) => {
          // Softness reacts immediately on the uniforms; duration/stagger/curve
          // are read live in seek so they need no structural reaction.
          if (id === 'softness') {
            const soft = clamp(num(value, 0.18), 0, 0.4);
            for (const g of glyphs) g.uSoft.value = soft;
          }
        },
        dispose: () => {
          for (const g of glyphs) {
            // Restore the original glyph material and free the swapped one.
            g.mesh.material = (g.prevMat ?? g.mat) as Material | Material[];
            g.mat.dispose();
          }
          delete target.userData.textDrawOnReveals;
        },
      };
    },
  ),
};
