// scroll-snap-sections — the card clicks through magnetic section stops as you
// scroll, easing into each detent with a soft landing. Native take on GSAP
// ScrollTrigger's `snap` choreography (DESIGN-REFERENCES §6): scroll 0..1 is
// divided into N detents (section count - 1 segments); within each segment a
// normalized logistic sigmoid pulls the shaped progress onto the nearest stop,
// so the card DWELLS at a detent, jumps quickly through the segment middle,
// then settles. The shaped progress maps onto a vertical travel span; each
// landing gets a soft settle squash (scale dip, with a matching mid-jump
// stretch) derived purely from segment phase. CPU/transform primitive
// (medium / scroll).
//
// PURELY POSITION-DERIVED (rig-safe by construction): the pose is a pure
// function of (scroll, params) — no velocity proxy, no temporal smoothing — so
// the advocate's paused frame with repeated seeks at the same t is stable, and
// onParamChange re-applies the pose at the last seek state immediately. The
// sigmoid transition center sits EARLY in each segment (SNAP_CENTER = 0.3:
// leave the old detent fast, spend the rest of the segment easing in — the
// "soft landing" of the description). That asymmetry keeps the pinned
// mid-state (scroll = 0.5 -> segment phase 0.5 at the default 4 sections)
// ENGAGED: the card hangs just past the jump with the landing squash live, so
// sections / sharpness / span / bounce sweeps all visibly reshape it.
//
// ALWAYS LEGIBLE: at scroll = 0 the card rests undeformed half a span below
// its base pose — plainly visible, scale exactly 1. Travel is SUBJECT-RELATIVE
// (Box3 median-dim, like scroll-depth-dolly), so the default envelope stays
// inside the tile frame for any subject size; no hardcoded world units. No
// materials are touched — the subject's own look is untouched.
//
// DISTINCT from its neighbors: scroll-zoom / scroll-tilt / scroll-rotate-3d
// map scroll CONTINUOUSLY (every scroll delta moves the card); this primitive
// QUANTIZES — the card holds magnetic stops and snaps between them. And unlike
// scroll-flip-book (sibling this wave: hard stop-motion CUTS with no easing),
// every snap here is an eased glide with a stretch-through and a squash
// landing — magnetic, not mechanical.

import { Box3, Vector3, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'sections', label: 'Sections', type: 'knob', min: 2, max: 6, step: 1, default: 4 },
  { id: 'sharpness', label: 'Snap Sharpness', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.55 },
  { id: 'span', label: 'Travel Span', type: 'fader', min: 0.3, max: 1.6, step: 0.05, default: 0.7, unit: '×size' },
  { id: 'bounce', label: 'Landing Bounce', type: 'knob', min: 0, max: 0.35, step: 0.01, default: 0.14 },
] as const;

// Early transition center within each segment (0..1). The card leaves its
// detent quickly and spends the remaining ~70% of the segment settling into
// the next stop — that long settle is what makes the landing read "soft", and
// it parks the pinned scroll=0.5 frame inside the live settle window.
const SNAP_CENTER = 0.3;

// Logistic steepness range the sharpness knob maps onto: 2 = gentle glide
// between stops, 20 = hard magnetic snap (near-stair quantization).
const STEEP_MIN = 2;
const STEEP_MAX = 20;

// Stretch-through factor: how much of the bounce energy shows as elongation
// mid-jump (the anticipation half of the squash-and-stretch landing).
const STRETCH_K = 0.9;

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/** Read the scroll driver the host supplies; fall back to a CPU phase sweep. */
function scrollOf(userData: Record<string, unknown>, t: number): number {
  const s = userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return phase(t % 4, 4);
}

/** Measure the subject's size in its PARENT's units (position.y lives there).
 *  MEDIAN bbox dimension (the scroll-depth-dolly P0 lesson: max-dim overshoots
 *  on wide-flat subjects, min-dim is a flat subject's near-zero thickness).
 *  Returns 0 when the bbox is empty — caller retries each seek, since mounted
 *  artifacts can stream geometry in after attach. */
