// Animatable contract — the frozen interface every Prism animation primitive
// implements (PRISM-CANVAS-EDITOR-SPEC.md §8.3).
//
//   interface Animatable {
//     duration(): number;            // seconds; Infinity for purely stateful
//     seek(t: number): void;         // master clock / driver calls this
//     controls(): ControlSchema;     // knobs/faders/dropdowns/curves
//     serialize(): PrimitiveState;   // save + node caption + AI round-trip
//   }
//
// The spec lists those four methods. To make controls actually *tweakable*
// (spec §8.3 "Tweakable") and resources disposable (mirrors the existing
// PrimitiveResult.cleanup() pattern), the live contract adds three minimal
// members: setControl(), getParams(), dispose(). These are the smallest
// additions that let the ControlPanel (rendered once from ControlSchema —
// INV-5) drive a primitive and free its GPU resources.
//
// This is a SEPARATE registry from the closed 9-name cinematic-primitives
// union (INV-12 preserved): these are catalog primitives, not the curated 9.
//
// DOM-free by construction: primitives mutate a provided THREE.Object3D /
// material uniforms only. No window/document (kept clean even though this
// path is outside the runtime/ FP-05 scope).

import type { Object3D, Scene } from 'three';

// ── Categories (span of spec §8.3) ────────────────────────────────────────
export const PRIMITIVE_CATEGORIES = [
  'transform',
  'fade',
  'scroll',
  'pointer',
  'text',
  'glass',
  'caustics',
  'volumetric',
  'particles',
  'smoke',
  'displacement',
  'wave',
  'shimmer',
  'blur',
  'mask',
] as const;
export type PrimitiveCategory = (typeof PRIMITIVE_CATEGORIES)[number];

// ── Drivers (spec §8.2) — which input source plays this primitive ─────────
export const DRIVER_KINDS = ['time', 'scroll', 'pointer', 'state', 'event'] as const;
export type DriverKind = (typeof DRIVER_KINDS)[number];

// ── Preview subjects the host builds and hands to a primitive ─────────────
// 'empty' = the primitive generates its own visual (particles, smoke, glass).
export const SUBJECT_KINDS = ['card', 'text', 'plane', 'sphere', 'empty'] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

// ── ControlSchema — the declarative control vocabulary (INV-5) ────────────
export type ControlType =
  | 'knob'
  | 'fader'
  | 'dropdown'
  | 'curve'
  | 'toggle'
  | 'color';

export interface ControlBase {
  id: string;
  label: string;
  type: ControlType;
}
export interface KnobControl extends ControlBase {
  type: 'knob';
  min: number;
  max: number;
  step?: number;
  default: number;
  unit?: string;
}
export interface FaderControl extends ControlBase {
  type: 'fader';
  min: number;
  max: number;
  step?: number;
  default: number;
  unit?: string;
}
export interface DropdownControl extends ControlBase {
  type: 'dropdown';
  options: ReadonlyArray<{ value: string; label: string }>;
  default: string;
}
export interface ToggleControl extends ControlBase {
  type: 'toggle';
  default: boolean;
}
export interface ColorControl extends ControlBase {
  type: 'color';
  default: string; // hex, e.g. '#5d8bff'
}
export interface CurveControl extends ControlBase {
  type: 'curve';
  default: EaseName;
  options?: ReadonlyArray<EaseName>;
}

export type Control =
  | KnobControl
  | FaderControl
  | DropdownControl
  | ToggleControl
  | ColorControl
  | CurveControl;

export type ControlSchema = ReadonlyArray<Control>;

export type ControlValue = number | string | boolean;
export type ParamState = Record<string, ControlValue>;

// ── Easing names (the 'curve' control vocabulary) ─────────────────────────
export const EASE_NAMES = [
  'linear',
  'easeIn',
  'easeOut',
  'easeInOut',
  'expoOut',
  'backOut',
  'elasticOut',
  'bounceOut',
] as const;
export type EaseName = (typeof EASE_NAMES)[number];

// ── Serialized form (save / caption / AI round-trip) ──────────────────────
export interface PrimitiveState {
  name: string; // registry id
  category: PrimitiveCategory;
  params: ParamState;
  duration: number;
}

