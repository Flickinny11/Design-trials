// Acceptance test for T-ED-01 — Audit window.__prism API surface +
// document in notes/editor-bridge.md (§7).
//
// Spec ref: §7 (EDITOR INTEGRATION). Every editor component
// (src/components/editor/**) must drive off window.__prism generically;
// the anti-drift hook blocks hardcoded mock-app nodeIds. The contract
// for what editor code may read from that surface lives in
// notes/editor-bridge.md.
//
// As of iter 11, editor-bridge.md is a stub whose placeholder shape
// disagrees with what boot.ts actually exposes (e.g. it calls the field
// `hubRouter` while boot.ts globals it as `router`; it types
// `hiddenNodeIds` as a Set when it's an Array; it omits `shr`). T-ED-02..11
// will start reading the bridge — drift here will silently break those
// tasks. This test locks the audit to the actual code shape.
//
// Acceptance contract (the audit doc must satisfy ALL):
//
//   (A) Stub disclaimer is removed. The current top-of-file
//       "Status: stub. T-ED-01 will audit …" sentence must be gone —
//       its presence is the unambiguous tell that the audit was not
//       performed. No `to be written by T-ED-01`, `to be confirmed by
//       T-ED-01`, or `placeholder only` either.
//
//   (B) The TypeScript interface block declares the actual 8 fields
//       boot.ts hangs off window.__prism, with names matching the code:
//
//         router, viewport, events, graph, nodes, currentBreakpoint,
//         hiddenNodeIds, shr.
//
//       Each field must appear inside a fenced ```ts (or ```typescript)
//       interface declaration whose name ends with `Bridge` or `Handle`
//       (so editor code has a single named type to import / annotate).
//
//   (C) Field shapes line up with the code's exported types:
//
//         - nodes is `Map<string, NodeInstance>` (live PixiJS containers,
//           not graph nodes — the graph nodes live on `graph.nodes`).
//         - hiddenNodeIds is a `string[]` (Array, NOT Set — boot.ts
//           mutates it in place via .splice()).
//         - currentBreakpoint is the literal union 'desktop-wide' |
//           'desktop' | 'tablet' | 'mobile'.
//         - graph is `CompiledGraph` whose nodes is a flat array (not a
//           Map) — the editor that wants O(1) lookup by id should use
//           the runtime `nodes` Map for instances and build its own
//           lookup over `graph.nodes` for graph defs.
//
//   (D) `__prismBreakNode(nodeId)` is documented separately. It is hung
//       off `globalThis.__prismBreakNode`, NOT off `window.__prism.shr`
//       — this distinction is load-bearing: editor code that calls
//       `__prism.shr.breakNode(...)` works, code that calls
//       `__prism.__prismBreakNode(...)` does not.
//
//   (E) Doc cites the canonical source location with a `boot.ts` path
//       reference so a reader can open the file and verify (the audit
//       remains accountable when the surface drifts).
//
//   (F) Known events section lists at least the events the bus
//       currently emits — `active-section-changed`, `navigate`,
//       `node-click-failed`, `repair-started`, `repair-completed` —
//       so editor code can subscribe without grepping for emit calls.
//
//   (G) Gaps section identifies events / APIs the editor will need but
//       are NOT yet wired today: `node-selected` (T-ED-02 owns) and a
//       persistent write-back API (T-ED-11 owns) are the load-bearing
//       two; both must be named.
//
// Run with: node tests/editor/T-ED-01.test.mjs

import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, '..', '..');
const docPath = resolve(kidKodeRoot, 'notes/editor-bridge.md');
const bootPath = resolve(kidKodeRoot, 'src/lib/prism/player/boot.ts');

assert.ok(existsSync(docPath), `notes/editor-bridge.md not found at ${docPath}`);
assert.ok(existsSync(bootPath), `src/lib/prism/player/boot.ts not found at ${bootPath}`);

const doc = readFileSync(docPath, 'utf8');

// ─── (A) Stub disclaimer removed ─────────────────────────────────────
const STUB_TELLS = [
  /Status:\s*stub/i,
  /To\s+be\s+written\s+by\s+T-ED-01/i,
  /to\s+be\s+confirmed\s+by\s+T-ED-01/i,
  /placeholder\s+only/i,
  /T-ED-01\s+will\s+audit/i,
];
for (const re of STUB_TELLS) {
  assert.ok(
    !re.test(doc),
    `editor-bridge.md still contains stub disclaimer matching ${re} — the audit was not performed`,
  );
}

// ─── Extract the canonical interface block ───────────────────────────
// Must be inside a fenced ts / typescript code block, and must declare
// an interface whose name ends with Bridge or Handle.
const INTERFACE_BLOCK_RE = /```(?:ts|typescript)\b[\s\S]*?\binterface\s+([A-Za-z_][\w]*?(?:Bridge|Handle))\b[\s\S]*?\{([\s\S]*?)\}\s*[\s\S]*?```/;
const blockMatch = doc.match(INTERFACE_BLOCK_RE);
assert.ok(
  blockMatch,
  'editor-bridge.md must contain a fenced ```ts (or ```typescript) block declaring an interface whose name ends with Bridge or Handle',
);
const interfaceName = blockMatch[1];
const interfaceBody = blockMatch[2];
assert.ok(interfaceBody.trim().length > 0, `interface ${interfaceName} body is empty`);

// ─── (B) All 8 actual fields are present in the interface block ──────
const REQUIRED_FIELDS = [
  'router',
  'viewport',
  'events',
  'graph',
  'nodes',
  'currentBreakpoint',
  'hiddenNodeIds',
  'shr',
];
for (const field of REQUIRED_FIELDS) {
  // Field declaration: optional whitespace, field name, optional ?, colon.
  const fieldRe = new RegExp(`(^|[\\n;{,])\\s*${field}\\s*\\??\\s*:`, 'm');
  assert.ok(
    fieldRe.test(interfaceBody),
    `interface ${interfaceName}: missing field declaration for "${field}" (boot.ts:313 hangs it off window.__prism)`,
  );
}

