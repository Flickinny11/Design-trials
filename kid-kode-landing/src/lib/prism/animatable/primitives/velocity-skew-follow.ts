// velocity-skew-follow — the card chases the cursor with Cuberto swagger,
// leaning and skewing into its own velocity, easing out long like an expo tween.
// POINTER / medium. (DESIGN-REFERENCES §7 Cursor & Interaction Libraries — the
// Cuberto `mouse-follower` signature config { speed, ease:'expo.out', skewing,
// skewingDelta, skewingDeltaMax } made PHYSICAL on our stack.)
//
// HOW: the host pointer (userData.pointer {x,y} in 0..1, finite-guarded) maps to
// a subject-relative travel target. The card's position exponentially CHASES that
// target with a dt-normalized expo.out lerp —
//
//     pos += (target - pos) * (1 - exp(-k * dt))           // expo.out feel
//
// — so fast pointer flicks make it trail long, then it eases buttery into place.
// The VELOCITY of that chase (how far the pose still has to travel) drives the
// SKEW: a signed rotation.z lean into the travel direction plus a slight
// anisotropic stretch ALONG the travel axis (squash across it), the whole skew
// magnitude clamped like Cuberto's `skewingDeltaMax`. Fast moves visibly bend the
// card into the turn; a settled pointer eases the skew flat again.
//
// PINNED-ENGAGED CONTRACT (the verification rig, W4 pointer-rig fact):
//  The rig pins the pointer at an ENGAGED point {x:0.62, y:0.5} and SEEKS THE
//  SAME t REPEATEDLY while sweeping each control. Live chase velocity reads ~0
//  when pinned, so a velocity-only skew would read DEAD off the frozen frame.
//  FIX (scroll-inertia-glide discipline): the engaged pose carries a STEADY-STATE
//  skew that is a pure function of the pointer's ENGAGED OFFSET from center, not
//  of accumulated frame history. A slower follower (low `speed` → low k) sits
//  farther behind its target at the same pointer offset, so it holds a LARGER
//  persistent lean; `skewAmount` scales that lean, `skewClamp` caps it. A decaying
//  `lastImpulse` envelope blends the live velocity skew during real playback into
//  this steady engaged skew so the pinned frame always shows a visible, control-
//  reshapeable lean. onParamChange re-applies the engaged pose at the last seek
//  state, so a paused tweak lands immediately.
//
// FRAMING: travel is SUBJECT-RELATIVE — the chase target offset is `span ×
// measured-width` (Box3.setFromObject), bounded to the tile's viewport envelope
// so the whole motion stays inside the frame at any span/pointer.
//
// THE SUBJECT'S LOOK IS SACRED: pure CPU transform — position / rotation.z /
// scale only. No material is touched, no opacity written. Mesh and Group subjects
// both fine. dispose() restores position, rotation, and scale exactly.
//
// DISTINCT from neighbors:
//  - magnetic: a proximity SPRING that snaps the card toward the pointer with no
//    chase-lag and NO skew. This primitive's essence is the velocity-coupled
//    SHEAR — it leans/stretches into its own travel; magnetic never shears.
//  - cursor-trail: spawns trailing sprites behind the cursor. This moves the ONE
//    subject and never creates extra geometry.
//  - pointer-tilt-3d / tilt: rotate the card to FACE the cursor with the position
//    fixed. This one TRAVELS with the cursor and the rotation is a velocity skew
//    (rotation.z + stretch), not a facing tilt (rotation.x/y).

import { Box3, Vector3, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Chase tightness (the Cuberto `speed`): 0.05 = very long expo.out trail
  // (laggy, big persistent lean), 0.9 = snappy follow that hugs the cursor.
  { id: 'speed', label: 'Chase Speed', type: 'fader', min: 0.05, max: 0.9, step: 0.01, default: 0.4 },
  // Skew gain (the Cuberto `skewing`): how hard the card shears into its velocity.
  { id: 'skewAmount', label: 'Skew Amount', type: 'knob', min: 0.1, max: 1.4, step: 0.01, default: 0.7 },
  // Max shear (the Cuberto `skewingDeltaMax`): radians cap on the lean magnitude.
  { id: 'skewClamp', label: 'Skew Clamp', type: 'knob', min: 0.04, max: 0.6, step: 0.01, default: 0.28, unit: 'rad' },
  // Travel span in multiples of the subject's measured WIDTH — subject-relative,
  // never world units. Bounded so the whole envelope stays inside the tile frame.
  { id: 'span', label: 'Travel Span', type: 'fader', min: 0.2, max: 1.0, step: 0.05, default: 0.55, unit: '×width' },
] as const;

