// create-text-node.ts — buildTextNode, the FROZEN node-creation helper for
// renderMode:'text' (canvas-spec §7 / criterion 26; P1 TEXT SYSTEM wave 2).
//
// Returns valid input for `useGraphSourceStore.addNode` (which runs the
// result through `applyPlanRendererDefaults`, filling renderMode-derived
// defaults like scenePosition / receivesLighting — text defaults UNLIT via
// `receivesLightingDefault`). Parallel agents code against this exact
// signature — do not change it.
//
// Conventions mirrored from the existing graph records (home-hub.legacy.json
// minimal node shape) and the AddNodeDialog Stage-0 path:
//   - `codeRef: ''` / `backendRef: null` — no code module; the default
//     render-mode factory's 'text' branch builds the artifact.
//   - `serviceTag: 'main'` — the mock-graph blank-node convention.
//   - `intent.visualSpec.textContent` stays EMPTY: the TextObject renders the
//     glyphs; the legacy §13 runtime-label path must not double-render them.
//   - `intent.caption` self-captions from the node's own properties (spec
//     §7.6 — text nodes never need a VLM): `Text: "<content>" (<family> <weight>)`.
//
// DOM-free + relative imports only (dep-guard for src/lib/prism/text/**).

import { TEXT_SPEC_DEFAULT, type PrismNode, type TextSpec } from '../../prism-graph/types';
import { getFontRegistry } from './font-registry';

/** Compose the §7.6 self-caption from a resolved TextSpec. Exported so the
 *  Inspector's text tab can re-caption on save with the same format. */
export function textNodeCaption(spec: TextSpec): string {
  const content = spec.content ?? TEXT_SPEC_DEFAULT.content ?? '';
  const family = spec.fontFamily ?? TEXT_SPEC_DEFAULT.fontFamily ?? 'Inter';
  const weight = spec.fontWeight ?? TEXT_SPEC_DEFAULT.fontWeight ?? 400;
  return `Text: "${content}" (${family} ${weight})`;
}

/** Canvas-spawn defaults (advocate MUST-FIX, 2026-06-10). TEXT_SPEC_DEFAULT's
 *  warm-white fill is tuned for dark surfaces (the catalog tiles); over the
 *  light mock-app viewport it measured ~1.48:1 contrast — invisible. Add Text
 *  spawns with the design-system ink fill instead (scene DATA hex, sanctioned
 *  exception — same rule as LIGHT_COLOR_DEFAULT), placed in the clear
 *  lower-center band and nudged toward camera so it never spawns occluded
 *  behind the hub's center element. */
const SPAWN_FILL = { kind: 'solid', color: '#1d212b' } as const;
const SPAWN_POSITION = {
  x: 0, y: -0.8, z: 0.2,
  rotationX: 0, rotationY: 0, rotationZ: 0,
  scaleX: 1, scaleY: 1, scaleZ: 1,
};

/** Build the addNode input for a fresh text node under `parentHubId`. The
 *  textSpec resolves over TEXT_SPEC_DEFAULT; `content`, when given, overrides
 *  the default string. */
export function buildTextNode(opts: {
  parentHubId: string;
  content?: string;
}): Partial<PrismNode> & { parentHubId: string } {
  const textSpec: TextSpec = {
    ...TEXT_SPEC_DEFAULT,
    fill: { ...SPAWN_FILL },
    ...(opts.content !== undefined ? { content: opts.content } : {}),
  };

  // Criterion 26 — warm the (family, weight) atlas as early as possible so
  // the factory's synchronous peek hits by build time. Fire-and-forget: a
  // failed fetch (offline, node test env) is swallowed; the factory's own
  // resolve path retries.
  try {
    void getFontRegistry()
      .resolveAtlas(
        textSpec.fontFamily ?? 'Inter',
        textSpec.fontWeight ?? 400,
      )
      .catch(() => { /* swallow — warm-up only */ });
  } catch { /* swallow — warm-up only */ }

  return {
    parentHubId: opts.parentHubId,
    subtype: 'text',
    serviceTag: 'main',
    renderMode: 'text',
    textSpec,
    scenePosition: { ...SPAWN_POSITION },
    visual: {
      // Scene-unit transform; the glyph block defines its own true extent
      // (TextObjectHandle.measure()), this is the editor's selection-ring /
      // marquee envelope for a default-size block.
      transform: { x: 0, y: 0, z: 0, width: 1.6, height: 0.6 },
      alpha: 1,
    },
    intent: {
      caption: textNodeCaption(textSpec),
      behaviorSpec: {
        interactions: [],
        apiCalls: [],
        dataBindings: [],
        emits: [],
        listens: [],
        triggersDownstream: [],
      },
      stateEffects: [],
      // textContent stays [] — the TextObject IS the text artifact (the §13
      // runtime-label loop would otherwise render the string twice).
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: '',
    backendRef: null,
  };
}
