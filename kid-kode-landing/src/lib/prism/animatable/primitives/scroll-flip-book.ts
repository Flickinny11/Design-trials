// scroll-flip-book — Scroll riffles a stop-motion flip-book: the card jumps
// through hand-posed frames with HARD CUTS (zero interpolation — the printed-
// animation signature), like a paper flip-book thumbed by the page. Scroll
// progress picks frame index = floor(progress · N) over N deterministic poses
// along a chosen sequence (tumble: progressive roll + drift; bounce: arc hops
// with grounded squash; spin: yaw steps with scale pulses). A hold-ratio warps
// the page widths — early pages stick under the thumb while tension builds,
// then the riffle accelerates — and an index-hashed jitter adds the handmade
// per-frame wobble of a real stop-motion rig. (DESIGN-REFERENCES §6: GSAP
// ScrollTrigger scrub choreography, quantized to discrete frames instead of a
// continuous tween.)
//
// SCROLL-RIG: position-centric by construction — the pose is a pure
// deterministic function of the scroll value (the flip-book "pages" exist
// mathematically; no per-seek state), so the advocate's PAUSED control sweep
// at scroll=0.5 always pins an engaged mid-riffle pose, and every control
// (frames / sequence / holdRatio / jitter) reshapes that exact pinned frame.
// Frame 0 is the pristine cover page: at scroll=0 the subject rests at its
// base transform, fully legible. p=1 always lands the final page, and travel
// is SUBJECT-RELATIVE (Box3 median-dim, the scroll-depth-dolly P0 lesson) so
// the whole envelope stays inside the tile at defaults.
//
// DISTINCT from scroll-snap-sections (eased magnetic settle between sections —
// continuous easing toward anchors; this never eases: pure hard cuts), from
// scroll-rotate-3d (one continuous axis tilt scrubbed smoothly), from
// scroll-flip (a single eased flip), and from flip-board (time-driven quantized
// flip-IN on one axis; this is a scroll-scrubbed multi-pose sequence with
// drift, hops, and hashed wobble). Pure CPU transform: no overlay/clone
// geometry, no material writes — the subject's own look is untouched.

import { Box3, Vector3, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, str, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'frames', label: 'Frames', type: 'knob', min: 4, max: 16, step: 1, default: 8 },
  {
    id: 'sequence',
    label: 'Sequence',
    type: 'dropdown',
    options: [
      { value: 'tumble', label: 'Tumble' },
      { value: 'bounce', label: 'Bounce' },
      { value: 'spin', label: 'Spin' },
    ],
    default: 'tumble',
  },
  { id: 'holdRatio', label: 'Page Hold', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.35 },
  { id: 'jitter', label: 'Hand Wobble', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.25 },
] as const;

// Sequence amplitudes (multiples of the subject's measured median dimension —
// never absolute world units). Conservative so the default envelope, including
// the rotated card's diagonal, stays inside the tile frame.
const TUMBLE_TOTAL = Math.PI * 1.5; // 270° roll across the book
const TUMBLE_DRIFT_X = 0.26;
const TUMBLE_DRIFT_Y = 0.1;
const BOUNCE_HEIGHT = 0.3;
const BOUNCE_DRIFT_X = 0.22;
const BOUNCE_SQUASH = 0.16;
const SPIN_LEAN = 0.26; // constant x-lean once spinning: edge-on yaw still shows a face band
const SPIN_PULSE = 0.14;
const JITTER_POS = 0.035; // ×dim per axis
const JITTER_ROT = 0.06; // rad

/** Deterministic 0..1 hash (sin-fract — index hashes only, no Math.random). */
const hash01 = (n: number): number => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
/** Centered −1..1 variant. */
const hashC = (n: number): number => (hash01(n) - 0.5) * 2;

/** Read the scroll driver the host supplies; fall back to a looping phase so a
 *  bare time driver still riffles the book (scroll-skew convention, finite-
 *  guarded). */
const scrollOf = (userData: Record<string, unknown>, t: number): number => {
  const s = userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return phase(t % 4, 4);
};