// Negative — the stub used `hubRouter`; the actual field is `router`.
// Catch the regression where someone copies the stub forward.
assert.ok(
  !/(^|[\n;{,])\s*hubRouter\s*\??\s*:/.test(interfaceBody),
  `interface ${interfaceName}: field is named \`router\`, not \`hubRouter\` (drift from boot.ts:313)`,
);

// ─── (C) Field shapes line up with exported code types ───────────────
// nodes is a Map<string, NodeInstance>
assert.ok(
  /\bnodes\s*\??\s*:\s*Map\s*<\s*string\s*,\s*NodeInstance\b/.test(interfaceBody),
  `interface ${interfaceName}: nodes must be typed Map<string, NodeInstance> (live runtime instances, not graph defs)`,
);
// hiddenNodeIds is string[] (Array — boot.ts mutates via .splice).
assert.ok(
  /\bhiddenNodeIds\s*\??\s*:\s*(?:string\s*\[\]|Array\s*<\s*string\s*>|ReadonlyArray\s*<\s*string\s*>)/.test(interfaceBody),
  `interface ${interfaceName}: hiddenNodeIds must be string[] / Array<string> (boot.ts uses .splice — NOT a Set)`,
);
// Negative — Set<string> is a regression (the stub had it).
assert.ok(
  !/\bhiddenNodeIds\s*\??\s*:\s*Set\s*<\s*string\s*>/.test(interfaceBody),
  `interface ${interfaceName}: hiddenNodeIds is NOT Set<string> — boot.ts mutates it as an Array via .splice`,
);
// currentBreakpoint is the literal union.
assert.ok(
  /\bcurrentBreakpoint\s*\??\s*:\s*(?:BreakpointName\b|(?:'(?:desktop-wide|desktop|tablet|mobile)'\s*\|\s*){3}'(?:desktop-wide|desktop|tablet|mobile)')/.test(interfaceBody),
  `interface ${interfaceName}: currentBreakpoint must be BreakpointName or the literal union 'desktop-wide' | 'desktop' | 'tablet' | 'mobile'`,
);
// graph is CompiledGraph (the type exported from prism-loader.ts).
assert.ok(
  /\bgraph\s*\??\s*:\s*CompiledGraph\b/.test(interfaceBody),
  `interface ${interfaceName}: graph must be typed CompiledGraph (from prism-loader.ts) — not a hand-rolled inline shape`,
);

// ─── (D) __prismBreakNode is documented separately ───────────────────
assert.ok(
  /__prismBreakNode\b/.test(doc),
  'editor-bridge.md: must document __prismBreakNode (the SHR demo dev-tool from §9)',
);
// Distinction: __prismBreakNode is hung off globalThis, not off window.__prism.
assert.ok(
  /__prismBreakNode[\s\S]{0,400}\b(globalThis|window)\b/.test(doc) ||
  /\b(globalThis|window)\b[\s\S]{0,400}__prismBreakNode/.test(doc),
  'editor-bridge.md: __prismBreakNode is hung off globalThis/window directly — must be documented as separate from __prism (not __prism.__prismBreakNode)',
);
// Editor code path through __prism: shr.breakNode(...).
assert.ok(
  /shr\.breakNode\b/.test(doc),
  'editor-bridge.md: must surface the editor-side path `__prism.shr.breakNode(nodeId)` — symmetric to the global __prismBreakNode',
);

// ─── (E) Cites canonical boot.ts source ──────────────────────────────
assert.ok(
  /src\/lib\/prism\/player\/boot\.ts\b/.test(doc),
  'editor-bridge.md: must cite src/lib/prism/player/boot.ts as the canonical source of truth',
);

// ─── (F) Known events list — at least the bus events emitted today ───
const KNOWN_EVENTS = [
  'active-section-changed',
  'navigate',
  'node-click-failed',
  'repair-started',
  'repair-completed',
];
for (const ev of KNOWN_EVENTS) {
  // Event names use hyphens / colons; allow them inside backticks or quotes.
  const evRe = new RegExp(`['\`"]${ev.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}['\`"]`);
  assert.ok(
    evRe.test(doc),
    `editor-bridge.md: must list bus event '${ev}' in the Known events section`,
  );
}

// ─── (G) Gaps section names node-selected + persistent write-back ────
// Find a Gaps / Missing / Not-yet-exposed section.
const GAPS_HEADING_RE = /^##+\s+(?:Gaps?|Not\s+yet\s+exposed|Missing|Open\s+gaps?)\b/im;
assert.ok(
  GAPS_HEADING_RE.test(doc),
  'editor-bridge.md: must contain a Gaps / Not-yet-exposed section (audit deliverable per task description)',
);
// node-selected is the T-ED-02 dependency.
assert.ok(
  /\bnode-selected\b/.test(doc),
  'editor-bridge.md: must flag `node-selected` as a needed-but-not-yet-wired event (T-ED-02 owns)',
);
// Write-back / persistence path is the T-ED-11 dependency.
assert.ok(
  /\bT-ED-11\b/.test(doc) ||
  /write[-\s]?back\b/i.test(doc) ||
  /persist(?:ence)?\s+API\b/i.test(doc),
  'editor-bridge.md: must flag the persistent write-back API as a gap (T-ED-11 owns)',
);

console.log('[T-ED-01] PASS — editor-bridge.md audit complete: interface (A-C), __prismBreakNode (D), boot.ts cite (E), known events (F), gaps (G)');
