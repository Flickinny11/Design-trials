#!/usr/bin/env node
// MASTERPIECE M-2 — SCHEMA-COMPLETENESS GATE (Task 4). Wired into
// `npm run verify` (verify:schema). Enforces that EVERY node's schema is
// complete + self-describing per PRISM-RUNTIME-SPEC NODE-REALIZATION: a cold,
// context-free model reading ONE node must comprehend the element — its type,
// role, appearance, behavior, and bindings — from the node alone. Regressions
// (a new node with a stub intent, a functionBinding invisible to the intent
// block, a text node with no content) fail the build.
//
// Rules (each violation lists the node id):
//   S1  identity      nodeId / subtype / serviceTag non-empty; parentHubId
//                     resolves to a real hub.
//   S2  placement     scenePosition present with numeric x/y/z.
//   S3  caption       intent.caption ≥ 40 chars (rich enough for a cold model;
//                     the m2-schema-sync derives context for thin stubs).
//   S4  behaviorSpec  all six arrays present (interactions / apiCalls /
//                     dataBindings / emits / listens / triggersDownstream).
//   S5  behavior      functionBinding ⇒ a matching behaviorSpec.interaction
//       coherence     (same do/target family) — the split a cold model would
//                     trip on. functionTiles ⇒ apiCalls non-empty when present.
//   S6  motion        animationBindings/cinematicPrimitives ⇒ intent.animationSpec
//       coherence     mirrors them (counts match).
//   S7  artifact      renderMode text ⇒ textSpec.content non-empty (mirrored in
//       coherence     visualSpec.textContent); mesh ⇒ meshUrl | meshPrimitive |
//                     codeRef; sprite/plane ⇒ visual.sourceAsset, OR a global
//                     overlay element carrying overlaySpec.imageUrl.
//   S8  contracts     intent.contracts.inputs/outputs are objects.
//
// Usage: node scripts/schema-completeness-gate.mjs [--json <out>] [--graph <path>]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const graphPath = argOf('--graph') ?? join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');
const jsonOut = argOf('--json');

const g = JSON.parse(readFileSync(graphPath, 'utf8'));
const hubIds = new Set(g.hubs.map((h) => h.hubId));
const failures = { S1: [], S2: [], S3: [], S4: [], S5: [], S6: [], S7: [], S8: [] };
const BEHAVIOR_KEYS = ['interactions', 'apiCalls', 'dataBindings', 'emits', 'listens', 'triggersDownstream'];

const fbFamily = (fb) =>
  ({ navigate: 'navigate-to-hub', overlay: 'open-overlay', configure: 'configure' }[fb.kind] ??
  `atelier-${fb.action ?? fb.kind}`);
const fbTarget = (fb) =>
  fb.kind === 'navigate' ? fb.hubId
  : fb.kind === 'overlay' ? fb.elementId
  : fb.kind === 'configure' ? `${fb.layer}:${fb.variant}`
  : 'orr-atelier-watch';

