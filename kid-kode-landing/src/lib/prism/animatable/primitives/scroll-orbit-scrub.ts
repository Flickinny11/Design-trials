// scroll-orbit-scrub — scrolling flies the camera around the card. The §6
// scroll-scrubbed 3D camera move (Lenis/Locomotive progress → camera position)
// is implemented SUBJECT-SIDE: the rig camera is fixed, so the card's POSITION
// traces the orbital arc the camera would sweep, while the card stays turned
// toward the lens — a true camera fly-around keeps its target FRAMED, so the
// front chrome (header bar, accent dot, content rows) reads the whole way.
//
//   theta      = ±orbit · scroll        (the camera's sweep angle, scrubbed)
//   position.x = base − d·sin(theta)     (the horizontal arc travel)
//   position.z = base − d·(1 − cos(θ))   (the z bow: near→far→near parallax)
//   yaw        = base − YAW_CAP·tanh(θ/YAW_CAP)   (BOUNDED facing parallax)
//   roll       = base − tilt·sin(θ)      (the banked orbit-dolly horizon hold)
//
// BLANK-FACE FIX (advocate must-fix MF0+MF1, 2026-06-12): the prior build let
// the yaw track θ unbounded, so at the default 160° orbit's pinned scroll=0.5
// (θ=80°) — and at every high-orbitDeg payoff — the RoundedBox swung past
// edge-on and presented its featureless dark BACK face (the forbidden blank
// slab; the art-fidelity lum-0.043 flag was this). The yaw is now a SATURATING
// fraction of θ: yaw = YAW_CAP·tanh(θ/YAW_CAP) — natural (≈θ) for small sweeps,
// hard-capped at ±YAW_CAP (52°, comfortably short of the 90° blank-out) for any
// θ. So the card shows its DEPTH (the 0.14-deep slab side, the proud chrome in
// three-quarter view) without the front ever rotating away. No sampled frame —
// idle, any play phase, or any control payoff — can show a blank back face,
// because the front simply never turns past three-quarters. The arc TRANSLATION
// and the z bow carry the "flew around it" travel that the capped yaw no longer
// over-rotates; orbitDeg still scrubs the full sweep magnitude (wider arc,
// deeper bow, more facing parallax up to the cap), so its payoff lands on a
// LEGIBLE wide-swung card, not a blank rectangle.
//
// CONTROL-AT-ENGAGED-STATE (advocate must-fix MF2, the catalog rig pins each
// control at scroll=0.5 with repeated same-t seeks): every control reshapes the
// STEADY pinned pose, never a transient —
//   orbitDeg       — θ at the pinned frame ⇒ arc x, z bow, AND capped yaw all
//                    grow together: a visibly wider, deeper, more-turned card;
//   arcDepth       — the arc radius d ⇒ how far the card travels along the
//                    sweep and how deep it bows (0 = pure in-place turn);
//   counterTiltDeg — the banked roll, a steady tilt·sin(θ) of the now-LEGIBLE
//                    card (was imperceptible only because it rolled a blank
//                    edge-on slab; on a framed three-quarter card it reads
//                    plainly). Boosted range so even a modest bank is obvious.
//   reverse        — mirrors the whole pose to the opposite side.
// The pose is a pure function of (scroll, params) — no velocity term — so the
// advocate's paused control sweeps at the pinned frame stay fully engaged and
// repeated same-t seeks are idempotent. onParamChange re-applies the pose at
// the last seek state so a tweak on a PAUSED frame lands immediately.
//
// LEGIBLE AT REST: θ(0) = 0 — scroll=0 is exactly the front-facing rest pose
// (pages boot here; the idle frame is the subject untouched).
//
// SUBJECT-RELATIVE + Z DISCIPLINE (scroll-depth-dolly P0 lesson): the arc
// radius d is arcDepth × the subject's measured MEDIAN bbox dimension
// (Box3.setFromObject — never hardcoded world units), and the z bow is capped
// at BOW_CAP×size so the subject can never park deep behind a hub backdrop.
//
// DISTINCT from scroll-rotate-3d: that one tilts IN PLACE (rotation only, no
// translation). This composes a true orbital TRANSLATION (arc + bounded z bow)
// with a BOUNDED facing turn and a banked roll — the card travels through the
// frame as the camera flies around it, staying legible, it doesn't spin away.
// DISTINCT from scroll-flip: that is a single eased 180° flip that locks flat;
// this is a continuous, linear, configurable fly-around that NEVER turns the
// card past three-quarters.
//
// CPU transform primitive (medium / scroll). No materials, no geometry, no
// shaders — the subject's own look is untouched, and the bounded yaw means the
// existing single-sided card never needs a designed back face. Handles Mesh and
// Group subjects identically (Object3D transforms only). dispose() restores
// every channel it wrote (rotation.y/.z, position.x/.z) to the pre-create pose.