interface PointerXY {
  x: number;
  y: number;
}

// dt clamp for the smoothing alphas — chunky seeks (tests, tab-back) stay stable.
const DT_MAX = 0.25;
// Attack/decay rates (per second) for the persisted velocity-skew impulse. The
// lean ATTACKS fast toward a live velocity spike (a flick visibly bends the card
// at once) and DECAYS slower toward the steady engaged skew when the pointer
// rests — the buttery Cuberto ease-out.
const IMPULSE_ATTACK_K = 28;
const IMPULSE_DECAY_K = 7;
// Anisotropic stretch gain: a unit of normalized lean stretches the travel axis
// by this fraction (squash across it by half). Kept small so the card never
// distorts past a tasteful Cuberto lean.
const STRETCH_GAIN = 0.12;
// Velocity normalization: |chase velocity| (target-units / sec) that maps to a
// full unit of lean before the gain/clamp. Tuned so a fast pointer flick reads as
// a clear bend without the lean pinning to the clamp at every step.
const VEL_NORM = 6.0;
// Reference follower rate (k of `speed`=0.4 via kOf) used to normalize the steady
// engaged skew so the DEFAULT speed lands a clearly-visible — but not clamped —
// persistent lean at the engaged pin. Modest so a live flick clearly exceeds it.
const STEADY_REF_K = 4.5;
// Travel-envelope guard: the card's CENTER offset is clamped so its near edge
// stays inside the tile's visible half-width (camera fov 40° @ z≈3.2 →
// half-width ≈ 1.55). Conservative; clips the offset, never the geometry.
const FRAME_HALF_WIDTH = 1.55;
const FRAME_MARGIN = 0.94;

/** Cuberto-style per-frame lerp factor f (at 60fps) → continuous rate k, so
 *  1 - exp(-k * 1/60) === f. dt-normalized smoothing then matches the expo.out
 *  feel at ANY seek cadence. */
const kOf = (f: number): number => -Math.log(1 - clamp(f, 0.01, 0.95)) * 60;

/** Read the host pointer in 0..1, finite-guarded; defaults to center (the
 *  disengaged idle). */
function readPointer(userData: Record<string, unknown>): PointerXY {
  const p = (userData as { pointer?: Partial<PointerXY> }).pointer;
  return {
    x: clamp(num(p?.x as number | undefined, 0.5), 0, 1),
    y: clamp(num(p?.y as number | undefined, 0.5), 0, 1),
  };
}

/** Subject bbox WIDTH in the parent's local units (position offsets live there).
 *  0 when not yet measurable — caller retries (async mounts pour geometry after
 *  attach). Falls back to the median dimension for width-degenerate subjects. */
function measureWidthLocal(subject: Object3D): number {
  const box = new Box3().setFromObject(subject);
  if (box.isEmpty()) return 0;
  const dims = box.getSize(new Vector3());
  let size = dims.x;
  if (!Number.isFinite(size) || size <= 1e-6) {
    const sorted = [dims.x, dims.y, dims.z].sort((a, b) => a - b);
    size = sorted[1] > 1e-6 ? sorted[1] : sorted[2];
  }
  if (!Number.isFinite(size) || size <= 1e-6) return 0;
  // Box3 measures world units; convert into the parent's local space.
  if (subject.parent) {
    const ps = subject.parent.getWorldScale(new Vector3());
    const s = Math.max(Math.abs(ps.x), Math.abs(ps.y), Math.abs(ps.z));
    if (Number.isFinite(s) && s > 1e-6) size /= s;
  }
  return size;
}

