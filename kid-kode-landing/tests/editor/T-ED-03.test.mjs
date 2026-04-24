// Acceptance test for T-ED-03 — Inspector panel reads selected nodeId
// → shows intent.caption + transform + stateEffects (§7).
//
// T-ED-02 landed the pointerdown→`node-selected` wiring in
// src/lib/prism/player/boot.ts. T-ED-03 is the first editor consumer:
// src/components/editor/panels/Inspector.tsx must subscribe to the
// shared event bus, read the selected node from the bridge's compiled
// graph, and render intent.caption + transform.{x,y,z} + stateEffects
// without referencing any mock-app-specific nodeId.
//
// Before this iteration the file at that path rendered the 3D graph
// editor's inspector, driven by `@/data/mockGraph` + the local Zustand
// store. §7 tasks consolidate editor panels around
// `window.__prism` — this test locks the consolidation so a regression
// back to the mock-graph surface fails loudly.
//
// Acceptance contract (all required):
//
//   (A) `src/components/editor/panels/Inspector.tsx` exists and declares
//       a React client component (`'use client'` pragma present, default
//       export). The old mock-graph-driven surface must be gone — a
//       regression that re-introduces it would fail (H).
//
//   (B) Subscribes to the shared event bus via
//       `events.on('node-selected', ...)` where `events` is reached
//       through the `window.__prism` bridge (not a hand-rolled store).
//       The unsubscribe handle returned by `.on(...)` must be used to
//       tear down the listener on unmount (so remounted inspectors do
//       not accumulate stale subscriptions).
//
//   (C) The event payload is destructured by the `nodeId` key — the
//       payload shape editor-bridge.md pins for `'node-selected'`. A
//       regression that reads `source` would fail (catches the common
//       copy-paste from the `'navigate'` pattern).
//
//   (D) The selected node is looked up from the bridge's compiled graph
//       (`graph.nodes` — a flat array per editor-bridge.md:52 — via
//       `.find`, or equivalent Array iteration on the same field).
//       Generic lookup — NOT a hand-rolled mockGraph / useGraphEditor
//       store.
//
//   (E) Renders `intent.caption` verbatim from the selected node. The
//       caption is the human-readable label for the node; §7 makes it
//       the Inspector's headline field.
//
//   (F) Renders `transform.x`, `transform.y`, AND `transform.z` from
//       the node's `visual.transform` — the three fields present on
//       every node in home-hub.json. (`scale` is not on-disk today;
//       the Inspector may render it defensively but the test does not
//       require it.)
//
//   (G) Renders `stateEffects` (the array on `intent.stateEffects`).
//       A node like navbar-logo lists ['lift-hover', 'scale-press'];
//       the Inspector must surface them as a list the operator can
//       read.
//
//   (H) No hardcoded mock-app nodeIds in the Inspector source. The
//       anti-drift PreToolUse hook already blocks writes with such
//       literals inside `src/components/editor/**`, but we double-
//       check from the test side so a future refactor can't slip one
//       through a bypass marker. Same FORBIDDEN_ID_RE as T-ED-02.
//
//   (I) No import of `@/data/mockGraph` or `useGraphEditorStore` in
//       this file. Those are the mock-graph-editor surfaces the
//       consolidation is removing — their presence would mean the
//       Inspector still reads from two sources of truth.
//
// Run with: node tests/editor/T-ED-03.test.mjs

import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, '..', '..');
const inspectorPath = resolve(kidKodeRoot, 'src/components/editor/panels/Inspector.tsx');

assert.ok(existsSync(inspectorPath), `Inspector.tsx not found at ${inspectorPath}`);

const src = readFileSync(inspectorPath, 'utf8');