import { Box3, Vector3, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, bool, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'orbitDeg', label: 'Orbit Degrees', type: 'knob', min: 90, max: 360, step: 5, default: 200, unit: 'deg' },
  // Arc radius in multiples of the subject's measured size — never world units.
  { id: 'arcDepth', label: 'Arc Depth', type: 'fader', min: 0, max: 0.8, step: 0.02, default: 0.4, unit: '×size' },
  { id: 'counterTiltDeg', label: 'Counter-Tilt', type: 'knob', min: 0, max: 28, step: 0.5, default: 12, unit: 'deg' },
  { id: 'reverse', label: 'Reverse Orbit', type: 'toggle', default: false },
] as const;

const DEG2RAD = Math.PI / 180;
// Facing-yaw saturation cap (radians ≈ 52°). The card's front turns toward the
// arc as the camera flies around, but tanh saturates the yaw here — short of
// the 90° edge-on blank-out — so no orbit angle ever shows the card's back
// (advocate must-fix MF0+MF1). 52° leaves a clear three-quarter view of the
// front chrome at the widest sweep.
const YAW_CAP = 52 * DEG2RAD;
// Banked-roll saturation reference (radians). The roll is a STEADY lean that
// grows with how far around the orbit the camera has flown — roll = −tilt ·
// tanh(θ/ROLL_REF). Using a saturating function of θ (not sin θ) makes the bank
// monotonic in |θ| with NO interior zero: the prior sin θ roll vanished at the
// degenerate θ=180° the rig lands on when a control sweep leaves orbitDeg at its
// 360° max, so the Counter-Tilt control read as dead (advocate must-fix MF2).
// tanh keeps the lean ≈θ for shallow sweeps and saturates near ±tilt for wide
// ones, so a paused tilt tweak reshapes the engaged frame at EVERY orbit angle.
const ROLL_REF = 90 * DEG2RAD;
// Z-bow envelope cap (×size). The bow's analytic max is 2·arcDepth×size (at
// θ=180°); capping total recession keeps the subject in front of hub backdrop
// layers in-context (the scroll-depth-dolly ORRERY killer). At default params
// (0.4 → max 0.8×size) the cap only bounds the extremes of the control range.
const BOW_CAP = 1.2;

/** Read the scroll driver the host supplies; fall back to a CPU phase sweep so
 *  a bare time driver still scrubs the full orbit. */
function scrollOf(userData: Record<string, unknown>, t: number): number {
  const s = userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return phase(t % 4, 4);
}

/** Bounded facing parallax: ≈θ for small sweeps (natural turn), saturating at
 *  ±YAW_CAP so the front never crosses edge-on regardless of orbit angle. */
function cappedYaw(theta: number): number {
  return YAW_CAP * Math.tanh(theta / YAW_CAP);
}