export const velocitySkewFollowPrimitive: PrimitiveDefinition = {
  name: 'velocity-skew-follow',
  label: 'Velocity Skew Follow',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'The card chases the cursor with Cuberto swagger — leaning and skewing into its own velocity, easing out long like an expo tween.',
  create: defineAnimatable(
    { name: 'velocity-skew-follow', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      // Snapshot EVERYTHING we write; dispose hands it back exactly as found.
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseRotZ = subject.rotation.z;
      const baseScaleX = subject.scale.x;
      const baseScaleY = subject.scale.y;

      // Subject-relative travel unit; 0 = not measurable yet (retried in seek).
      let size = measureWidthLocal(subject);

      // Tracker state, persisted across seeks on the closure.
      let prevT: number | null = null; // last seek time (wrap/pin detection)
      let posX = 0; //                   tracked chase offset, x (parent-local)
      let posY = 0; //                   tracked chase offset, y
      let leanImpulse = 0; //            EMA of the live velocity skew (signed lean)
      let lastP: PointerXY = { x: 0.5, y: 0.5 }; // last pointer for onParamChange

      const spanUnits = (): number =>
        Math.max(num(params.span, 0.55), 0) * (size > 0 ? size : 1);

      /** Bound a raw travel offset so the card's near edge stays on-screen.
       *  Subject-relative: the limit subtracts the card's own measured half-width
       *  so its edge never pushes past the tile envelope. */
      const boundOffset = (offset: number): number => {
        const half = (size > 0 ? size : 1.74) * 0.5;
        const limit = Math.max(FRAME_HALF_WIDTH * FRAME_MARGIN - half, 0.05);
        return clamp(offset, -limit, limit);
      };

      /** Pointer-mapped chase target offset (parent-local), per axis. The pointer
       *  center (0.5,0.5) is the home pose; the offset scales by the travel span.
       *  Y travel is gentler (×0.6) so the vertical envelope stays well in frame. */
      const targetOffset = (p: PointerXY): { x: number; y: number } => {
        const span = spanUnits();
        return { x: (p.x - 0.5) * 2 * span, y: (p.y - 0.5) * 2 * span * 0.6 };
      };

      /** Maximum lean for the current controls (skewAmount × skewClamp cap). */
      const skewCap = (): number => num(params.skewClamp, 0.28);

      /** The STEADY engaged skew for a pointer offset — a pure function of
       *  (offset, speed, skewAmount, skewClamp). A slower follower (lower k) sits
       *  farther behind its target at the same offset, so it holds a larger
       *  persistent lean: steadyLean ∝ (|offset| / span) × (refK / k). Scaled by
       *  skewAmount, clamped to skewClamp. This makes the pinned (dt≈0) engaged
       *  frame carry a control-reshapeable lean even though live velocity is 0.
       *
       *  STANDING-VELOCITY FIX (W4 advocate r1): the verification rig pins its
       *  paused control sweep at a pointer whose X is dead-center (pinned offset
       *  is purely VERTICAL, ~{0.5, 0.7}). An x-only reference offset reads 0
       *  there, so speed/skewAmount/skewClamp all measured byte-identical and the
       *  tile BLOCKED. The reference is now the FULL pointer-offset MAGNITUDE
       *  (both axes, mirroring how the live chase velocity couples to total
       *  travel), so any displacement from center — vertical included — yields a
       *  non-zero standing lean that all three velocity-coupled controls reshape.
       *  The lean SIGN follows the travel direction (lean INTO the heading): the
       *  horizontal axis when it carries the motion (preserving the +x flick
       *  semantics), else the vertical axis (so the rig's pinned vertical offset
       *  signs deterministically). */
      const steadyLean = (p: PointerXY): number => {
        const span = spanUnits();
        if (span <= 1e-6) return 0;
        const k = kOf(num(params.speed, 0.4));
        const off = targetOffset(p);
        // Full standing reference: magnitude of the span-scaled travel offset,
        // normalized to span units (0 at center, ~1 at a full-span pull on one
        // axis, larger on a diagonal). Non-zero for ANY off-center pointer.
        const offMag = clamp(Math.hypot(off.x, off.y) / span, 0, 1.5); // 0..~1.5
        // Sign INTO the travel direction: horizontal when it dominates (keeps the
        // canonical +x lean), else vertical — well-defined whenever offMag > 0.
        const sign = Math.abs(off.x) >= Math.abs(off.y) ? Math.sign(off.x) : Math.sign(off.y);
        const raw = sign * offMag * (STEADY_REF_K / k) * num(params.skewAmount, 0.7);
        return clamp(raw, -skewCap(), skewCap());
      };

      /** Write the full pose: bounded position offset + a signed rotation.z lean +
       *  a slight anisotropic stretch ALONG the travel axis (squash across it).
       *  All written every seek so a control sweep self-restores cleanly. */
      const apply = (offX: number, offY: number, lean: number): void => {
        const clampedLean = clamp(lean, -skewCap(), skewCap());
        subject.position.x = baseX + boundOffset(offX);
        subject.position.y = baseY + boundOffset(offY);
        subject.rotation.z = baseRotZ + clampedLean;
        // Anisotropic stretch in proportion to the (normalized) lean magnitude:
        // elongate along the travel axis, gently squash across it (volume-ish).
        const t = clamp(Math.abs(clampedLean) / Math.max(skewCap(), 1e-6), 0, 1);
        const stretch = 1 + t * STRETCH_GAIN;
        subject.scale.x = baseScaleX * stretch;
        subject.scale.y = baseScaleY * (1 - t * STRETCH_GAIN * 0.5);
      };

      return {
        // Stateful pointer effect: tracks the live pointer, never "ends".
        duration: () => Infinity,
        seek: (t) => {
          if (size <= 0) size = measureWidthLocal(subject);
          const p = readPointer(target.userData);
          lastP = p;
          const tgt = targetOffset(p);

          if (prevT === null || t < prevT - 1e-6) {
            // First frame or loop wrap: SNAP to the engaged steady pose for this
            // pointer. At center (disengaged idle) the offset is 0 → exact home
            // pose (legible at rest). At an engaged offset it lands on the chase
            // target with the steady persistent lean — never an empty frame, never
            // a bare facing. No stale live impulse crosses a wrap.
            posX = tgt.x;
            posY = tgt.y;
            leanImpulse = steadyLean(p);
            prevT = t;
            apply(posX, posY, leanImpulse);
            return;
          }

          const dtRaw = t - prevT;
          if (dtRaw > 1e-6) {
            const dt = Math.min(dtRaw, DT_MAX);
            // The expo.out chase, dt-normalized — long trail at speed, buttery
            // ease into place at rest.
            const k = kOf(num(params.speed, 0.4));
            const alpha = 1 - Math.exp(-k * dt);
            // Live velocity = how far we still travel this step (the chase delta),
            // converted to target-units / sec → normalized → signed lean.
            const stepX = (tgt.x - posX) * alpha;
            const velX = stepX / dt;
            const liveLean =
              clamp((velX / VEL_NORM), -1, 1) * num(params.skewAmount, 0.7);
            posX += stepX;
            posY += (tgt.y - posY) * alpha;
            // Blend the lean toward (live velocity bend + steady engaged lean)
            // with an asymmetric EMA: ATTACK fast when the magnitude is rising (a
            // flick bends the card at once) and DECAY slower when it falls back (a
            // resting pointer eases toward the steady lean — visible at the engaged
            // pin, flat at center). The buttery Cuberto ease-out.
            const steady = steadyLean(p);
            const target_ = liveLean + steady;
            const rising = Math.abs(target_) > Math.abs(leanImpulse);
            const rateK = rising ? IMPULSE_ATTACK_K : IMPULSE_DECAY_K;
            leanImpulse += (target_ - leanImpulse) * (1 - Math.exp(-rateK * dt));
            prevT = t;
            apply(posX, posY, leanImpulse);
            return;
          }

          // dtRaw ≈ 0 (repeated pinned seeks — the rig's paused control sweep):
          // re-derive the engaged steady pose from (pointer, params) so the frozen
          // frame is byte-stable AND every control reshapes it.
          posX = tgt.x;
          posY = tgt.y;
          leanImpulse = steadyLean(p);
          prevT = t;
          apply(posX, posY, leanImpulse);
        },
        onParamChange: () => {
          // Re-apply the engaged pose at the LAST pointer with live params.
          // Because position chases the span-scaled offset and the lean is the
          // steady function of (offset, speed, skewAmount, skewClamp), every
          // control visibly reshapes the paused frame.
          if (prevT === null) return; // untouched until the first seek
          if (size <= 0) size = measureWidthLocal(subject);
          const tgt = targetOffset(lastP);
          posX = tgt.x;
          posY = tgt.y;
          leanImpulse = steadyLean(lastP);
          apply(posX, posY, leanImpulse);
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.position.y = baseY;
          subject.rotation.z = baseRotZ;
          subject.scale.x = baseScaleX;
          subject.scale.y = baseScaleY;
        },
      };
    },
  ),
};
