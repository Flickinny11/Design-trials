// swap-flip-morph — Two-Faced Swap Flip. On every STATE CHANGE the card snaps
// a half-flip through depth, and exactly at the 90deg edge-on crossing it
// swaps to its alternate face: the SAME card, re-tinted by a brightness bias
// derived from the subject's own colors (lerped toward warm bone when biased
// light, toward ink when biased dark — never an invented hue). This is the
// View Transitions API idea (DESIGN-REFERENCES §14: old/new states sharing a
// `view-transition-name` morph into each other) done physically: state A and
// state B are the two faces of one flipping element.
//
// STATE CONVENTION (adopted here — no prior primitive read it; documented for
// successors): the host/StateDriver writes a BOOLEAN to `target.userData.state`
// (same delivery channel as `userData.pointer` / `userData.scroll`). When the
// boolean is present, the card flips ONLY on toggles — false = face A,
// true = face B, each toggle driving one eased half-turn from the toggle
// instant (mid-flip retargets continue from the current angle). When absent
// (the catalog rig today), a deterministic t-clock fallback auto-toggles every
// `hold + duration` seconds, so the tile loops: hold A, snap-flip, hold B,
// snap-flip back. Pure function of t in fallback — reversible and repeat-safe.
//
// DISTINCT from its neighbors: 'flip' is a partial edge-on -> facing settle
// with a fade-in; 'flip-3d' is one continuous 0 -> PI entrance with a
// foreshorten dip; 'flip-board' quantizes one entrance into split-flap clacks;
// 'cube-rotate' swings in on a positional hinge arc. None has state semantics
// and none swaps the face — this one is a REPEATED, state-triggered identity
// morph where the card's look genuinely changes at the edge of every flip.
//
// Materials touched = snapshot/restore: the tint mutates the LIVE materials'
// color/emissive/emissiveIntensity in place (never replaces a material, so a
// mounted artifact's texture .map keeps rendering — the tint multiplies it).
// Materials are re-collected EVERY seek, so instances swapped in after attach
// (async texture pours) are picked up and snapshotted before first touch.
// CPU transform primitive (medium / transform / state), no shaders spawned.

import { Color, Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, type EaseName, type PrimitiveDefinition } from '../contract';

// Face-B tint poles — the bias lerps the subject's OWN colors toward these
// design-world tones (warm bone when lightening, ink when darkening).
const BONE = new Color('#e9e0cd');
const INK = new Color('#0b0d13');
// Max lerp fraction at |bias| = 1: face B stays recognizably the same card.
const TINT_MAX = 0.85;

const SCHEMA = [
  { id: 'duration', label: 'Flip Time', type: 'fader', min: 0.2, max: 2, step: 0.05, default: 0.55, unit: 's' },
  {
    id: 'axis',
    label: 'Axis',
    type: 'dropdown',
    options: [
      { value: 'y', label: 'Y' },
      { value: 'x', label: 'X' },
    ],
    default: 'y',
  },
  { id: 'hold', label: 'Hold', type: 'fader', min: 0.2, max: 3, step: 0.05, default: 0.9, unit: 's' },
  { id: 'faceBias', label: 'Face B Bias', type: 'fader', min: -1, max: 1, step: 0.05, default: 0.45 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'backOut',
    options: ['linear', 'easeInOut', 'expoOut', 'backOut'],
  },
] as const;

interface MaterialSnap {
  color: Color | null;
  emissive: Color | null;
  emissiveIntensity: number | null;
}

type Tintable = Material & {
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
};

/** Collect the subject subtree's materials (subject may be a Mesh OR a Group —
 *  e.g. the MSDF 'text-object' — so we traverse rather than read .material). */
function materialsOf(root: Object3D): Tintable[] {
  const out: Tintable[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) out.push(mat as Tintable);
    }
  });
  return out;
}