// ── What a primitive receives at construction ─────────────────────────────
export interface AnimatableTarget {
  /** Group the primitive owns and animates; the host adds it to the stage. */
  object: Object3D;
  /** Host-built reference subject (card/text/…), a child of `object`, or null
   *  when the definition declares subject:'empty' (primitive self-generates). */
  subject: Object3D | null;
  /** The preview stage scene (for env/lights if a primitive needs them). */
  scene: Scene;
  /** Scratch space shared with the host (uniform handles, etc.). */
  userData: Record<string, unknown>;
}

// ── The frozen contract ───────────────────────────────────────────────────
export interface Animatable {
  readonly name: string;
  readonly category: PrimitiveCategory;
  /** Seconds; Infinity for purely stateful primitives. */
  duration(): number;
  /** Master clock / driver calls this with the current time in seconds. */
  seek(t: number): void;
  /** Declares this primitive's own knobs/faders/dropdowns/curves. */
  controls(): ControlSchema;
  /** Tweak a single control's value; re-applies at the next seek. */
  setControl(id: string, value: ControlValue): void;
  /** Current resolved param values. */
  getParams(): ParamState;
  /** Save + node caption + AI round-trip. */
  serialize(): PrimitiveState;
  /** Dispose geometry/material/timelines. */
  dispose(): void;
}

// ── Registry definition (static metadata + factory) ───────────────────────
export interface PrimitiveDefinition {
  /** Stable registry id, kebab-case (e.g. 'fade', 'glass-refraction'). */
  name: string;
  /** Human label for the picker tile. */
  label: string;
  category: PrimitiveCategory;
  difficulty: 'easy' | 'medium' | 'hard';
  /** Which preview subject the host should build for this primitive. */
  subject: SubjectKind;
  /** Driver that plays this primitive in the picker tile. */
  defaultDriver: DriverKind;
  /** Static control schema (rendered once by ControlPanel — INV-5). */
  schema: ControlSchema;
  /** One-line description for the tile + report gallery. */
  description: string;
  /**
   * ADDITIVE, OPT-IN depth tag (art-polish 2026-06-09). When `true` AND
   * `subject === 'plane'`, the host builds the preview subject as a multi-slab
   * "volume" instead of a single flat quad (see `buildSubject` /
   * `buildVolumetricSlabGeometry`): N coplanar quads stacked back-to-front
   * along −z, each vertex carrying a `VOLUMETRIC_DEPTH_ATTR` float (0 front → 1
   * back). A volumetric shader can read that attribute via `attribute('aDepth')`
   * to parallax-offset / depth-fade its density field so smoke/fog/cloud/fire
   * reads as a real volume rather than a flat gradient.
   *
   * SAFE DEFAULT: omitted / `false` → the legacy single flat plane, byte-stable.
   * This is purely static `PrimitiveDefinition` metadata; the frozen `Animatable`
   * interface (duration/seek/controls/serialize/…) is untouched, so no existing
   * primitive, test, or registry consumer changes behavior.
   */
  volumetric?: boolean;
  /** Construct a live Animatable bound to `target`. */
  create: (target: AnimatableTarget, params?: Partial<ParamState>) => Animatable;
}

/**
 * Per-vertex float attribute carried by a volumetric multi-slab subject:
 * 0.0 at the front (camera-facing) slab → 1.0 at the rearmost slab. Volumetric
 * primitives read it in TSL via `attribute(VOLUMETRIC_DEPTH_ATTR)`. Frozen name
 * so the host geometry and the primitive shaders agree.
 */
export const VOLUMETRIC_DEPTH_ATTR = 'aDepth';

// ── Helpers shared by primitive authors ───────────────────────────────────
/** Resolve initial params from a schema + caller overrides. */
export function resolveParams(
  schema: ControlSchema,
  overrides?: Partial<ParamState>,
): ParamState {
  const out: ParamState = {};
  for (const c of schema) {
    out[c.id] = (c as { default: ControlValue }).default;
  }
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined) out[k] = v;
    }
  }
  return out;
}

export const num = (v: ControlValue | undefined, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;
export const str = (v: ControlValue | undefined, d: string): string =>
  typeof v === 'string' ? v : d;
export const bool = (v: ControlValue | undefined, d: boolean): boolean =>
  typeof v === 'boolean' ? v : d;

/** Clamp helper. */
export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** Normalize a seconds time to 0..1 over a duration (clamped). */
export const phase = (t: number, duration: number): number =>
  duration <= 0 ? 1 : clamp(t / duration, 0, 1);