for (const n of g.nodes) {
  const id = n.nodeId ?? '(missing nodeId)';
  const intent = n.intent ?? {};

  // S1 identity. Global overlay elements are deliberately un-tethered
  // (parentHubId '') until the deferred `global` hub lands (WS-W4 decision —
  // the galaxy gate carries the same intentional WARN); everything else must
  // tether to a real hub.
  const tetherOk = hubIds.has(n.parentHubId) || (n.isGlobalElement === true && n.parentHubId === '');
  if (!n.nodeId || !n.subtype || !n.serviceTag || !tetherOk) failures.S1.push(id);

  // S2 placement
  const sp = n.scenePosition;
  if (!sp || [sp.x, sp.y, sp.z].some((v) => typeof v !== 'number' || Number.isNaN(v))) failures.S2.push(id);

  // S3 caption richness
  if (typeof intent.caption !== 'string' || intent.caption.trim().length < 40) failures.S3.push(id);

  // S4 behaviorSpec shape
  const bs = intent.behaviorSpec;
  if (!bs || BEHAVIOR_KEYS.some((k) => !Array.isArray(bs[k]))) failures.S4.push(id);

  // S5 behavior coherence
  if (n.functionBinding && bs && Array.isArray(bs.interactions)) {
    const want = { do: fbFamily(n.functionBinding), target: fbTarget(n.functionBinding) };
    const hit = bs.interactions.some((i) => i && i.do === want.do && i.target === want.target);
    if (!hit) failures.S5.push(id);
  } else if (n.functionBinding) {
    failures.S5.push(id);
  }
  if (Array.isArray(n.functionTiles) && n.functionTiles.length > 0 && (!bs || bs.apiCalls.length === 0)) {
    failures.S5.push(`${id} (functionTiles unmirrored)`);
  }

  // S6 motion coherence
  const motionCount = (n.animationBindings?.length ?? 0) + (n.cinematicPrimitives?.length ?? 0);
  if (motionCount > 0) {
    const spec = intent.animationSpec;
    const mirrored = (spec?.bindings?.length ?? 0) + (spec?.cinematicPrimitives?.length ?? 0);
    if (mirrored !== motionCount) failures.S6.push(id);
  }

  // S7 artifact coherence
  const rm = n.renderMode ?? 'sprite';
  if (rm === 'text') {
    const content = n.textSpec?.content?.trim();
    const mirrored = Array.isArray(intent.visualSpec?.textContent) && intent.visualSpec.textContent[0] === content;
    if (!content || !mirrored) failures.S7.push(id);
  } else if (rm === 'mesh') {
    if (!n.meshUrl && !n.meshPrimitive && !(typeof n.codeRef === 'string' && n.codeRef.length > 0)) failures.S7.push(id);
  } else if (rm === 'sprite' || rm === 'plane' || rm === 'parallax-plane') {
    const hasAsset = !!n.visual?.sourceAsset;
    const isOverlayCard = n.isGlobalElement === true && !!n.overlaySpec?.imageUrl;
    if (!hasAsset && !isOverlayCard) failures.S7.push(id);
  }

  // S8 contracts
  const c = intent.contracts;
  if (!c || typeof c.inputs !== 'object' || c.inputs === null || typeof c.outputs !== 'object' || c.outputs === null) {
    failures.S8.push(id);
  }
}

const RULES = {
  S1: 'identity (nodeId/subtype/serviceTag/parentHubId)',
  S2: 'placement (scenePosition numeric)',
  S3: 'caption richness (≥40 chars, cold-model comprehensible)',
  S4: 'behaviorSpec shape (six arrays)',
  S5: 'behavior coherence (functionBinding mirrored in interactions)',
  S6: 'motion coherence (bindings/cinematics mirrored in animationSpec)',
  S7: 'artifact coherence per renderMode',
  S8: 'contracts (inputs/outputs objects)',
};

let bad = 0;
for (const [rule, ids] of Object.entries(failures)) {
  const ok = ids.length === 0;
  if (!ok) bad += ids.length;
  console.log(`${ok ? '✓' : '✗'} ${rule} ${RULES[rule]} — ${ok ? 'PASS' : `${ids.length} FAIL`}${ok ? '' : `: ${ids.slice(0, 8).join(', ')}${ids.length > 8 ? ` (+${ids.length - 8})` : ''}`}`);
}
const summary = {
  graph: graphPath,
  nodes: g.nodes.length,
  failures: Object.fromEntries(Object.entries(failures).map(([k, v]) => [k, v])),
  pass: bad === 0,
};
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(summary, null, 2));
console.log(
  bad === 0
    ? `schema-completeness-gate: PASS — ${g.nodes.length}/${g.nodes.length} nodes self-describing (8 rules green)`
    : `schema-completeness-gate: FAIL — ${bad} violation(s) across ${Object.values(failures).filter((v) => v.length).length} rule(s)`,
);
process.exit(bad === 0 ? 0 : 1);
