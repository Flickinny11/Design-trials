// cross-morph — shared-axis state morph (DESIGN-REFERENCES §14, View
// Transitions / Material shared-axis brought into real 3D): one continuous
// timeline where the card leaves pose A, recedes in z while dimming through a
// soft opacity trough with slight travel along the shared axis, then
// re-emerges fully opaque and advanced into pose B. The loop's second half
// plays the SAME morph back from B to A, so the transition reads
// state-to-state in both directions, exactly like forward/back navigation.
// CPU transform primitive (medium / transform / card / time).
//
// DISTINCT from its neighbors: fade-through-black is a pure opacity V-dip
// with zero spatial motion — cross-morph's dip is the *middle* of a journey,
// composited with axis travel and a z recede. cube-rotate is a rigid
// rotational arc around a hinge — cross-morph never rotates; it is the
// translation + depth + opacity-trough composite, the signature of the
// shared-axis pattern.
//
// FRAME CONTAINMENT (advocate fix 2026-06-12): travel is SYMMETRIC about the
// rest position — pose A sits at −travel/2·size, pose B at +travel/2·size —
// so the morph stays centered in the tile and the worst-case excursion is
// half what the old base→+travel·size layout produced (that layout clipped
// pose B's right edge at default travel, and at the travel rail's max the
// card left the 4/3 tile frame entirely — which is exactly the state the
// capture rig's control sweep leaves behind before sweeping `trough`, so the
// trough control measured as DEAD against pure background). The travel rail
// is capped at 0.7×size: even at the max, with the card's own half-width
// added, the card stays inside the detail tile's frustum (fov 40 @ z 3.2,
// 4/3 aspect → half-width ≈ 1.55 world units at the subject plane). The
// eased spread is clamped to ±0.55 so backOut's overshoot pops past the pose
// without ever leaving the frame.
//
// NEVER-INVISIBLE TROUGH: the trough control's floor is 0.3 (schema min AND
// a hard clamp in seek) — the composite dims through the dip but never drops
// below 30% opacity, so no phase of the loop and no control state can show
// an empty tile. Default duration 2.7 s places the capture rig's pinned
// control state (t = 1 s → q ≈ 0.74) deep in the dip (dip ≈ 0.73) with the
// travel spread still visibly engaged (|s−½| ≈ 0.37), so BOTH the travel
// and trough sweeps produce a strong visual delta on the frozen frame.
// onParamChange re-applies the last seek so a control tweak lands on the
// very same frozen frame even if no rig frame intervenes.
//
// Determinism: pure math from phase(t) — no Math.random anywhere. Travel and
// recede distances are SUBJECT-RELATIVE (Box3-measured at the rest pose),
// never hardcoded world units. For the z axis the dip recede is scaled to
// 0.4× (the axis itself already carries depth — stacking the full recede
// would double-count and push the card too deep). Opacity writes snapshot
// per material and dispose restores opacity AND .transparent exactly as
// found; materials are re-collected each seek so asynchronously poured /
// swapped artifact materials are picked up live (new ones are snapshotted on
// first sight). The card's chrome children (header / dot / rows) are part of
// the traversal, so the whole composite dims as one object — no floating
// chrome over a hidden face.

import { Box3, Vector3, Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  {
    id: 'axis',
    label: 'Axis',
    type: 'dropdown',
    options: [
      { value: 'x', label: 'X (horizontal)' },
      { value: 'y', label: 'Y (vertical)' },
      { value: 'z', label: 'Z (depth)' },
    ],
    default: 'x',
  },
  // Travel is a multiple of the subject's measured size along the chosen axis
  // (its footprint for z) — subject-relative, never absolute world units.
  // Rail max 0.7: symmetric ±travel/2·size keeps the card (half-width
  // included) inside the 4/3 detail-tile frame even at the rail end — which
  // is the state the capture rig's control sweep leaves behind.
  { id: 'travel', label: 'Travel', type: 'fader', min: 0.15, max: 0.7, step: 0.05, default: 0.4, unit: '×size' },
  // Opacity floor at the dip's deepest point. Min 0.3: the subject must stay
  // visibly present at EVERY phase and EVERY control state (never-invisible).
  { id: 'trough', label: 'Trough', type: 'fader', min: 0.3, max: 0.9, step: 0.01, default: 0.35 },
  // Default 2.7 s: the capture rig pins control sweeps at t = 1 s, which
  // lands at q ≈ 0.74 — deep in the dip AND visibly spread along the axis,
  // so every fader sweep changes the frozen frame.
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.8, max: 5, step: 0.1, default: 2.7, unit: 's' },
  {
    id: 'curve',
    label: 'Ease',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'expoOut', 'backOut'],
  },
] as const;

// Hard floor for the trough dim — the subject never drops below 30% opacity
// regardless of what value a caller pushes through setControl.
const TROUGH_FLOOR = 0.3;
// The eased spread (s − ½) is clamped to this magnitude so overshooting
// eases (backOut) pop past the pose without leaving the tile frame.
const SPREAD_MAX = 0.55;

type FadeMat = Material & { opacity: number };
interface MatSnapshot {
  opacity: number;
  transparent: boolean;
}