function measureLocalSize(subject: Object3D): number {
  const box = new Box3().setFromObject(subject);
  if (box.isEmpty()) return 0;
  const dims = box.getSize(new Vector3());
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

export const scrollSnapSectionsPrimitive: PrimitiveDefinition = {
  name: 'scroll-snap-sections',
  label: 'Scroll Snap Sections',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'The card clicks through magnetic section stops as you scroll — easing into each detent with a soft landing.',
  create: defineAnimatable(
    { name: 'scroll-snap-sections', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseY = subject.position.y;
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;

      // Subject-relative travel unit; 0 = not measurable yet (retried in seek).
      let size = measureLocalSize(subject);
      // Last seek time, so onParamChange can re-apply the pose at the pinned
      // driver state without waiting for the next seek.
      let lastT = 0;

      const apply = (scroll: number): void => {
        if (size <= 0) size = measureLocalSize(subject);
        const unit = size > 0 ? size : 1;

        // ── Detent grid: N stops -> N-1 segments of width w. ────────────────
        const n = Math.round(clamp(num(params.sections, 4), 2, 6));
        const segs = n - 1;
        const w = 1 / segs;
        const seg = Math.min(Math.floor(scroll * segs), segs - 1);
        const u = clamp((scroll - seg * w) / w, 0, 1); // phase within segment

        // ── Magnetic snap shaping: normalized logistic across the segment. ──
        // Normalizing to exactly 0/1 at the segment ends anchors the shaped
        // progress EXACTLY on every detent (no drift at the stops), for any
        // sharpness. Steeper logistic = harder pull toward the stops.
        const steep =
          STEEP_MIN + (STEEP_MAX - STEEP_MIN) * clamp(num(params.sharpness, 0.55), 0, 1);
        const raw = sigmoid(steep * (u - SNAP_CENTER));
        const r0 = sigmoid(steep * (0 - SNAP_CENTER));
        const r1 = sigmoid(steep * (1 - SNAP_CENTER));
        const shape = (raw - r0) / (r1 - r0);
        const p = (seg + shape) * w; // snapped progress, 0..1

        // ── Vertical travel: rest pose at the center of the span. ───────────
        // The card boots at scroll=0 sitting half a span LOW and rises through
        // the stops — subject-relative, so the default envelope fits the tile.
        const travel = Math.max(num(params.span, 0.7), 0) * unit;
        subject.position.y = baseY + (p - 0.5) * travel;

        // ── Squash-and-stretch settle, derived purely from segment phase. ───
        // transit peaks mid-jump (logistic derivative, windowed to 0 at the
        // detents so low sharpness never leaves the card stretched at rest);
        // land is a half-sine settle pulse across the post-transition glide.
        const bounce = clamp(num(params.bounce, 0.14), 0, 1);
        const transit = 4 * raw * (1 - raw) * Math.sin(Math.PI * u);
        const land = Math.sin(Math.PI * clamp((u - SNAP_CENTER) / (1 - SNAP_CENTER), 0, 1));
        const stretch = STRETCH_K * bounce * transit; // elongate through the jump
        const squash = bounce * land; // dip into the landing
        subject.scale.set(
          baseSX * (1 - 0.55 * stretch + 0.6 * squash),
          baseSY * (1 + stretch - squash),
          baseSZ,
        );
      };

      return {
        // Scroll-driven scrub: continuous timeline so a CPU clock fallback
        // also sweeps the full section run when no scroll driver is wired.
        duration: () => Infinity,
        seek: (t) => {
          lastT = t;
          apply(scrollOf(target.userData, t));
        },
        onParamChange: () => {
          // Re-apply at the last seek state so control sweeps reshape the
          // pinned frame immediately (no waiting for the next driver tick).
          apply(scrollOf(target.userData, lastT));
        },
        dispose: () => {
          subject.position.y = baseY;
          subject.scale.set(baseSX, baseSY, baseSZ);
        },
      };
    },
  ),
};
