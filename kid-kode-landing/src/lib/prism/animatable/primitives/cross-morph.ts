// cross-morph — shared-axis state morph (DESIGN-REFERENCES §14, View
// Transitions / Material shared-axis brought into real 3D): one continuous
// timeline where the card leaves pose A (rest), recedes in z while dimming
// through a soft opacity trough (~0.35) with slight travel along the shared
// axis, then re-emerges fully opaque and advanced into pose B — a full
// subject-width offset along that axis. The loop's second half plays the SAME
// morph back from B to A, so the transition reads state-to-state in both
// directions, exactly like forward/back navigation. CPU transform primitive
// (medium / transform / card / time).
//
// DISTINCT from its neighbors: fade-through-black is a pure opacity V-dip
// with zero spatial motion — cross-morph's dip is the *middle* of a journey,
// composited with axis travel and a z recede. cube-rotate is a rigid
// rotational arc around a hinge — cross-morph never rotates; it is the
// translation + depth + opacity-trough composite, the signature of the
// shared-axis pattern.
//
// Determinism: pure math from phase(t) — no Math.random anywhere. Travel and
// recede distances are SUBJECT-RELATIVE (Box3-measured at the rest pose),
// never hardcoded world units. Opacity writes snapshot per material and
// dispose restores opacity AND .transparent exactly as found; materials are
// re-collected each seek so asynchronously poured/swapped artifact materials
// are picked up live (new ones are snapshotted on first sight).

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
  { id: 'travel', label: 'Travel', type: 'fader', min: 0.2, max: 2, step: 0.05, default: 0.5, unit: '×size' },
  { id: 'trough', label: 'Trough', type: 'fader', min: 0, max: 0.9, step: 0.01, default: 0.35 },
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.8, max: 5, step: 0.1, default: 2.4, unit: 's' },
  {
    id: 'curve',
    label: 'Ease',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'expoOut', 'backOut'],
  },
] as const;

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

      return {
        duration: () => num(params.duration, 2.4),
        seek: (t) => {
          const p = phase(t, num(params.duration, 2.4));
          // Two legs: A→B over p∈[0,0.5], B→A over p∈[0.5,1]. q is the
          // sub-phase within the current leg.
          const forward = p < 0.5;
          const q = forward ? p * 2 : (p - 0.5) * 2;
          const e = ease(str(params.curve, 'easeInOut') as EaseName, q);
          // Shared-axis progress measured from pose A (0) to pose B (1) —
          // the return leg plays the same eased travel in reverse.
          const s = forward ? e : 1 - e;
          // Trough envelope: 0 at the leg ends (both poses crisp), 1 at the
          // leg midpoint (deepest recede + dim).
          const dip = Math.sin(q * Math.PI);

          const axis = str(params.axis, 'x');
          const axisSize = axis === 'x' ? sizeX : axis === 'y' ? sizeY : footprint;
          const offset = s * num(params.travel, 0.9) * axisSize;
          const recede = dip * RECEDE;

          // Absolute writes each seek: all three axes are always set, so a
          // live axis-dropdown change clears the previous axis' offset, and
          // co-bindings that re-base the subject cannot accumulate drift.
          subject.position.x = baseX + (axis === 'x' ? offset : 0);
          subject.position.y = baseY + (axis === 'y' ? offset : 0);
          // Depth pose B sits AWAY from the camera (−z) so the morph stays
          // composed inside the tile; the recede dip stacks the same way.
          subject.position.z = baseZ + (axis === 'z' ? -offset : 0) - recede;

          // Re-collect so materials poured/swapped after mount get driven
          // (and snapshotted) too, then dim every known material toward the
          // trough, scaled off its own snapshotted base opacity.
          collect();
          const trough = clamp(num(params.trough, 0.35), 0, 1);
          for (const [m, snap] of snapshots) {
            m.opacity = snap.opacity * (1 - (1 - trough) * dip);
          }
        },
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
