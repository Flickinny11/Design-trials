// scroll-path-scrub — scroll steers the card along a sculpted 3D path, banking
// into the curves like a camera dolly on a bent track (DESIGN-REFERENCES §6:
// the GSAP-ScrollTrigger scrubbed-motion-path read, implemented natively).
// Three authored CatmullRomCurve3 tracks (s-curve sweeping across the tile /
// rising arc / gentle loop) live in unit "path space"; scroll arc-length-scrubs
// the curve parameter, and the resulting point is scaled by a SUBJECT-RELATIVE
// span (Box3-measured median dimension × travel, never hardcoded world units)
// and added to the rest pose. Orient-to-path steers the card: yaw follows the
// tangent's lateral heading, pitch its climb — both gain-capped so the card
// NEVER turns edge-on — and roll banks into curvature (signed turn rate of the
// screen-plane heading), the premium dolly read. Stateful / scroll-driven
// (medium / scroll). CPU/transform only: the subject's own materials are never
// touched.
//
// POSITION-CENTRIC by design (scroll-rig discipline): the pose is a pure
// deterministic function of the scroll POSITION, so the advocate's pinned
// repeated-seek frame at scroll=0.5 is fully engaged (mid-track, steering,
// banked) and every control visibly reshapes it — no velocity proxy needed.
// onParamChange re-applies the pose at the last seek's scroll immediately.
//
// ALWAYS LEGIBLE: at scroll=0 the card sits at the track's start — inside the
// tile frame, unrotated beyond the orientation caps, materials untouched. The
// whole default-travel envelope stays inside the tile; z is bounded by the path
// authoring (|z| ≤ 0.2 path units) so the card never dives behind the backdrop
// (the scroll-depth-dolly P0 lesson).
//
// DISTINCT from scroll-depth-dolly (a straight z-axis dolly with coupled
// scale + opacity envelope — this is a lateral CURVED track with tangent
// steering and curvature banking; z is a mild bow, scale/opacity untouched)
// and from scroll-inertia-glide (straight-axis lag/spring glide — this has NO
// lag physics; the pose is an exact function of scroll along a bent track).

