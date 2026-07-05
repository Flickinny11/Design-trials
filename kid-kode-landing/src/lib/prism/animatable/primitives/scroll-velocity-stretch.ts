// scroll-velocity-stretch — scroll speed pulls the card like taffy along its
// travel: stretching long mid-fling, relaxing square as the page settles.
// Scroll-story primitive (medium / scroll / card), DESIGN-REFERENCES §6
// velocity-reactive deformation (the Lenis/Locomotive `scroll.on('scroll')`
// velocity → element-skew/stretch recipe, built natively on our stack).
//
// Two coupled responses, both CPU-observable:
//  • POSITION (always alive): scroll 0..1 glides the card along a chosen axis
//    through a SUBJECT-RELATIVE travel span (Box3-measured ×size multiples,
//    never world units) with an accelerating ease (scroll^1.6 — slow peel-off,
//    inertial arrival). The ease is deliberately asymmetric so the travel
//    control visibly shifts even a frame pinned at scroll=0.5.
//  • DEFORMATION (velocity-reactive): a per-seek velocity proxy
//    |Δscroll|/dt feeds a slowly-decaying `lastImpulse` envelope
//    (impulse = max(instantVelocity, impulse·e^(−damping·dt)) — the
//    blend(instant, lastImpulse) demanded by the pinned-frame rig). The
//    envelope drives anisotropic scale along the travel axis with EXACT
//    volume-preserving counter-squash (sPerp = 1/√sAlong on both other axes),
//    windowed by sin(π·scroll) so the taffy stretches MID-FLIGHT and arrives
//    square at both travel ends (which also pins the default envelope inside
//    the tile frame no matter how violent the fling).
//    Re-seeks at the same t (a paused/pinned frame) re-apply without decaying,
//    so the engaged mid-state survives the advocate's control sweeps; a cold
//    first seek with no history infers the fling from position via
//    2·√(s(1−s)) — exactly the rig's cosine-stimulus |velocity| at position s
//    (1 at s=0.5, 0 at both rests), so a pinned t=1 frame is engaged and the
//    idle t=0 frame is a plainly legible square card at the travel start.
//
// onParamChange re-applies the pose from the stored seek state (scroll +
// impulse), so every control — gain, travel, axis, damping — visibly reshapes
// a frozen frame. settleDamping doubles as the taffy's stiffness: it sets the
// envelope decay rate AND scales the sustained deformation amplitude
// ((DAMP_REF/damping)^0.4 — compliance falls as stiffness rises), so sweeping
// it reshapes the pinned frame too, honestly.
//
// DISTINCT from its neighbors:
//  • scroll-skew — rotational shear (rotation.z) with NO travel and NO
//    anisotropic scale; settles instantly when scroll rests. Ours never
//    touches rotation: it TRAVELS along an axis and stretch/squashes with a
//    persisted, dt-decaying impulse envelope.
//  • liquid-stretch-morph — a TIME-looped A→B→A flight whose deformation
//    follows a scripted flight-velocity profile. Ours is scroll-driven with a
//    LIVE measured velocity proxy — no loop, no scripted timeline.
//  • scroll-depth-dolly — z travel coupled to scale+opacity. Ours travels in
//    the view plane, never touches materials, and deforms anisotropically.
//
// Transforms only (works on Mesh or Group subjects — MSDF text included); no
// materials, geometry, or shaders are created, so dispose() is a pure exact
// restore of the snapshotted base position + scale. Deterministic: no
// Math.random; the only state is the velocity closure, dt-normalized from
// consecutive seek times (clamped 1/240..0.25s).

import { Box3, Vector3, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, str, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'stretchGain', label: 'Stretch Gain', type: 'knob', min: 0.1, max: 1.5, step: 0.05, default: 0.6 },
  { id: 'travel', label: 'Travel Span', type: 'fader', min: 0.2, max: 1.6, step: 0.05, default: 0.85, unit: '×size' },
  {
    id: 'axis',
    label: 'Axis',
    type: 'dropdown',
    options: [
      { value: 'vertical', label: 'Vertical' },
      { value: 'horizontal', label: 'Horizontal' },
    ],
    // Vertical by default: the card's y half-extent (0.56) leaves the most
    // frame headroom, so the whole default travel+stretch envelope stays
    // inside the tile (rig camera fov 40 @ z=3.2 → half-extent ≈ 1.165).
    default: 'vertical',
  },
  { id: 'settleDamping', label: 'Settle Damping', type: 'knob', min: 0.6, max: 8, step: 0.1, default: 2.5, unit: '/s' },
] as const;