export const swapFlipMorphPrimitive: PrimitiveDefinition = {
  name: 'swap-flip-morph',
  label: 'Swap Flip Morph',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'state',
  schema: SCHEMA,
  description:
    'On every state change the card snaps a half-flip, swapping to its alternate face mid-edge — a two-faced identity morph.',
  create: defineAnimatable(
    { name: 'swap-flip-morph', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseX = subject.rotation.x;
      const baseY = subject.rotation.y;

      // Lazy per-material snapshots: keyed by instance, taken on FIRST touch
      // (so async-swapped materials get a correct base), restored on dispose.
      const snaps = new Map<Tintable, MaterialSnap>();
      const scratch = new Color();

      // External-state machine (only used when userData.state is a boolean).
      // fromFrac counts half-turns at the start of the active flip; the angle
      // is PI * (fromFrac + eased(progress)). Mid-flip retargets continue from
      // the current fractional angle, so the motion never jumps.
      let extLast: boolean | null = null;
      let fromFrac = 0;
      let flipStart = -Infinity;
      let faceFrom = false;
      let faceTo = false;

      const snapOf = (m: Tintable): MaterialSnap => {
        let s = snaps.get(m);
        if (!s) {
          s = {
            color: m.color?.isColor ? m.color.clone() : null,
            emissive: m.emissive?.isColor ? m.emissive.clone() : null,
            emissiveIntensity:
              typeof m.emissiveIntensity === 'number' ? m.emissiveIntensity : null,
          };
          snaps.set(m, s);
        }
        return s;
      };

      /** Apply face A (exact snapshot) or face B (bias-tinted from snapshot)
       *  to the LIVE material set — re-collected each call (async pours). */
      const applyFace = (faceB: boolean, bias: number) => {
        const k = clamp(Math.abs(bias), 0, 1) * TINT_MAX;
        const tone = bias >= 0 ? BONE : INK;
        for (const m of materialsOf(subject)) {
          const s = snapOf(m);
          if (!faceB || k === 0) {
            if (s.color) m.color!.copy(s.color);
            if (s.emissive) m.emissive!.copy(s.emissive);
            if (s.emissiveIntensity !== null) m.emissiveIntensity = s.emissiveIntensity;
          } else {
            if (s.color) m.color!.copy(scratch.copy(s.color).lerp(tone, k));
            if (s.emissive) m.emissive!.copy(scratch.copy(s.emissive).lerp(tone, k * 0.5));
            if (s.emissiveIntensity !== null) {
              m.emissiveIntensity =
                bias >= 0
                  ? s.emissiveIntensity * (1 + 0.9 * bias)
                  : s.emissiveIntensity * (1 - 0.45 * Math.abs(bias));
            }
          }
        }
      };

      return {
        // Purely stateful loop: external toggles (or the t-clock fallback)
        // drive it indefinitely.
        duration: () => Infinity,
        seek: (t) => {
          const dur = Math.max(0.05, num(params.duration, 0.55));
          const hold = num(params.hold, 0.9);
          const curve = str(params.curve, 'backOut') as EaseName;
          const tt = Math.max(0, t);

          let frac: number;
          let faceB: boolean;

          const ext = target.userData.state;
          if (typeof ext === 'boolean') {
            // STATE PATH — flip only on toggles.
            if (extLast === null) {
              // First observation: adopt the state with no animation
              // (face B <=> state true, already half-turned).
              extLast = ext;
              fromFrac = ext ? 1 : 0;
              faceFrom = ext;
              faceTo = ext;
              flipStart = -Infinity;
            } else if (ext !== extLast) {
              // Toggle: start a half-turn from the CURRENT angle/face. A prior
              // COMPLETED flip contributes its full half-turn via eNow = 1; if
              // no flip ever ran, fromFrac already holds the adopted angle.
              const inFlight = flipStart !== -Infinity;
              const eNow = inFlight ? ease(curve, clamp((tt - flipStart) / dur, 0, 1)) : 0;
              faceFrom = !inFlight || eNow >= 0.5 ? faceTo : faceFrom;
              fromFrac = fromFrac + eNow;
              faceTo = ext;
              extLast = ext;
              flipStart = tt;
            }
            const p = flipStart === -Infinity ? 1 : clamp((tt - flipStart) / dur, 0, 1);
            const e = ease(curve, p);
            frac = flipStart === -Infinity ? fromFrac : fromFrac + e;
            faceB = e >= 0.5 ? faceTo : faceFrom;
          } else {
            // T-CLOCK FALLBACK — deterministic auto-toggle, pure in t:
            // hold face, flip, hold alternate face, flip back. frac = k + e is
            // continuous across cycle boundaries (e(1) = 1 meets k+1 exactly),
            // so scrubbing in either direction is seamless.
            const cycle = hold + dur;
            const k = Math.floor(tt / cycle);
            const p = clamp((tt - k * cycle - hold) / dur, 0, 1);
            const e = ease(curve, p);
            frac = k + e;
            faceB = (k + (e >= 0.5 ? 1 : 0)) % 2 === 1;
          }

          // Axis read LIVE so toggling the dropdown re-targets next frame; the
          // unused axis is parked at base so swaps never leave residue.
          const angle = Math.PI * frac;
          if (str(params.axis, 'y') === 'x') {
            subject.rotation.x = baseX + angle;
            subject.rotation.y = baseY;
          } else {
            subject.rotation.y = baseY + angle;
            subject.rotation.x = baseX;
          }

          applyFace(faceB, num(params.faceBias, 0.45));
        },
        dispose: () => {
          subject.rotation.x = baseX;
          subject.rotation.y = baseY;
          for (const [m, s] of snaps) {
            if (s.color) m.color!.copy(s.color);
            if (s.emissive) m.emissive!.copy(s.emissive);
            if (s.emissiveIntensity !== null) m.emissiveIntensity = s.emissiveIntensity;
          }
          snaps.clear();
        },
      };
    },
  ),
};