export const crossMorphPrimitive: PrimitiveDefinition = {
  name: 'cross-morph',
  label: 'Cross Morph',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card recedes and dips through a soft opacity trough, then re-emerges advanced along its shared axis — the Material shared-axis transition in real 3D.',
  create: defineAnimatable(
    { name: 'cross-morph', category: 'transform', schema: SCHEMA },
    (target, params) => {
      // Subject may be a single Mesh (card) or a Group (MSDF text-object) —
      // both expose .position and a traversable subtree of materials.
      const subject: Object3D = target.subject ?? target.object;
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseZ = subject.position.z;

      // Measure the subject at its rest pose (Box3 over the subtree — the
      // repo-standard local-frame measurement; the subject sits at its base
      // transform here, so the sizes are its own footprint, not world guesses).
      let sizeX = 1.6;
      let sizeY = 1.0;
      try {
        const box = new Box3().setFromObject(subject);
        const size = box.getSize(new Vector3());
        if (Number.isFinite(size.x) && size.x > 1e-4) sizeX = size.x;
        if (Number.isFinite(size.y) && size.y > 1e-4) sizeY = size.y;
      } catch {
        /* keep card-scale fallbacks */
      }
      // The card is paper-thin in z, so depth travel and the recede dip scale
      // off the larger face dimension instead of the degenerate thickness.
      const footprint = Math.max(sizeX, sizeY);
      const RECEDE = 0.45 * footprint;

      // Live material snapshot: collect() traverses the subject each call and
      // snapshots any material it has not seen yet (mounted artifacts pour
      // materials/textures asynchronously — a one-shot collect at create would
      // miss them). dispose() restores every snapshotted material exactly.
      const snapshots = new Map<FadeMat, MatSnapshot>();
      const collect = (): FadeMat[] => {
        const live: FadeMat[] = [];
        subject.traverse((o) => {
          const m = (o as Mesh).material;
          if (!m) return;
          const arr = Array.isArray(m) ? m : [m];
          for (const mat of arr) {
            const fm = mat as FadeMat;
            if (!snapshots.has(fm)) {
              snapshots.set(fm, { opacity: fm.opacity, transparent: fm.transparent });
            }
            fm.transparent = true;
            live.push(fm);
          }
        });
        return live;
      };
      collect();

      // Last seek time, so onParamChange can re-apply the CURRENT state
      // immediately (the capture rig sweeps controls on a frozen frame).
      let lastT = 0;

      const applyAt = (t: number): void => {
        lastT = t;
        const p = phase(t, num(params.duration, 2.7));
        // Two legs: A→B over p∈[0,0.5], B→A over p∈[0.5,1]. q is the
        // sub-phase within the current leg.
        const forward = p < 0.5;
        const q = forward ? p * 2 : (p - 0.5) * 2;
        const e = ease(str(params.curve, 'easeInOut') as EaseName, q);
        // Shared-axis progress measured from pose A (0) to pose B (1) —
        // the return leg plays the same eased travel in reverse.
        const s = forward ? e : 1 - e;
        // SYMMETRIC spread about the rest position: pose A at −travel/2,
        // pose B at +travel/2. Clamped so overshooting eases (backOut) pop
        // past the pose without ever leaving the tile frame.
        const spread = clamp(s - 0.5, -SPREAD_MAX, SPREAD_MAX);
        // Trough envelope: 0 at the leg ends (both poses crisp), 1 at the
        // leg midpoint (deepest recede + dim).
        const dip = Math.sin(q * Math.PI);

        const axis = str(params.axis, 'x');
        const axisSize = axis === 'x' ? sizeX : axis === 'y' ? sizeY : footprint;
        const offset = spread * num(params.travel, 0.4) * axisSize;
        // Bounded z recede: when the shared axis IS depth, the travel already
        // carries the card in z — scale the dip recede down to 0.4× so the
        // two never stack into an over-deep, vanishing pose.
        const recede = dip * RECEDE * (axis === 'z' ? 0.4 : 1);

        // Absolute writes each seek: all three axes are always set, so a
        // live axis-dropdown change clears the previous axis' offset, and
        // co-bindings that re-base the subject cannot accumulate drift.
        subject.position.x = baseX + (axis === 'x' ? offset : 0);
        subject.position.y = baseY + (axis === 'y' ? offset : 0);
        // Depth pose B sits AWAY from the camera (−z) so the morph stays
        // composed inside the tile; the (scaled) recede dip stacks the same way.
        subject.position.z = baseZ + (axis === 'z' ? -offset : 0) - recede;

        // Re-collect so materials poured/swapped after mount get driven
        // (and snapshotted) too, then dim every known material toward the
        // trough, scaled off its own snapshotted base opacity. The trough is
        // hard-floored: the composite NEVER drops below 30% opacity.
        collect();
        const trough = clamp(num(params.trough, 0.35), TROUGH_FLOOR, 1);
        for (const [m, snap] of snapshots) {
          m.opacity = snap.opacity * (1 - (1 - trough) * dip);
        }
      };

      return {
        duration: () => num(params.duration, 2.7),
        seek: applyAt,
        // Control tweaks re-apply on the frozen frame immediately — the
        // capture rig sweeps faders while paused at a pinned t.
        onParamChange: () => applyAt(lastT),
        dispose: () => {
          subject.position.x = baseX;
          subject.position.y = baseY;
          subject.position.z = baseZ;
          for (const [m, snap] of snapshots) {
            m.opacity = snap.opacity;
            m.transparent = snap.transparent;
          }
          snapshots.clear();
        },
      };
    },
  ),
};