/** Measure the subject's median dimension in its parent's units (the space its
 *  position/scale writes live in). Median, not max — the scroll-depth-dolly P0
 *  lesson: max-dim makes wide-flat subjects (headlines) travel absurdly far.
 *  Returns 0 when the bbox is empty/degenerate (caller falls back + retries —
 *  mounted artifacts can stream geometry in AFTER attach). */
function measureMedianDim(subject: Object3D): number {
  const box = new Box3().setFromObject(subject);
  if (box.isEmpty()) return 0;
  const dims = box.getSize(new Vector3());
  const sorted = [dims.x, dims.y, dims.z].sort((a, b) => a - b);
  let size = sorted[1];
  if (!Number.isFinite(size) || size <= 1e-6) size = sorted[2];
  if (!Number.isFinite(size) || size <= 1e-6) return 0;
  if (subject.parent) {
    const ps = subject.parent.getWorldScale(new Vector3());
    const s = Math.max(Math.abs(ps.x), Math.abs(ps.y), Math.abs(ps.z));
    if (Number.isFinite(s) && s > 1e-6) size /= s;
  }
  return size;
}

/** Page-hold weight for frame i of n: early pages hold longer (the thumb
 *  builds tension, then the riffle accelerates) plus a hashed per-page
 *  stickiness — so any nonzero hold visibly re-times the book. */
const holdWeight = (i: number, n: number, hold: number): number => {
  const f = n > 1 ? i / (n - 1) : 0;
  return 1 + hold * (2.2 * (1 - f) + 1.1 * hash01(i * 7.31 + 2.17));
};

/** Quantize scroll progress to a frame index with hard cuts. holdRatio = 0 is
 *  the uniform floor(p·n); otherwise pages span hold-weighted slots. p=0 is
 *  always the cover page (index 0); p=1 is always the final page (n-1). */
function frameIndex(p: number, n: number, hold: number): number {
  const pc = clamp(p, 0, 1);
  if (hold <= 1e-6) return Math.min(n - 1, Math.floor(pc * n));
  let total = 0;
  for (let i = 0; i < n; i++) total += holdWeight(i, n, hold);
  const cut = pc * total;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += holdWeight(i, n, hold);
    if (cut < acc) return i;
  }
  return n - 1;
}

interface FramePose {
  x: number;
  y: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  sclX: number;
  sclY: number;
}

/** The hand-posed page: a pure deterministic function of (index, count,
 *  sequence, jitter). Frame 0 is always the pristine rest pose (cover page);
 *  adjacent-frame deltas are large by construction so cuts read as cuts
 *  (tumble: ~1.5π/(n-1) rad of roll per page). All offsets are in multiples
 *  of `dim` (subject-relative). */
function poseFor(i: number, n: number, sequence: string, jitter: number, dim: number): FramePose {
  const f = n > 1 ? i / (n - 1) : 0;
  const pose: FramePose = { x: 0, y: 0, rotX: 0, rotY: 0, rotZ: 0, sclX: 1, sclY: 1 };

  if (sequence === 'bounce') {
    // Two arc hops: lifted mid-arc poses, grounded frames squash like a
    // stop-motion puppet landing (scaleY dips, scaleX bulges), with a small
    // alternating lean into the travel.
    const arc = Math.abs(Math.sin(f * Math.PI * 2));
    pose.y = arc * BOUNCE_HEIGHT * dim;
    pose.x = Math.sin(f * Math.PI) * BOUNCE_DRIFT_X * dim;
    const squash = i === 0 ? 0 : BOUNCE_SQUASH * (1 - arc);
    pose.sclY = 1 - squash;
    pose.sclX = 1 + 0.7 * squash;
    pose.rotZ = Math.sin(f * Math.PI * 4) * 0.1;
  } else if (sequence === 'spin') {
    // Yaw steps through a full revolution with scale pulses. The constant
    // x-lean (once spinning) keeps a face band visible even at edge-on yaw —
    // no sampled frame is ever empty.
    pose.rotY = f * Math.PI * 2;
    pose.rotX = i === 0 ? 0 : SPIN_LEAN;
    const pulse = 1 + SPIN_PULSE * Math.sin(f * Math.PI * 4);
    pose.sclX = pulse;
    pose.sclY = pulse;
  } else {
    // tumble (default): progressive 270° roll with an out-and-back lateral
    // drift and a gentle S-curve fall — the classic corner-doodle flip-book.
    pose.rotZ = f * TUMBLE_TOTAL;
    pose.x = Math.sin(f * Math.PI) * TUMBLE_DRIFT_X * dim;
    pose.y = -Math.sin(f * Math.PI * 2) * TUMBLE_DRIFT_Y * dim;
  }

  // Handmade wobble: index-hashed micro-offsets, deterministic per page. The
  // cover page (i=0) stays pristine so the rest pose is exactly the subject's
  // own transform.
  if (i > 0 && jitter > 1e-6) {
    pose.x += hashC(i * 3 + 1) * jitter * JITTER_POS * dim;
    pose.y += hashC(i * 3 + 2) * jitter * JITTER_POS * dim;
    pose.rotZ += hashC(i * 3 + 3) * jitter * JITTER_ROT;
  }
  return pose;
}

