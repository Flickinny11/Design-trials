// swap-flip-morph — Two-Faced Swap Flip. On every STATE CHANGE the card snaps
// a half-flip through depth, and exactly at the 90deg edge-on crossing it
// swaps to its alternate face: the SAME card — chrome, header, rows and all —
// re-tinted by a brightness bias derived from the subject's own colors (lerped
// toward warm bone when biased light, toward ink when biased dark — never an
// invented hue). This is the View Transitions API idea (DESIGN-REFERENCES §14:
// old/new states sharing a `view-transition-name` morph into each other) done
// physically: state A and state B are the two faces of one flipping element.
//
// FACE-B SWAP TRICK (advocate must-fix 2026-06-12): face B is NOT the literal
// back of the panel geometry — the card subject's chrome (brass header, ice
// dot, content rows) is parented in FRONT of the face, so a raw 180deg turn
// occludes all of it behind the panel and reads as a featureless slab. Instead,
// when face B engages (eased phase crosses 0.5), the visible angle gets an
// extra half-turn: angle = PI*frac + PI. Both sides of the crossing are
// edge-on, so the swap is invisible, and the card lands FRONT-facing again —
// full composite structure visible — wearing the face-B tint. The back of the
// panel is never shown.
//
// PER-MATERIAL TINT, CAPPED DESATURATION (same must-fix): the bias lerp is
// weighted per material by its OWN snapshot saturation — near-neutral surfaces
// (graphite panel, grey rows) take the full bone/ink shift, while saturated
// chrome (brass header, ice dot) is capped at ~35% so its hue identity
// survives. Face B reads as a bone-tinted variant of the same card, never a
// grey rectangle.
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
// CAPTURE-RIG TIMING (advocate must-fix 2026-06-12): control sweeps happen
// paused at pinned t=1s, and swept sliders are LEFT AT MAX when the next one
// is swept. Defaults are timed so the first flip COMPLETES before t=1
// (hold 0.5 + duration 0.45 = 0.95s), and `faceBias` is FIRST in the schema so
// its sweep runs with duration/hold still at defaults — at t=1 the tile is
// holding face B, so the bias sweep visibly re-tints the frozen frame. The
// later duration/hold sweeps stay alive too: duration max parks t=1 mid-flip
// (pose change), hold max parks t=1 back on face A rest (full look change).
// onParamChange re-applies at the last seek time so a control change repaints
// even if the host doesn't re-seek.
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
// Max lerp fraction at |bias| = 1 for a fully neutral material: face B stays
// recognizably the same card.
const TINT_MAX = 0.85;
// Saturated chrome keeps its identity: its lerp weight ramps down from 1 (at
// snapshot saturation <= CHROME_SAT_LO) to CHROME_MIN_WEIGHT (at >= _HI).
const CHROME_SAT_LO = 0.15;
const CHROME_SAT_HI = 0.4;
const CHROME_MIN_WEIGHT = 0.35;

