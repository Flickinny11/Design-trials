// Acceptance test for T-ED-04 — Inspector edits → mutate graph +
// re-apply on preview pane (§7).
//
// Ralph task T-ED-03 (iter 14) made the Inspector a read-only viewer
// subscribed to `window.__prism.events` 'node-selected' events. This
// task (T-ED-04) promotes transform.{x,y,z} to editable controls.
// Editing a field must write through to TWO places synchronously:
//
//   1. The live PixiJS container on the preview pane
//      (`window.__prism.nodes.get(nodeId).container`) — so the node
//      moves immediately.
//   2. The graph definition (`graph.nodes[].visual.transform`) — so
//      the next re-read / re-boot reflects the edit. T-ED-11 will
//      later persist those mutations to hub.json; this iteration does
//      NOT persist, only mutates in-memory.
//
// Acceptance contract (all required):
//
//   (A) Inspector.tsx renders THREE `<input>` controls for
//       transform.x, transform.y, transform.z. Each must be a React
//       controlled input — i.e. have a `value=` AND an `onChange=`
//       (or `onInput=`) handler. A regression back to the read-only
//       `<div>` surface from T-ED-03 fails here.
//
//   (B) The change handler parses the new value to a number (not a
//       string) before doing any mutation. We accept `parseFloat`,
//       `parseInt`, `Number(`, or the unary `+` coercion.
//
//   (C) The change handler reaches `window.__prism.nodes` (or an
//       alias for the bridge map) keyed by the selected nodeId, via
//       `nodes.get(...)` — the Map lookup API documented in
//       notes/editor-bridge.md:60. The result's `.container` must be
//       touched.
//
//   (D) Writing x/y to the container: the handler must set
//       `container.position.x` / `.position.y`, OR `container.x` /
//       `container.y` directly (PixiJS v8 exposes both). Writing z:
//       must set `container.zIndex` (not `container.z`, which does
//       not exist in PixiJS v8).
//
//   (E) The change handler mutates `graph.nodes`' matching entry's
//       `visual.transform.{x|y|z}`. We look for an assignment of the
//       form `...transform.x = ...` (or `.y`/`.z`) somewhere the
//       selected node object is in scope. This lets `applyLayout` /
//       a future re-boot pick up the new value — the whole point of
//       editing through the bridge rather than a side store.
//
//   (F) The file still satisfies the T-ED-03 invariants:
//         - `'use client'` pragma present
//         - subscribes via `.events.on('node-selected', ...)`
//         - references `intent.caption` and `stateEffects`
//       A regression that rips out the T-ED-03 surface is a fail.
//
//   (G) No hardcoded mock-app nodeIds leak in. Same FORBIDDEN_ID_RE
//       as T-ED-02/03 so the Inspector stays generic across hubs.
//
//   (H) No import of `@/data/mockGraph` / `useGraphEditorStore` — the
//       bridge remains the single source of selection + graph truth.
//
// Run with: node tests/editor/T-ED-04.test.mjs

import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, '..', '..');
const inspectorPath = resolve(kidKodeRoot, 'src/components/editor/panels/Inspector.tsx');

assert.ok(existsSync(inspectorPath), `Inspector.tsx not found at ${inspectorPath}`);

const src = readFileSync(inspectorPath, 'utf8');

// ─── (A) three controlled <input>s for transform.x / .y / .z ──────────
// A controlled input has both `value=` and `onChange=`/`onInput=` at
// the same element. The axes can appear in any order. We look for at
// least three distinct `<input ... />` elements whose surrounding
// context mentions `x`, `y`, `z` respectively.
const inputRe = /<input\b[^>]*?>/g;
const inputTags = src.match(inputRe) ?? [];
assert.ok(
  inputTags.length >= 3,
  `Inspector.tsx: expected at least 3 <input> elements for transform.{x,y,z}; found ${inputTags.length}`,
);
let controlledCount = 0;
for (const tag of inputTags) {
  const hasValue = /\bvalue\s*=/.test(tag);
  const hasHandler = /\b(?:onChange|onInput)\s*=/.test(tag);
  if (hasValue && hasHandler) controlledCount++;
}
assert.ok(
  controlledCount >= 3,
  `Inspector.tsx: expected at least 3 controlled <input> elements (each with value= AND onChange/onInput=); found ${controlledCount}`,
);

// Each axis must appear as an identifier near an input. We don't try
// to parse JSX — instead we look for all three axis tokens in the
// source, and ensure each one is associated with at least one
// transform.axis read or write.
for (const axis of ['x', 'y', 'z']) {
  const AXIS_RE = new RegExp(`\\btransform\\??\\.${axis}\\b`);
  assert.ok(
    AXIS_RE.test(src),
    `Inspector.tsx: must reference transform.${axis} somewhere (input binding + mutation)`,
  );
}

