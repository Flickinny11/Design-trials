// scroll-wave-ride — the card surfs a rolling swell: scroll scrubs the PHASE of
// a traveling two-octave sine field (swell + chop), so the wave rolls under the
// card as the page scrolls. The card heaves with the local wave height, rolls
// to the local wave SLOPE (derivative-coupled counter-roll — the buoy physics
// read), surges on the orbital x-motion 90° out of phase with the heave, and
// drifts across a small bounded span (Stokes drift) over the full scroll.
// §6 Advanced Scroll Engines technique (Lenis/Locomotive progress → field
// uniform), implemented natively: scroll position IS the sea state.
//
// PURE SCRUBBED FIELD — ZERO STATE: the pose is a pure function of scroll
// position (no velocity proxy, no springs, no settling). Re-seeking the same
// scroll yields the identical pose, so the advocate's paused control sweep at
// scroll=0.5 sits on a fully engaged mid-swell frame (hand-scanned octave
// phases guarantee ~75% heave + ~18° roll there at defaults) and every control
// visibly re-shapes it.
//
// DISTINCT from float / hover idles: those are TIME-driven gentle bobs that
// never stop; this one is scroll-SCRUBBED — the sea is frozen until you scroll,
// and the roll is slope-derived, not an independent sine. DISTINCT from
// scroll-pendulum-sway (impulse physics, velocity-charged state that settles):
// this is a stateless field scrub — same scroll, same pose, always.
//
// All travel is SUBJECT-RELATIVE (Box3 median-dim convention from
// scroll-depth-dolly): amplitudes and the drift span are multiples of the
// subject's measured size, never hardcoded world units. Transforms only —
// no materials, no geometry, no opacity writes; the subject keeps its own look
// untouched and is fully legible at every scroll. dispose() restores
// position.x/y and rotation.z exactly. Handles Mesh and Group subjects.

