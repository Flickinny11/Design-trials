// scroll-orbit-scrub — scrolling flies the camera around the card. The rig
// camera is fixed, so the §6 scroll-scrubbed camera move (Lenis/Locomotive
// progress → camera position) is implemented SUBJECT-SIDE as the exact inverse:
// the camera orbiting an anchor point `d` behind the subject by angle θ is the
// world (here: the subject) transformed by the inverse rotation about that
// anchor —
//
//   yaw        = base − θ
//   position.x = base − d·sin(θ)        (the shallow horizontal arc)
//   position.z = base − d·(1 − cos(θ))  (the z bow: near→far→near parallax)
//
// plus a gentle banked counter-tilt (roll = −tilt·sin(θ)) that peaks at the
// side-on moments, like an orbit dolly keeping its horizon. scroll (0..1)
// scrubs θ linearly through orbitDegrees, so both directions scrub smoothly
// and a paused frame is a stable pose. Pure scroll-POSITION response — no
// velocity term — so the advocate's paused control sweeps at scroll=0.5 stay
// fully engaged and every control reshapes that mid-pose directly.
//
// LEGIBLE AT REST: θ(0) = 0 — scroll=0 is exactly the front-facing rest pose
// (pages boot here; the idle frame is the subject untouched). No sampled frame
// is empty: even at the side-on θ=90° instant the card presents its rounded
// 0.14-deep slab + proud chrome, displaced along the arc and banked.
//
// SUBJECT-RELATIVE + Z DISCIPLINE (scroll-depth-dolly P0 lesson): the arc
// radius `d` is arcDepth × the subject's measured MEDIAN bbox dimension
// (Box3.setFromObject — never hardcoded world units), and the z bow is capped
// at BOW_CAP×size so the subject can never park deep behind a hub backdrop
// (unclamped, a 360° orbit at max depth would recede 2d = 1.6×size).
//
// DISTINCT from scroll-rotate-3d: that one tilts IN PLACE (rotation only, tiny
// symmetric z pulse, zero x translation) — this one composes a true orbital
// TRANSLATION (horizontal arc + bounded z bow about an anchor behind the
// subject) with the yaw, plus the banked counter-tilt: the card travels
// through the frame while turning, it doesn't just spin.
// DISTINCT from scroll-flip: that is a single eased 180° flip that locks flat
// at the band end (with a foreshorten dip) — this is a continuous, linear,
// configurable 90–360° fly-around with arc translation and no flat lock.
//
// CPU transform primitive (medium / scroll). No materials, no geometry, no
// shaders — the subject's own look is untouched. Handles Mesh and Group
// subjects identically (Object3D transforms only). dispose() restores every
// channel it wrote (rotation.y/.z, position.x/.z) to the pre-create pose.

import { Box3, Vector3, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, bool, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'orbitDeg', label: 'Orbit Degrees', type: 'knob', min: 90, max: 360, step: 5, default: 160, unit: 'deg' },
  // Arc radius in multiples of the subject's measured size — never world units.
  { id: 'arcDepth', label: 'Arc Depth', type: 'fader', min: 0, max: 0.8, step: 0.02, default: 0.35, unit: '×size' },
  { id: 'counterTiltDeg', label: 'Counter-Tilt', type: 'knob', min: 0, max: 15, step: 0.5, default: 6, unit: 'deg' },
  { id: 'reverse', label: 'Reverse Orbit', type: 'toggle', default: false },
] as const;

const DEG2RAD = Math.PI / 180;
// Z-bow envelope cap (×size). The bow's analytic max is 2·arcDepth×size (at
// θ=180°); capping total recession keeps the subject in front of hub backdrop
// layers in-context (the scroll-depth-dolly ORRERY killer: a subject parked at
// z −12 behind the backdrop is invisible despite nonzero opacity). At default
// params (0.35 → max 0.7×size) the cap never engages; it only bounds the
// extremes of the control range.
const BOW_CAP = 1.2;

/** Read the scroll driver the host supplies; fall back to a CPU phase sweep so
 *  a bare time driver still scrubs the full orbit. */
function scrollOf(userData: Record<string, unknown>, t: number): number {
  const s = userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return phase(t % 4, 4);
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
    'Scrolling flies the camera around the card — it swings through a shallow orbital arc, showing its sides as the page moves.',
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

        const orbit = num(params.orbitDeg, 160) * DEG2RAD;
        const dir = bool(params.reverse, false) ? -1 : 1;
        // Linear scrub: θ sweeps 0 → ±orbit as the page moves. θ(0)=0 keeps
        // the rest pose dead-on front (the idle frame is fully legible).
        const theta = dir * orbit * scroll;
        const d = Math.max(num(params.arcDepth, 0.35), 0) * span;

        // Subject-side camera orbit about an anchor d behind the card (header
        // derivation): yaw counter-rotates while the card traces the arc.
        subject.rotation.y = baseRotY - theta;
        subject.position.x = baseX - d * Math.sin(theta);

        // Z bow (near-far parallax), capped subject-relative — never park the
        // card deep behind a backdrop (see BOW_CAP note above).
        const bow = -d * (1 - Math.cos(theta));
        subject.position.z = baseZ + Math.max(bow, -BOW_CAP * span);

        // Banked counter-tilt: a gentle roll opposing the sweep, peaking at
        // the side-on moments — the orbit-dolly horizon hold.
        const tilt = num(params.counterTiltDeg, 6) * DEG2RAD;
        subject.rotation.z = baseRotZ - tilt * Math.sin(theta);
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