// ─── (B) handler parses numeric input before mutating ─────────────────
const NUMERIC_COERCE_RE = /\bparseFloat\s*\(|\bparseInt\s*\(|\bNumber\s*\(|(?<![\w.])\+(?=[a-zA-Z_$])/;
assert.ok(
  NUMERIC_COERCE_RE.test(src),
  "Inspector.tsx: the change handler must coerce the input string to a number (parseFloat / parseInt / Number() / unary +) before writing through — an uncoerced string would make container.position.x a string and break PixiJS layout math",
);

// ─── (C) reaches window.__prism.nodes.get(nodeId) ─────────────────────
// Accept any of:
//   window.__prism.nodes.get(
//   __prism.nodes.get(
//   bridge.nodes.get(
//   nodes.get(  (as long as `nodes` is reached from the bridge)
const NODES_GET_RE = /\bnodes\.get\s*\(/;
assert.ok(
  NODES_GET_RE.test(src),
  "Inspector.tsx: must look up the live PixiJS instance via `nodes.get(nodeId)` on the bridge (window.__prism.nodes is a Map<string, NodeInstance>)",
);
const CONTAINER_RE = /\.container\b/;
assert.ok(
  CONTAINER_RE.test(src),
  "Inspector.tsx: after nodes.get(nodeId), must access `.container` (the live PixiJS Container) to write position/zIndex",
);

// ─── (D) writes x/y to container.position (or container.x/.y), and z to container.zIndex ──
// We're looking for assignments like:
//   container.position.x = ...
//   container.position.set(...)
//   container.x = ...
//   instance.container.y = ...
// AND for z:
//   container.zIndex = ...
const WRITE_X_RE = /\.container\.(?:position\.)?x\s*=|\.container\.position\.set\s*\(/;
const WRITE_Y_RE = /\.container\.(?:position\.)?y\s*=|\.container\.position\.set\s*\(/;
const WRITE_Z_RE = /\.container\.zIndex\s*=/;
assert.ok(
  WRITE_X_RE.test(src),
  "Inspector.tsx: must write x to the live container (`container.position.x = ...`, `container.x = ...`, or `container.position.set(x, y)`)",
);
assert.ok(
  WRITE_Y_RE.test(src),
  "Inspector.tsx: must write y to the live container (`container.position.y = ...`, `container.y = ...`, or `container.position.set(x, y)`)",
);
assert.ok(
  WRITE_Z_RE.test(src),
  "Inspector.tsx: must write z to the live container via `container.zIndex = ...` (PixiJS v8 has no `container.z`)",
);

// ─── (E) mutates graph.nodes' matching entry's visual.transform ──────
// We look for an assignment to transform.x / .y / .z (without a
// preceding `container.`), which indicates the graph-side write. The
// T-ED-03 surface only READ transform.x/y/z; an assignment is new.
const MUTATE_TRANSFORM_RE = /(?<!container\.)(?<!container\.position\.)\btransform\.(?:x|y|z)\s*=(?!=)/;
assert.ok(
  MUTATE_TRANSFORM_RE.test(src),
  "Inspector.tsx: must mutate the graph node's `visual.transform.{x|y|z}` — the change handler has to write to the graph def as well as the container so applyLayout / re-boot reflects the edit",
);

// ─── (F) T-ED-03 invariants still hold ─────────────────────────────────
assert.ok(
  /^\s*['"`]use client['"`]\s*;?/m.test(src),
  "Inspector.tsx: 'use client' pragma must stay present (T-ED-03 invariant)",
);
assert.ok(
  /\.events\.on\s*\(\s*['"`]node-selected['"`]\s*,/.test(src),
  "Inspector.tsx: subscription to `events.on('node-selected', ...)` must remain (T-ED-03 invariant)",
);
assert.ok(
  /\bintent\??\.caption\b|\bintent\[['"]caption['"]\]/.test(src),
  "Inspector.tsx: must still render intent.caption (T-ED-03 invariant)",
);
assert.ok(
  /\bstateEffects\b/.test(src),
  "Inspector.tsx: must still render stateEffects (T-ED-03 invariant)",
);

// ─── (G) no hardcoded mock-app nodeIds ─────────────────────────────────
const FORBIDDEN_ID_RE = /['"`](?:hero-(?:card|section)|navbar-(?:logo|link|signin|bg)|feature-(?:card|grid)|footer-(?:logo|link|social|bg|copyright)|stats-|settings-section|notifications-toggle|theme-selector|page-background|video-slot-\d)/;
assert.ok(
  !FORBIDDEN_ID_RE.test(src),
  "Inspector.tsx: contains a hardcoded mock-app nodeId string literal — editor code must be generic (read from window.__prism.graph.nodes)",
);

// ─── (H) no mock-graph-editor imports ─────────────────────────────────
assert.ok(
  !/from\s+['"`]@\/data\/mockGraph['"`]/.test(src),
  "Inspector.tsx: must NOT import from `@/data/mockGraph`",
);
assert.ok(
  !/from\s+['"`]@\/stores\/useGraphEditorStore['"`]/.test(src),
  "Inspector.tsx: must NOT import `useGraphEditorStore`",
);

console.log('[T-ED-04] PASS — Inspector renders editable transform.x/y/z inputs (A), coerces numerics (B), writes to live container (C,D) AND graph.nodes transform (E), preserves T-ED-03 contract (F), stays generic (G,H)');