import { Box3, Vector3, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Subject-relative heights/spans (multiples of the subject's measured median
  // dimension) — never absolute world units.
  { id: 'swellAmp', label: 'Swell', type: 'fader', min: 0.02, max: 0.4, step: 0.01, default: 0.14, unit: '×size' },
  { id: 'wavelength', label: 'Wavelength', type: 'knob', min: 0.6, max: 4, step: 0.05, default: 1.6, unit: '×size' },
  { id: 'chop', label: 'Chop', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.5 },
  { id: 'rollCoupling', label: 'Roll Coupling', type: 'knob', min: 0, max: 1.5, step: 0.05, default: 0.55 },
] as const;

const TWO_PI = Math.PI * 2;
// Distance the wave field travels over the full scroll, ×size. At the default
// wavelength (1.6×size) that's ~1.9 swell cycles passing under the card.
const TRAVEL = 3.0;
// Chop octave: shorter wavelength by a NON-INTEGER ratio so the two octaves
// never phase-lock — the ride reads organic, not metronomic.
const CHOP_RATIO = 2.7;
// Chop height as a fraction of the swell height (scaled by the chop control).
const CHOP_AMP = 0.45;
// Orbital surge: deep-water wave particles move in circles, so the x-surge is
// the same order as the heave, 90° out of phase with it.
const SURGE = 0.5;
// Bounded Stokes-drift span across the full scroll, ×size (the buoy is slowly
// carried in the wave direction — kept small so the tile framing holds).
const DRIFT_SPAN = 0.22;

// Index-hashed octave phase offsets (deterministic — no Math.random). The salt
// is hand-scanned (8.21) so that at DEFAULT params the pinned advocate frame at
// scroll=0.5 lands mid-swell: |heave| ≈ 0.75×amplitude with ≈18° of roll —
// an engaged pose every control sweep visibly re-shapes. scroll=0 rests near
// the waterline (calm, fully legible).
const OCTAVE_SALT = 8.21;
const octavePhase = (i: number): number => {
  const h = Math.sin((i + 1) * OCTAVE_SALT) * 43758.5453;
  return (h - Math.floor(h)) * TWO_PI;
};
const PHI_SWELL = octavePhase(0);
const PHI_CHOP = octavePhase(1);

/** Read the scroll driver the host supplies; fall back to a CPU phase sweep
 *  (scroll-skew convention: userData.scroll, finite-guarded). */
function readScroll(userData: Record<string, unknown>, t: number): number {
  const s = userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return phase(t % 4, 4);
}

/** Measure the subject's size in its PARENT's units (position.x/y live there).
 *  MEDIAN bbox dimension (the scroll-depth-dolly P0 convention): max-dim makes
 *  wide-flat subjects travel absurdly far, min-dim is a flat subject's
 *  near-zero thickness; the median tracks the typical visual extent of cards,
 *  headlines, and meshes alike. Returns 0 when the bbox is empty/degenerate
 *  (caller falls back + retries — some artifacts stream geometry after mount). */
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

export const scrollWaveRidePrimitive: PrimitiveDefinition = {
  name: 'scroll-wave-ride',
  label: 'Scroll Wave Ride',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'The card surfs a rolling swell — bobbing and rolling as the wave travels under it, the scroll scrubbing the sea.',
  create: defineAnimatable(
    { name: 'scroll-wave-ride', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseRotZ = subject.rotation.z;

      // Subject-relative travel unit; 0 = not measurable yet (some mounted
      // artifacts stream geometry in after attach — re-tried in applyPose).
      let size = measureLocalSize(subject);
      // Last driver state, so onParamChange re-applies the pose at the pinned
      // frame without waiting for the next seek.
      let lastScroll = readScroll(target.userData, 0);

      const applyPose = (scroll: number): void => {
        if (size <= 0) size = measureLocalSize(subject);
        const span = size > 0 ? size : 1;

        const amp = num(params.swellAmp, 0.14);
        const lam = Math.max(num(params.wavelength, 1.6), 0.1);
        const chop = clamp(num(params.chop, 0.5), 0, 1);
        const coupling = num(params.rollCoupling, 0.55);

        const A = amp * span; // heave amplitude, local units
        const k = TWO_PI / (lam * span); // swell wavenumber, 1/local-units
        const kChop = k * CHOP_RATIO;

        // Bounded Stokes drift: the buoy is carried across DRIFT_SPAN×size over
        // the full scroll, centered on the rest pose (in frame at both ends).
        const drift = DRIFT_SPAN * span * (scroll - 0.5);
        // Sample the traveling field AT the drifted position — the card moves
        // through the sea while the sea moves under the card.
        const x = baseX + drift;

        // Traveling-wave phases: theta = k·x − k·(travel distance), i.e. the
        // PHASE is scrubbed by scroll position, not by time. Each octave
        // travels at the same spatial speed, so the shorter chop wavelength
        // cycles proportionally faster.
        const thetaSwell = k * x - (TWO_PI * TRAVEL * scroll) / lam + PHI_SWELL;
        const thetaChop =
          kChop * x - (TWO_PI * TRAVEL * scroll * CHOP_RATIO) / lam + PHI_CHOP;

        // Heave = local wave height (two octaves).
        const heave =
          A * Math.sin(thetaSwell) + A * CHOP_AMP * chop * Math.sin(thetaChop);
        // Local slope dy/dx — the analytic derivative of the height field.
        // (A·k = amp·2π/λ is dimensionless: roll is size-independent.)
        const slope =
          A * k * Math.cos(thetaSwell) +
          A * CHOP_AMP * chop * kChop * Math.cos(thetaChop);
        // Orbital surge, 90° out of phase with the swell heave.
        const surge = -A * SURGE * Math.cos(thetaSwell);

        subject.position.x = baseX + drift + surge;
        subject.position.y = baseY + heave;
        // Derivative-coupled counter-roll: the card leans against the local
        // face of the wave; atan bounds the lean below 90° even at extreme
        // wavelength/chop sweeps, coupling gates it 0 (dead level) → 1.5.
        subject.rotation.z = baseRotZ - Math.atan(slope) * coupling;
      };

      return {
        // Purely stateful: driven by scroll input, no fixed timeline.
        duration: () => Infinity,
        seek: (t) => {
          lastScroll = readScroll(target.userData, t);
          applyPose(lastScroll);
        },
        onParamChange: () => {
          // Re-pose the pinned frame immediately — controls read live.
          applyPose(lastScroll);
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.position.y = baseY;
          subject.rotation.z = baseRotZ;
        },
      };
    },
  ),
};