export const scrollFlipBookPrimitive: PrimitiveDefinition = {
  name: 'scroll-flip-book',
  label: 'Scroll Flip-Book',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll riffles a stop-motion flip-book — the card jumps through hand-posed frames in hard cuts, like a printed animation thumbed by the page.',
  create: defineAnimatable(
    { name: 'scroll-flip-book', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;

      // Full transform snapshot — dispose() hands the subject back exactly as
      // found. Poses are written as base ⊕ delta every seek (all components,
      // so sequence switches can never leave a stale axis behind).
      const basePX = subject.position.x;
      const basePY = subject.position.y;
      const basePZ = subject.position.z;
      const baseRX = subject.rotation.x;
      const baseRY = subject.rotation.y;
      const baseRZ = subject.rotation.z;
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;

      // Subject-relative travel unit; 0 = not measurable yet (mounted
      // artifacts pour geometry asynchronously — re-tried lazily in apply()).
      let dim = measureMedianDim(subject);
      // Last seek time, so onParamChange re-applies the pose at the exact
      // pinned state the rig is showing.
      let lastT = 0;

      const apply = (scroll: number): void => {
        if (dim <= 0) {
          // Lazy re-measure for async mounts — reset to the base transform
          // first so an already-applied pose (rotation!) can't inflate the AABB.
          subject.position.set(basePX, basePY, basePZ);
          subject.rotation.set(baseRX, baseRY, baseRZ);
          subject.scale.set(baseSX, baseSY, baseSZ);
          dim = measureMedianDim(subject);
        }
        const span = dim > 0 ? dim : 1;

        const n = clamp(Math.round(num(params.frames, 8)), 2, 64);
        const sequence = str(params.sequence, 'tumble');
        const hold = clamp(num(params.holdRatio, 0.35), 0, 1);
        const jitter = clamp(num(params.jitter, 0.25), 0, 1);

        // HARD CUT: pick the page, apply its pose verbatim. No interpolation.
        const idx = frameIndex(scroll, n, hold);
        const pose = poseFor(idx, n, sequence, jitter, span);

        subject.position.set(basePX + pose.x, basePY + pose.y, basePZ);
        subject.rotation.set(baseRX + pose.rotX, baseRY + pose.rotY, baseRZ + pose.rotZ);
        subject.scale.set(baseSX * pose.sclX, baseSY * pose.sclY, baseSZ);
      };

      return {
        // Purely stateful: scroll-driven, no fixed timeline.
        duration: () => Infinity,
        seek: (t) => {
          lastT = t;
          apply(scrollOf(target.userData, t));
        },
        onParamChange: () => {
          // Re-apply at the last seek state so every knob reads live on the
          // advocate's pinned frame without waiting for the next driver tick.
          apply(scrollOf(target.userData, lastT));
        },
        dispose: () => {
          subject.position.set(basePX, basePY, basePZ);
          subject.rotation.set(baseRX, baseRY, baseRZ);
          subject.scale.set(baseSX, baseSY, baseSZ);
        },
      };
    },
  ),
};