// Travel ease exponent — accelerating glide, asymmetric on purpose (see header).
const TRAVEL_BIAS = 1.6;
// Velocity normalizer: the catalog rig's cosine stimulus
// scroll(t) = 0.5 − 0.5·cos(2πt/4) peaks at |ds/dt| = π/4 ≈ 0.785/s, so a
// full-speed rig fling reads as velNorm ≈ 1. Real pages scrolling faster cap
// at VELNORM_CAP.
const VEL_REF = Math.PI / 4;
const VELNORM_CAP = 1.25;
// dt clamp for the velocity proxy + envelope decay (paused tabs, first frames).
const DT_MIN = 1 / 240;
const DT_MAX = 0.25;
// settleDamping reference: dampAmp = (DAMP_REF/damping)^0.4 is exactly 1 at
// the default, >1 for looser taffy, <1 for stiffer.
const DAMP_REF = 2.5;
const DAMP_AMP_POW = 0.4;
const DAMP_AMP_MIN = 0.4;
const DAMP_AMP_MAX = 2.0;
// Hard ceiling on elongation — premium taffy, never silly putty.
const S_ALONG_MAX = 2.2;

/** Measure the subject's bbox dims in its PARENT's local units (where
 *  position/scale live), compensated back to the subject's BASE scale so a
 *  mid-animation lazy re-measure (async-mounted artifacts pour geometry after
 *  attach) still yields the rest-pose size. Null when empty/degenerate. */
function measureLocalDims(subject: Object3D, baseScale: Vector3): Vector3 | null {
  const box = new Box3().setFromObject(subject);
  if (box.isEmpty()) return null;
  const dims = box.getSize(new Vector3());
  // World → parent-local: divide out the parent's world scale per axis.
  if (subject.parent) {
    const ps = subject.parent.getWorldScale(new Vector3());
    dims.x /= Number.isFinite(ps.x) && Math.abs(ps.x) > 1e-6 ? Math.abs(ps.x) : 1;
    dims.y /= Number.isFinite(ps.y) && Math.abs(ps.y) > 1e-6 ? Math.abs(ps.y) : 1;
    dims.z /= Number.isFinite(ps.z) && Math.abs(ps.z) > 1e-6 ? Math.abs(ps.z) : 1;
  }
  // Current → base scale: divide out any deformation this primitive (or a
  // co-binding) has already applied relative to the snapshot.
  const cs = subject.scale;
  dims.x /= Math.abs(cs.x) > 1e-6 ? Math.abs(cs.x / (baseScale.x || 1)) : 1;
  dims.y /= Math.abs(cs.y) > 1e-6 ? Math.abs(cs.y / (baseScale.y || 1)) : 1;
  dims.z /= Math.abs(cs.z) > 1e-6 ? Math.abs(cs.z / (baseScale.z || 1)) : 1;
  if (!Number.isFinite(dims.x + dims.y + dims.z)) return null;
  if (Math.max(dims.x, dims.y, dims.z) <= 1e-6) return null;
  return dims;
}

/** Travel unit along an axis: that axis's extent, falling back to the median
 *  dimension for degenerate axes (paper-flat subjects), then to 1. */
function axisSize(dims: Vector3 | null, axis: 'x' | 'y'): number {
  if (!dims) return 1;
  const v = axis === 'x' ? dims.x : dims.y;
  if (Number.isFinite(v) && v > 1e-6) return v;
  const sorted = [dims.x, dims.y, dims.z].sort((a, b) => a - b);
  const median = sorted[1];
  return Number.isFinite(median) && median > 1e-6 ? median : 1;
}