import { Box3, CatmullRomCurve3, Vector3, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, str, bool, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  {
    id: 'path',
    label: 'Path',
    type: 'dropdown',
    options: [
      { value: 's-curve', label: 'S-Curve' },
      { value: 'arc', label: 'Rising Arc' },
      { value: 'loop', label: 'Gentle Loop' },
    ],
    default: 's-curve',
  },
  { id: 'bank', label: 'Banking', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  // Subject-relative span (multiples of the subject's measured size) — never
  // absolute world units (mounted artifacts vary wildly in size).
  { id: 'travel', label: 'Travel', type: 'fader', min: 0.2, max: 1.5, step: 0.05, default: 0.6, unit: '×size' },
  { id: 'orient', label: 'Orient To Path', type: 'toggle', default: true },
] as const;

// ── Authored tracks (unit path space: x right, y up, z toward viewer) ───────
// All coordinates are bounded: |x| ≤ 1, |y| ≤ 0.42, |z| ≤ 0.2, so the world
// envelope is span-bounded on every axis and the z bow can never park the
// subject behind a hub backdrop. Centripetal parameterization avoids cusps
// (the loop's control polygon intentionally self-crosses).
const mkCurve = (pts: ReadonlyArray<readonly [number, number, number]>) =>
  new CatmullRomCurve3(
    pts.map(([x, y, z]) => new Vector3(x, y, z)),
    false,
    'centripetal',
  );

const TRACKS: Record<string, CatmullRomCurve3> = {
  // Asymmetric S sweeping across the tile: crest → dip → trough → exit-rise.
  // Asymmetric on purpose so the arc-length midpoint (the advocate's pinned
  // scroll=0.5 frame) lands INSIDE a bend, not on a zero-curvature inflection.
  's-curve': mkCurve([
    [-1.0, -0.3, 0.02],
    [-0.5, 0.34, 0.16],
    [0.1, 0.06, -0.12],
    [0.6, -0.3, 0.1],
    [1.0, 0.32, 0.0],
  ]),
  // Rising arc: bottom-left up over an apex and down to bottom-right — max
  // curvature (max bank) right at the midpoint.
  arc: mkCurve([
    [-1.0, -0.38, 0.0],
    [-0.55, 0.1, 0.14],
    [0.0, 0.4, 0.2],
    [0.55, 0.1, 0.14],
    [1.0, -0.38, 0.0],
  ]),
  // Gentle loop: drift right, curl up and back over itself (one full 360°
  // heading turn), then exit right — banked hard through the curl.
  loop: mkCurve([
    [-1.0, -0.15, 0.0],
    [-0.3, -0.25, 0.1],
    [0.35, 0.0, 0.16],
    [0.1, 0.4, 0.06],
    [-0.35, 0.15, -0.1],
    [0.0, -0.28, -0.14],
    [1.0, -0.05, 0.0],
  ]),
};

// Orientation gains/caps (radians at |tangent component| = 1). Deliberately
// well below π/2: the card steers convincingly but never turns edge-on.
const YAW_GAIN = 0.6;
const PITCH_GAIN = 0.45;
// Bank = turn rate (d heading / d u, screen plane) × bankAmount × BANK_SCALE,
// clamped. The loop's curl turns ~2π over ~0.5u (rate ≈ 12) and clamps; the
// arc apex (~rate 3-4) lands mid-range.
const BANK_SCALE = 0.16;
const MAX_BANK = 0.85;
// Finite-difference half-step on the curve parameter for the turn rate.
const TURN_EPS = 0.015;

/** Wrap an angle delta into (-π, π] so heading crossings don't spike. */
const wrapPi = (a: number): number => {
  let d = a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

/** Measure the subject's size in its PARENT's units (position lives there).
 *  MEDIAN dimension (the scroll-depth-dolly P0 lesson: max overshoots on
 *  wide-flat headlines, min is a flat subject's near-zero thickness). Returns
 *  0 when the bbox is empty/degenerate — caller retries each seek (some
 *  artifacts stream geometry in after mount). */
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

export const scrollPathScrubPrimitive: PrimitiveDefinition = {
  name: 'scroll-path-scrub',
  label: 'Scroll Path Scrub',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll steers the card along a sculpted 3D path — banking into the curves like a camera dolly on a bent track.',
  create: defineAnimatable(
    { name: 'scroll-path-scrub', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      // Snapshot the FULL rest pose — mounted artifacts arrive posed.
      const basePX = subject.position.x;
      const basePY = subject.position.y;
      const basePZ = subject.position.z;
      const baseRX = subject.rotation.x;
      const baseRY = subject.rotation.y;
      const baseRZ = subject.rotation.z;

      // Subject-relative travel unit; 0 = not measurable yet (retried in apply).
      let size = measureLocalSize(subject);
      // Last applied scroll, persisted across seeks so onParamChange re-poses
      // at the exact state the advocate's pinned frame is showing.
      let lastScroll = 0;

      // Scratch vectors — apply() is synchronous, so reuse is safe.
      const P = new Vector3();
      const T = new Vector3();
      const TA = new Vector3();
      const TB = new Vector3();

      const readScroll = (t: number): number => {
        const s = (target.userData as { scroll?: unknown }).scroll;
        if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
        // No scroll driver wired → CPU phase sweep scrubs the full track.
        return phase(t % 4, 4);
      };

      const apply = (scroll: number) => {
        lastScroll = scroll;
        if (size <= 0) size = measureLocalSize(subject);
        const span = (size > 0 ? size : 1) * Math.max(num(params.travel, 0.6), 0);

        const curve = TRACKS[str(params.path, 's-curve')] ?? TRACKS['s-curve'];
        const u = clamp(scroll, 0, 1);
        // Stay inside the open interval for tangent sampling stability.
        const uu = clamp(u, 0.001, 0.999);

        // Position: arc-length-uniform scrub of the unit track, scaled by the
        // subject-relative span around the rest pose.
        curve.getPointAt(u, P);
        subject.position.set(basePX + P.x * span, basePY + P.y * span, basePZ + P.z * span);

        // Orientation. Uniform scaling preserves tangent direction, so the
        // unit-space tangent is exact for the scaled track.
        let yaw = 0;
        let pitch = 0;
        let roll = 0;
        if (bool(params.orient, true)) {
          curve.getTangentAt(uu, T);
          // Steer into the travel direction: yaw with the lateral heading,
          // pitch with the climb — both capped by gain (|tangent| ≤ 1).
          yaw = YAW_GAIN * clamp(T.x, -1, 1);
          pitch = -PITCH_GAIN * clamp(T.y, -1, 1);
        }
        const bank = num(params.bank, 1);
        if (bank > 0) {
          // Signed turn rate of the screen-plane heading (finite difference).
          curve.getTangentAt(clamp(uu - TURN_EPS, 0.001, 0.999), TA);
          curve.getTangentAt(clamp(uu + TURN_EPS, 0.001, 0.999), TB);
          const dTheta = wrapPi(Math.atan2(TB.y, TB.x) - Math.atan2(TA.y, TA.x));
          const turnRate = dTheta / (2 * TURN_EPS);
          // Lean INTO the turn (counterclockwise heading → counterclockwise
          // roll), clamped so the card stays legible even on the loop's curl.
          roll = clamp(bank * turnRate * BANK_SCALE, -MAX_BANK, MAX_BANK);
        }
        subject.rotation.set(baseRX + pitch, baseRY + yaw, baseRZ + roll);
      };

      return {
        // Purely stateful: driven by scroll input, no fixed timeline.
        duration: () => Infinity,
        seek: (t) => {
          apply(readScroll(t));
        },
        onParamChange: () => {
          // Re-apply at the last seek's scroll so every control reshapes the
          // advocate's pinned frame immediately, without waiting for a tick.
          apply(lastScroll);
        },
        dispose: () => {
          // Pure transform primitive: restore the full rest pose. No materials
          // were touched and no resources were created.
          subject.position.set(basePX, basePY, basePZ);
          subject.rotation.set(baseRX, baseRY, baseRZ);
        },
      };
    },
  ),
};