const SCHEMA = [
  // faceBias FIRST: the capture rig sweeps range controls in schema order and
  // leaves each at max — bias must be judged while duration/hold are still at
  // their (sub-1s-cycle) defaults so t=1s is holding face B. See header note.
  { id: 'faceBias', label: 'Face B Bias', type: 'fader', min: -1, max: 1, step: 0.05, default: 0.55 },
  { id: 'duration', label: 'Flip Time', type: 'fader', min: 0.2, max: 2, step: 0.05, default: 0.45, unit: 's' },
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
  { id: 'hold', label: 'Hold', type: 'fader', min: 0.2, max: 3, step: 0.05, default: 0.5, unit: 's' },
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
  /** Per-material tint weight (1 = neutral surface, takes the full bias lerp;
   *  -> CHROME_MIN_WEIGHT for saturated chrome so its identity survives). */
  weight: number;
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
    'On every state change the card snaps a half-flip, swapping at the 90° edge to its alternate face — the same card, bias-tinted, chrome intact.',
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
      const hsl = { h: 0, s: 0, l: 0 };

      // External-state machine (only used when userData.state is a boolean).
      // fromFrac counts half-turns at the start of the active flip; the angle
      // is PI * (fromFrac + eased(progress)). Mid-flip retargets continue from
      // the current fractional angle, so the motion never jumps.
      let extLast: boolean | null = null;
      let fromFrac = 0;
      let flipStart = -Infinity;
      let faceFrom = false;
      let faceTo = false;
      // Last seek time — onParamChange re-applies here so a control tweak
      // repaints the current (possibly paused) frame immediately.
      let lastT = 0;

      const snapOf = (m: Tintable): MaterialSnap => {
        let s = snaps.get(m);
        if (!s) {
          let weight = 1;
          if (m.color?.isColor) {
            m.color.getHSL(hsl);
            weight =
              1 -
              (1 - CHROME_MIN_WEIGHT) *
                clamp((hsl.s - CHROME_SAT_LO) / (CHROME_SAT_HI - CHROME_SAT_LO), 0, 1);
          }
          s = {
            color: m.color?.isColor ? m.color.clone() : null,
            emissive: m.emissive?.isColor ? m.emissive.clone() : null,
            emissiveIntensity:
              typeof m.emissiveIntensity === 'number' ? m.emissiveIntensity : null,
            weight,
          };
          snaps.set(m, s);
        }
        return s;
      };

      /** Apply face A (exact snapshot) or face B (bias-tinted from snapshot)
       *  to the LIVE material set — re-collected each call (async pours).
       *  The lerp is weighted per material (capped desaturation: saturated
       *  chrome shifts least), sqrt-shaped so mid biases already read. */
      const applyFace = (faceB: boolean, bias: number) => {
        const k = Math.sqrt(clamp(Math.abs(bias), 0, 1)) * TINT_MAX;
        const tone = bias >= 0 ? BONE : INK;
        for (const m of materialsOf(subject)) {
          const s = snapOf(m);
          if (!faceB || k === 0) {
            if (s.color) m.color!.copy(s.color);
            if (s.emissive) m.emissive!.copy(s.emissive);
            if (s.emissiveIntensity !== null) m.emissiveIntensity = s.emissiveIntensity;
          } else {
            const kMat = k * s.weight;
            if (s.color) m.color!.copy(scratch.copy(s.color).lerp(tone, kMat));
            if (s.emissive) m.emissive!.copy(scratch.copy(s.emissive).lerp(tone, kMat * 0.5));
            if (s.emissiveIntensity !== null) {
              m.emissiveIntensity =
                bias >= 0
                  ? s.emissiveIntensity * (1 + 0.9 * bias * s.weight)
                  : s.emissiveIntensity * (1 - 0.45 * Math.abs(bias) * s.weight);
            }
          }
        }
      };

      const apply = (t: number) => {
        const dur = Math.max(0.05, num(params.duration, 0.45));
        const hold = num(params.hold, 0.5);
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

        // FACE-B SWAP: an extra half-turn whenever face B shows, so the card
        // lands FRONT-facing (chrome visible) wearing the alternate tint. Both
        // sides of the e=0.5 crossing are edge-on (PI*(k+1/2) vs +PI), so the
        // swap itself is invisible; the panel's bare back is never presented.
        // Axis read LIVE so toggling the dropdown re-targets next frame; the
        // unused axis is parked at base so swaps never leave residue.
        const angle = Math.PI * frac + (faceB ? Math.PI : 0);
        if (str(params.axis, 'y') === 'x') {
          subject.rotation.x = baseX + angle;
          subject.rotation.y = baseY;
        } else {
          subject.rotation.y = baseY + angle;
          subject.rotation.x = baseX;
        }

        applyFace(faceB, num(params.faceBias, 0.55));
      };

      return {
        // Purely stateful loop: external toggles (or the t-clock fallback)
        // drive it indefinitely.
        duration: () => Infinity,
        seek: (t) => {
          lastT = Math.max(0, t);
          apply(lastT);
        },
        // Re-apply at the frozen frame so a paused control sweep repaints
        // immediately (the rig also re-seeks each frame; this covers hosts
        // that don't).
        onParamChange: () => apply(lastT),
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