export const scrollVelocityStretchPrimitive: PrimitiveDefinition = {
  name: 'scroll-velocity-stretch',
  label: 'Scroll Velocity Stretch',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll speed pulls the card like taffy along its travel — stretching long mid-fling, relaxing square as the page settles.',
  create: defineAnimatable(
    { name: 'scroll-velocity-stretch', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      // Snapshot the full base pose; dispose restores it exactly.
      const basePos = subject.position.clone();
      const baseScale = subject.scale.clone();

      // Subject-relative travel unit, lazily re-measured while degenerate
      // (mounted artifacts may stream geometry in after attach).
      let dims = measureLocalDims(subject, baseScale);

      // Velocity-proxy + impulse-envelope state, persisted on the closure.
      let prevScroll: number | null = null;
      let prevT: number | null = null;
      let impulse = 0; // decaying |velocity| envelope, 0..VELNORM_CAP
      let lastScroll = 0; // last applied scroll position (for onParamChange)
      let hasSeeked = false;

      // The scroll-signal convention (scroll-skew): finite-guarded
      // target.userData.scroll, rest pose when absent.
      const readScroll = (): number => {
        const s = (target.userData as { scroll?: unknown }).scroll;
        return typeof s === 'number' && Number.isFinite(s) ? clamp(s, 0, 1) : 0;
      };

      const resolveDamping = (): number =>
        clamp(num(params.settleDamping, DAMP_REF), 0.05, 20);

      /** Write the pose from the stored state (lastScroll + impulse) and the
       *  LIVE params — called by every seek and by onParamChange, so a frozen
       *  frame reshapes under control sweeps. */
      const apply = (): void => {
        if (!dims) dims = measureLocalDims(subject, baseScale);
        const axis = str(params.axis, 'vertical') === 'horizontal' ? 'x' : 'y';
        const size = axisSize(dims, axis);

        // Always-alive base: eased subject-relative travel, centered on the
        // base pose (start −0.5·span at scroll 0, end +0.5·span at scroll 1).
        const eased = Math.pow(lastScroll, TRAVEL_BIAS);
        const offset = (eased - 0.5) * num(params.travel, 0.85) * size;

        // Taffy stiffness: stiffer (higher damping) settles faster AND holds
        // less sustained deformation — one physical knob, two honest effects.
        const dampAmp = clamp(
          Math.pow(DAMP_REF / resolveDamping(), DAMP_AMP_POW),
          DAMP_AMP_MIN,
          DAMP_AMP_MAX,
        );
        // Flight window: deformation belongs to mid-flight. 1 at the engaged
        // scroll=0.5 mid-state (the advocate's pinned frame stays fully
        // stretched), 0 at both travel ends — the card always ARRIVES square,
        // so end-of-travel frames stay inside the tile frame even under a
        // faster-than-rig fling.
        const flight = Math.sin(Math.PI * lastScroll);
        const sAlong = clamp(
          1 + num(params.stretchGain, 0.6) * impulse * dampAmp * flight,
          1,
          S_ALONG_MAX,
        );
        // Exact volume preservation: sAlong · sPerp² = 1.
        const sPerp = 1 / Math.sqrt(sAlong);

        subject.position.set(
          basePos.x + (axis === 'x' ? offset : 0),
          basePos.y + (axis === 'y' ? offset : 0),
          basePos.z,
        );
        subject.scale.set(
          baseScale.x * (axis === 'x' ? sAlong : sPerp),
          baseScale.y * (axis === 'y' ? sAlong : sPerp),
          baseScale.z * sPerp,
        );
      };

      return {
        // Purely stateful: driven by the scroll signal, no fixed timeline.
        duration: () => Infinity,
        seek: (t) => {
          const scroll = readScroll();
          if (prevT === null) {
            // First frame, no history: infer the fling from position.
            // 2·√(s(1−s)) is the rig's cosine-stimulus |velocity| as a
            // function of scroll position — 1 at the engaged mid-state, 0 at
            // both rests. A cold pin at scroll=0.5 lands fully stretched; the
            // idle scroll=0 frame lands square and legible.
            impulse = 2 * Math.sqrt(Math.max(scroll * (1 - scroll), 0));
            prevT = t;
            prevScroll = scroll;
          } else {
            const rawDt = t - prevT;
            if (rawDt > 1e-6) {
              // Real time step: dt-normalized velocity proxy + envelope decay.
              const dt = clamp(rawDt, DT_MIN, DT_MAX);
              const velNorm = clamp(
                Math.abs(scroll - (prevScroll ?? scroll)) / dt / VEL_REF,
                0,
                VELNORM_CAP,
              );
              impulse = Math.max(velNorm, impulse * Math.exp(-resolveDamping() * dt));
              prevT = t;
              prevScroll = scroll;
            } else if (rawDt < -1e-6) {
              // Rewind / loop wrap: re-anchor without a velocity spike; the
              // envelope carries over and keeps decaying on the next step.
              prevT = t;
              prevScroll = scroll;
            }
            // rawDt ≈ 0: a pinned frame re-rendered — re-apply, never decay,
            // so the advocate's repeated same-t seeks stay engaged.
          }
          lastScroll = scroll;
          hasSeeked = true;
          apply();
        },
        // Re-apply the pose at the last seek state so every control visibly
        // reshapes a frozen frame (gain/travel/axis/damping all flow through
        // apply()'s live param reads).
        onParamChange: () => {
          if (hasSeeked) apply();
        },
        dispose: () => {
          subject.position.copy(basePos);
          subject.scale.copy(baseScale);
        },
      };
    },
  ),
};
