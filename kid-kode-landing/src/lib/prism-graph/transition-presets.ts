// W8 E10 — curated hub/scene transition preset library. One-click choices in the
// canvas (Scene FX control) + a tone→preset mapping the intake uses. The
// transition drivers (HubSceneTransition WebGL curtain, TransitionVeil DOM
// overlay) read the resolved preset to pick their look.
//
// Pure data + pure resolvers — no three, no DOM, node-testable.

import type { HubTransitionKind, HubTransitionPreset } from './types';

/** How each preset drives the two transition surfaces. `webglKind` selects the
 *  in-scene reveal (0 curtain / 1 wipe / 2 dissolve; veil & glass-sweep reuse
 *  curtain geometry with veil/sweep emphasis); `showVeil` gates the branded DOM
 *  veil overlay. */
export interface ResolvedTransition {
  kind: HubTransitionKind;
  /** In-shader reveal selector consumed by HubSceneTransition. */
  webglKind: 0 | 1 | 2;
  /** Show the branded DOM veil overlay during close/hold. */
  showVeil: boolean;
  /** Timing multiplier applied to close/hold/open. */
  speed: number;
  /** Accent hex (seam / tint). */
  accent: string;
}

export interface TransitionPresetDef {
  kind: HubTransitionKind;
  label: string;
  description: string;
  webglKind: 0 | 1 | 2;
  showVeil: boolean;
  defaultSpeed: number;
  defaultAccent: string;
}

const BRASS = '#d8a24a';

// The curated set surfaced in the canvas one-click picker.
export const TRANSITION_PRESETS: readonly TransitionPresetDef[] = [
  {
    kind: 'curtain',
    label: 'Brass Curtain',
    description: 'Pleated brass panels close, hold, and part — the signature.',
    webglKind: 0,
    showVeil: false,
    defaultSpeed: 1,
    defaultAccent: BRASS,
  },
  {
    kind: 'veil',
    label: 'Veil',
    description: 'A soft branded veil settles over the scene, then lifts.',
    webglKind: 0,
    showVeil: true,
    defaultSpeed: 1.15,
    defaultAccent: BRASS,
  },
  {
    kind: 'dissolve',
    label: 'Dissolve',
    description: 'The outgoing scene dissolves through fine noise into the next.',
    webglKind: 2,
    showVeil: false,
    defaultSpeed: 1.1,
    defaultAccent: BRASS,
  },
  {
    kind: 'wipe',
    label: 'WebGL Wipe',
    description: 'A hard directional edge sweeps the new scene across.',
    webglKind: 1,
    showVeil: false,
    defaultSpeed: 0.85,
    defaultAccent: BRASS,
  },
  {
    kind: 'glass-sweep',
    label: 'Glass Sweep',
    description: 'A refractive glass slab sweeps the composition through.',
    webglKind: 0,
    showVeil: true,
    defaultSpeed: 1,
    defaultAccent: '#bfe3ff',
  },
];

const BY_KIND = new Map(TRANSITION_PRESETS.map((p) => [p.kind, p]));

/** Resolve a hub's optional preset (or nothing) into the full driver config.
 *  Absent / unknown kind → the default brass curtain (byte-stable). */
export function resolveTransition(
  preset: HubTransitionPreset | undefined | null,
): ResolvedTransition {
  const def = (preset && BY_KIND.get(preset.kind)) || BY_KIND.get('curtain')!;
  return {
    kind: def.kind,
    webglKind: def.webglKind,
    showVeil: def.showVeil,
    speed: clampSpeed(preset?.speed ?? def.defaultSpeed),
    accent: preset?.accent ?? def.defaultAccent,
  };
}

function clampSpeed(s: number): number {
  if (!Number.isFinite(s)) return 1;
  return s < 0.5 ? 0.5 : s > 2 ? 2 : s;
}

/** Intake tone → transition preset (E10 "intake tone mapping"). The Direction
 *  Board tone the user picked seeds a fitting default transition; the user can
 *  always override in the canvas. */
export function presetForTone(tone: string): HubTransitionPreset {
  const t = tone.toLowerCase();
  if (/(edito|magazine|gallery|fashion|luxur|atelier)/.test(t))
    return { kind: 'veil' };
  if (/(tech|data|dashboard|saas|analytic|ops)/.test(t)) return { kind: 'wipe' };
  if (/(dream|ethereal|organic|soft|calm|wellness|nature)/.test(t))
    return { kind: 'dissolve' };
  if (/(premium|glass|refined|crystal|showcase)/.test(t))
    return { kind: 'glass-sweep' };
  return { kind: 'curtain' };
}