/** Measure the subject's size in its PARENT's units (position lives there).
 *  MEDIAN bbox dimension (scroll-depth-dolly P0 lesson 2026-06-12: max-dim
 *  over-travels wide-flat headlines; min-dim is a flat subject's near-zero
 *  thickness). Returns 0 when the bbox is empty/degenerate — the caller
 *  retries each seek (mounted artifacts stream geometry in after attach). */
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

export const scrollOrbitScrubPrimitive: PrimitiveDefinition = {
  name: 'scroll-orbit-scrub',
  label: 'Scroll Orbit Scrub',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scrolling flies the camera around the card — it sweeps through an orbital arc, showing its depth in three-quarter view as the page moves while staying turned toward the lens.',
  create: defineAnimatable(
    { name: 'scroll-orbit-scrub', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      // Snapshot every channel we write; dispose hands the pose back exactly.
      const baseRotY = subject.rotation.y;
      const baseRotZ = subject.rotation.z;
      const baseX = subject.position.x;
      const baseZ = subject.position.z;

      // Subject-relative travel unit; 0 = not measurable yet (retried in apply
      // — async mounts pour geometry after attach).
      let size = measureLocalSize(subject);
      // Last seek time, so onParamChange re-applies the pose at the exact
      // state the (possibly paused) driver pinned.
      let lastT = 0;

      const apply = (scroll: number) => {
        if (size <= 0) size = measureLocalSize(subject);
        const span = size > 0 ? size : 1;

        const orbit = num(params.orbitDeg, 200) * DEG2RAD;
        const dir = bool(params.reverse, false) ? -1 : 1;
        // Linear scrub: θ sweeps 0 → ±orbit as the page moves. θ(0)=0 keeps
        // the rest pose dead-on front (the idle frame is fully legible).
        const theta = dir * orbit * scroll;
        const d = Math.max(num(params.arcDepth, 0.4), 0) * span;

        // BOUNDED facing parallax (blank-face fix): the card turns toward the
        // arc but the yaw saturates short of edge-on, so the front chrome stays
        // legible at every sweep — the back face is never presented.
        subject.rotation.y = baseRotY - cappedYaw(theta);

        // Horizontal arc travel — the camera-move parallax that now carries the
        // "flew around it" feel the capped yaw no longer over-rotates.
        subject.position.x = baseX - d * Math.sin(theta);

        // Z bow (near-far parallax), capped subject-relative — never park the
        // card deep behind a backdrop (see BOW_CAP note above).
        const bow = -d * (1 - Math.cos(theta));
        subject.position.z = baseZ + Math.max(bow, -BOW_CAP * span);

        // Banked counter-tilt: a STEADY lean into the orbit, growing with how
        // far around the camera has flown and saturating near ±tilt — the
        // orbit-dolly horizon hold. tanh(θ/ROLL_REF) (not sin θ) has no interior
        // zero, so the bank reshapes the engaged frame at EVERY orbit angle,
        // including the θ=180° the rig pins when a prior sweep left orbitDeg at
        // 360° (advocate must-fix MF2). Banks a LEGIBLE three-quarter card now,
        // so the lean reads plainly instead of rolling a blank edge-on slab.
        const tilt = num(params.counterTiltDeg, 12) * DEG2RAD;
        subject.rotation.z = baseRotZ - tilt * Math.tanh(theta / ROLL_REF);
      };

      return {
        // Purely stateful: scroll-driven scrub, no fixed timeline.
        duration: () => Infinity,
        seek: (t) => {
          lastT = t;
          apply(scrollOf(target.userData, t));
        },
        onParamChange: () => {
          // Re-apply at the last seek state so paused control sweeps reshape
          // the pinned pose immediately (no wait for the next driver tick).
          apply(scrollOf(target.userData, lastT));
        },
        dispose: () => {
          subject.rotation.y = baseRotY;
          subject.rotation.z = baseRotZ;
          subject.position.x = baseX;
          subject.position.z = baseZ;
        },
      };
    },
  ),
};