// ─── (A) 'use client' pragma + default export ──────────────────────────
assert.ok(
  /^\s*['"`]use client['"`]\s*;?/m.test(src),
  "Inspector.tsx: missing `'use client'` pragma — required for client-side event bus subscription",
);
assert.ok(
  /export\s+default\s+(?:function|async\s+function|class)\s+Inspector\b/.test(src) ||
  /export\s+default\s+Inspector\b/.test(src),
  "Inspector.tsx: must `export default` a component named `Inspector`",
);

// ─── (B) subscribes via events.on('node-selected', ...) ────────────────
// The subscription call must reach the bus through the bridge — either
//   const bridge = window.__prism; bridge.events.on('node-selected', h)
//   window.__prism.events.on('node-selected', h)
//   b.events.on('node-selected', h)  // where b is a bridge alias
// We look for `.events.on('node-selected'` anywhere in the file.
const SUBSCRIBE_RE = /\.events\.on\s*\(\s*['"`]node-selected['"`]\s*,/;
assert.ok(
  SUBSCRIBE_RE.test(src),
  "Inspector.tsx: expected `events.on('node-selected', ...)` subscription reached via the bridge (window.__prism.events)",
);

// The subscription must be inside a useEffect (so it mounts/unmounts
// with the component). The useEffect must return a cleanup function
// that calls the unsubscribe handle returned by events.on.
assert.ok(
  /useEffect\s*\(/.test(src),
  "Inspector.tsx: the subscription must be inside a useEffect (so remounts don't leak listeners)",
);
// Cleanup signal: we look for either `return () => off()` / `return off`
// or the more literal `return unsubscribe` / `.off(` / the handler being
// stored and invoked in a cleanup. The minimum shape: the result of
// `.events.on(...)` is assigned/returned (i.e. NOT discarded).
const DISCARD_RE = /\.events\.on\s*\(\s*['"`]node-selected['"`]\s*,[\s\S]*?\)\s*;?\s*\n/;
const STORE_RE   = /(?:const|let|var)\s+\w+\s*=\s*\w+\.events\.on\s*\(\s*['"`]node-selected['"`]/;
const RETURN_RE  = /return\s+\w+\.events\.on\s*\(\s*['"`]node-selected['"`]/;
const INLINE_RETURN_RE = /return\s*\(\s*\)\s*=>\s*\{?[\s\S]{0,200}?\.events\.on\s*\(/;
assert.ok(
  STORE_RE.test(src) || RETURN_RE.test(src) || INLINE_RETURN_RE.test(src),
  "Inspector.tsx: the value returned by `events.on('node-selected', ...)` must be captured or returned so React can call it on unmount (otherwise remounts leak listeners)",
);
// Weak check that SOMETHING under useEffect returns a cleanup.
assert.ok(
  /useEffect\s*\([\s\S]*?return\s+(?:\(\s*\)\s*=>|\w+\s*;?\s*\})/.test(src),
  "Inspector.tsx: useEffect should return a cleanup function that tears down the subscription on unmount",
);

// ─── (C) payload key is `nodeId` ───────────────────────────────────────
// The handler must destructure or read `nodeId` from the payload. We
// accept either `({ nodeId }) => ...`, `(payload) => payload.nodeId`,
// or any reference to `.nodeId` within 200 chars of the subscription.
const HANDLER_NEAR_SUB_RE = /\.events\.on\s*\(\s*['"`]node-selected['"`]\s*,\s*(?:\([^)]*nodeId[^)]*\)|[^,)]*)\s*=>[\s\S]{0,200}/;
const USES_NODEID_KEY = /\bnodeId\b/.test(src);
assert.ok(USES_NODEID_KEY, "Inspector.tsx: must reference `nodeId` — the payload key for 'node-selected'");
// Negative: the handler must not read `.source` from the node-selected
// payload (that's the wrong convention for this event).
const BAD_PAYLOAD_RE = /\.events\.on\s*\(\s*['"`]node-selected['"`]\s*,\s*\([^)]*\bsource\b[^)]*\)\s*=>/;
assert.ok(
  !BAD_PAYLOAD_RE.test(src),
  "Inspector.tsx: the 'node-selected' handler must destructure `nodeId`, NOT `source` — editor-bridge.md pins the payload shape",
);

// ─── (D) selected node looked up from graph.nodes ──────────────────────
// graph.nodes is a flat array on the bridge; the lookup must iterate
// it (.find / .filter / for-of) keyed on `nodeId`. We accept any of
// those patterns.
const GRAPH_LOOKUP_RE = /\bgraph\.nodes\s*(?:\.find\s*\(|\.filter\s*\(|\[|\s*\)\s*\{|\.forEach\s*\()/;
const GRAPH_LOOKUP_ALT_RE = /\bgraph\b[\s\S]{0,200}?\bnodes\b[\s\S]{0,400}?\bnodeId\b/;
assert.ok(
  GRAPH_LOOKUP_RE.test(src) || GRAPH_LOOKUP_ALT_RE.test(src),
  "Inspector.tsx: must look up the selected node from the bridge's `graph.nodes` (a flat array) keyed on `nodeId` — e.g. `graph.nodes.find(n => n.nodeId === id)`",
);

// ─── (E) renders intent.caption ────────────────────────────────────────
const CAPTION_RE = /\bintent\??\.caption\b|\bintent\[['"]caption['"]\]/;
assert.ok(
  CAPTION_RE.test(src),
  "Inspector.tsx: must render `intent.caption` — the human-readable label is the Inspector's headline field",
);

// ─── (F) renders transform.x, .y, .z ───────────────────────────────────
for (const axis of ['x', 'y', 'z']) {
  const AXIS_RE = new RegExp(`\\btransform\\??\\.${axis}\\b|\\btransform\\[['"\`]${axis}['"\`]\\]`);
  assert.ok(
    AXIS_RE.test(src),
    `Inspector.tsx: must render \`transform.${axis}\` from the selected node's visual.transform`,
  );
}

// ─── (G) renders stateEffects ─────────────────────────────────────────
const STATE_EFFECTS_RE = /\bstateEffects\b/;
assert.ok(
  STATE_EFFECTS_RE.test(src),
  "Inspector.tsx: must render `intent.stateEffects` (the array of effect names like ['lift-hover', 'scale-press'])",
);

// ─── (H) no hardcoded mock-app nodeIds ────────────────────────────────
// Mirrors the anti-drift PreToolUse hook's pattern plus T-ED-02's
// explicit check, extended to nodeId string literals that might sneak
// in as dropdown options, fallback labels, etc.
const FORBIDDEN_ID_RE = /['"`](?:hero-(?:card|section)|navbar-(?:logo|link|signin|bg)|feature-(?:card|grid)|footer-(?:logo|link|social|bg|copyright)|stats-|settings-section|notifications-toggle|theme-selector|page-background|video-slot-\d)/;
assert.ok(
  !FORBIDDEN_ID_RE.test(src),
  "Inspector.tsx: contains a hardcoded mock-app nodeId string literal — editor code must be generic (read from window.__prism.graph.nodes). If this is a deliberate exception, add an `// ALLOWED-HARDCODED-ID: <reason>` marker — this test does NOT honor that marker; if you need one, narrow the pattern here",
);

// ─── (I) no import of the mock-graph-editor store / data ──────────────
// The old Inspector imported from `@/data/mockGraph` and the local
// Zustand store. Both must be gone — the Inspector now reads from the
// prism bridge only.
assert.ok(
  !/from\s+['"`]@\/data\/mockGraph['"`]/.test(src),
  "Inspector.tsx: must NOT import from `@/data/mockGraph` — the Inspector now reads the runtime graph from window.__prism",
);
assert.ok(
  !/from\s+['"`]@\/stores\/useGraphEditorStore['"`]/.test(src),
  "Inspector.tsx: must NOT import `useGraphEditorStore` — selection now flows from the 'node-selected' event on the shared bus, not a local store",
);

console.log('[T-ED-03] PASS — Inspector reads window.__prism bridge (A,B,C,D), renders intent.caption + transform.x/y/z + stateEffects (E,F,G), no hardcoded nodeIds or mock-graph imports (H,I)');
