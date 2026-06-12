// scroll-depth-dolly — scroll dollies the card through DEPTH: position.z eases
// from a distant rest pose toward (and slightly past) the viewer as the page
// scrolls, rushing in fastest through the midrange. A perspective scale is
// coupled to the same motion so the card reads as physically approaching, and
// (when fadeEnds is on) it dissolves ONLY at the very near end — as it passes
// the viewer. CPU/transform primitive (easy / scroll). Reads
// target.userData.scroll (0..1; falls back to a CPU phase sweep when no scroll
// driver is wired).
//
// ALWAYS LEGIBLE (FIDELITY-2 regression): pages boot at scroll=0, so the rest
// pose is plainly visible — distant means smaller (scale 0.62) and slightly
// dimmed (opacity 0.65), never 0. Travel is SUBJECT-RELATIVE: the z span is
// expressed in multiples of the subject's own measured bbox size (Box3), so a
// 0.4-unit card and a 6-unit headline both dolly proportionally and stay in
// frame. No absolute world-unit offsets.
//
// DISTINCT from scroll-zoom (scale only): this moves position.z *and* couples
// scale + opacity, so the motion is a true depth dolly, not a flat zoom.
// dispose() restores position.z, scale, and every material's pre-create
// opacity AND .transparent flag (mounted artifacts arrive with their own
// material state; we hand it back exactly as found).

import { Box3, Mesh, Vector3, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, bool, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Subject-relative spans (multiples of the subject's measured size) — never
  // absolute world units (mounted artifacts vary wildly in size).
  { id: 'depth', label: 'Depth Travel', type: 'fader', min: 0.5, max: 6, step: 0.1, default: 2, unit: '×size' },
  { id: 'passBy', label: 'Pass-By', type: 'fader', min: 0, max: 2, step: 0.05, default: 0.6, unit: '×size' },
  { id: 'fadeEnds', label: 'Fade Past Viewer', type: 'toggle', default: true },
] as const;

// Coupled perspective scale span — the far rest pose stays plainly visible.
const SCALE_FAR = 0.62;
const SCALE_NEAR = 1.45;
// Distant-haze dim at scroll=0 (never 0 — the subject must mount visible).
const FAR_DIM = 0.65;

/** Smoothstep clamped to 0..1 — monotonic, velocity peaks mid-range. */
const smooth01 = (x: number): number => {
  const c = clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
};

interface MaterialSnapshot {
  mat: Material & { opacity: number };
  opacity: number;
  transparent: boolean;
}

/** Snapshot every material in the subtree: opacity AND .transparent, so
 *  dispose can hand the artifact back exactly as it arrived. */
function snapshotMaterials(root: Object3D): MaterialSnapshot[] {
  const out: MaterialSnapshot[] = [];
  const seen = new Set<Material>();
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      if (seen.has(mat)) continue;
      seen.add(mat);
      out.push({
        mat: mat as Material & { opacity: number },
        opacity: (mat as Material & { opacity: number }).opacity,
        transparent: mat.transparent,
      });
    }
  });
  return out;
}

/** Measure the subject's size in its PARENT's units (position.z lives there).
 *  Returns 0 when the bbox is empty/degenerate (caller falls back + retries —
 *  some artifacts stream geometry in after mount). */
function measureLocalSize(subject: Object3D): number {
  const box = new Box3().setFromObject(subject);
  if (box.isEmpty()) return 0;
  const dims = box.getSize(new Vector3());
  // MEDIAN dimension, not max (P0 ORRERY in-context finding 2026-06-12): the
  // max dim made wide-flat subjects travel absurdly far — a ~6-unit-wide
  // headline dollied −2×6 = −12 local units at scroll 0, parking it BEHIND the
  // hub's backdrop layers (invisible in-context despite opacity 0.65). The min
  // dim is a flat subject's near-zero thickness. The median tracks the
  // subject's typical visual extent for cards, headlines, and meshes alike.
  const sorted = [dims.x, dims.y, dims.z].sort((a, b) => a - b);
  let size = sorted[1];
  if (!Number.isFinite(size) || size <= 1e-6) size = sorted[2];
  if (!Number.isFinite(size) || size <= 1e-6) return 0;
  // Box3 measures in world units; convert to the parent's local space.
  if (subject.parent) {
    const ps = subject.parent.getWorldScale(new Vector3());
    const s = Math.max(Math.abs(ps.x), Math.abs(ps.y), Math.abs(ps.z));
    if (Number.isFinite(s) && s > 1e-6) size /= s;
  }
  return size;
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
      // Materials may mount AFTER attach (async MSDF glyphs / GLB streams — the
      // P0 ORRERY headline attached with zero materials, so the fade envelope
      // silently never ran). Like `size` below, re-snapshot lazily in seek
      // until the subtree actually has materials.
      let mats = snapshotMaterials(subject);
      // Subject-relative travel unit; 0 = not measurable yet (re-tried in seek).
      let size = measureLocalSize(subject);

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

          if (size <= 0) size = measureLocalSize(subject);
          const span = size > 0 ? size : 1;
          if (mats.length === 0) mats = snapshotMaterials(subject);

          const depth = Math.max(num(params.depth, 2), 0);
          const passBy = Math.max(num(params.passBy, 0.6), 0);

          // Monotonic dolly ease — velocity peaks mid-range, so the subject
          // RUSHES in through the middle of the scroll.
          const e = smooth01(scroll);

          // Subject-relative dolly: far end = depth×size behind the rest pose,
          // near end = passBy×size in front of it (toward the viewer = +z).
          subject.position.z = baseZ + span * ((depth + passBy) * e - depth);

          // Coupled perspective scale: distant = smaller (never tiny), near = larger.
          const s = SCALE_FAR + (SCALE_NEAR - SCALE_FAR) * e;
          subject.scale.set(baseSX * s, baseSY * s, baseSZ * s);

          // Legibility envelope: at scroll=0 the subject is plainly visible —
          // the distant haze dims it to FAR_DIM, never 0. Full opacity through
          // the whole midrange; only past ~0.85 does it dissolve hard, as it
          // passes the viewer.
          let fade = 1;
          if (bool(params.fadeEnds, true)) {
            const farDim = FAR_DIM + (1 - FAR_DIM) * smooth01(scroll / 0.25);
            const nearFade = 1 - smooth01((scroll - 0.85) / 0.15);
            fade = farDim * nearFade;
          }
          for (const snap of mats) {
            // Flip .transparent only when actually fading (lazily; restored by dispose).
            if (fade < 0.999 && !snap.mat.transparent) snap.mat.transparent = true;
            snap.mat.opacity = snap.opacity * fade;
          }
        },
        dispose: () => {
          subject.position.z = baseZ;
          subject.scale.set(baseSX, baseSY, baseSZ);
          for (const snap of mats) {
            snap.mat.opacity = snap.opacity;
            snap.mat.transparent = snap.transparent;
          }
        },
      };
    },
  ),
};
