#!/usr/bin/env node
// MASTERPIECE M-2 — SCHEMA COMPREHENSION SYNC (Task 4). Deterministic +
// idempotent. Makes every node's `intent` block SELF-DESCRIBING for a cold
// AI model reading one node in isolation (the AI-builder readiness the
// founder named): many models will edit nodes concurrently by reading their
// schemas, so the intent block must carry the node's behavior and motion —
// not leave them split across sibling top-level fields the model may not
// know to look for.
//
// What it derives (all INSIDE intent, additive, re-derived on every run):
//   1. behaviorSpec.interactions ← functionBinding (navigate / overlay /
//      configure / atelier-action), tagged source:'functionBinding' so the
//      sync stays idempotent and hand-authored entries are never touched.
//   2. intent.animationSpec ← animationBindings + cinematicPrimitives
//      (primitive + driver/trigger summaries — how the element moves).
//   3. visualSpec.textContent ← textSpec.content for text nodes (what it says).
//   4. caption enrichment for thin captions (<40 chars): the authored stub is
//      KEPT as the first sentence and a derived, factual context sentence is
//      appended (subtype, hub, global-slot, text content, click behavior).
//      Deterministic — running twice yields byte-identical output.
//
// The schema-completeness gate (scripts/schema-completeness-gate.mjs)
// enforces the resulting invariants on every `npm run verify`.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const graphPath = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');
const g = JSON.parse(readFileSync(graphPath, 'utf8'));
const hubTitle = new Map(g.hubs.map((h) => [h.hubId, h.title]));

let interactions = 0;
let animSpecs = 0;
let textContents = 0;
let captions = 0;

/** functionBinding → one machine-comprehensible interaction entry. Carries
 *  BOTH the codebase-canonical `event`/`effect` pair (view-model.ts
 *  getInteractions renders these in the node editor's Behavior tab) and the
 *  richer `do`/`target`/`description` fields for cold-model comprehension. */
function bindingInteraction(fb) {
  const entry = (doVerb, target, description, params) => ({
    event: 'click',
    effect: `${doVerb}:${target}`,
    on: 'click',
    do: doVerb,
    target,
    ...(params ? { params } : {}),
    description,
    source: 'functionBinding',
  });
  switch (fb.kind) {
    case 'navigate':
      return entry('navigate-to-hub', fb.hubId, `Clicking navigates the app to the ${hubTitle.get(fb.hubId) ?? fb.hubId} page.`);
    case 'overlay':
      return entry('open-overlay', fb.elementId, `Clicking opens the global element "${fb.elementId}" as an overlay on the current page.`, { size: fb.size ?? null, anchor: fb.anchor ?? null });
    case 'configure':
      return entry('configure', `${fb.layer}:${fb.variant}`, `Clicking sets the watch configurator's "${fb.layer}" layer to the "${fb.variant}" variant.`);
    case 'atelier-action':
      return entry(`atelier-${fb.action}`, 'orr-atelier-watch', `Clicking triggers the configurator's "${fb.action}" action on the atelier watch.`);
    default:
      return entry(fb.kind, fb.hubId ?? fb.elementId ?? 'self', `Clicking performs the "${fb.kind}" binding.`);
  }
}

function behaviorPhrase(fb) {
  if (!fb) return '';
  if (fb.kind === 'navigate') return ` Clicking it navigates to the ${hubTitle.get(fb.hubId) ?? fb.hubId} page.`;
  if (fb.kind === 'overlay') return ` Clicking it opens the "${fb.elementId}" overlay.`;
  if (fb.kind === 'configure') return ` Clicking it sets the configurator's ${fb.layer} to "${fb.variant}".`;
  if (fb.kind === 'atelier-action') return ` Clicking it triggers the configurator's "${fb.action}" action.`;
  return '';
}

for (const n of g.nodes) {
  n.intent = n.intent ?? {};
  const intent = n.intent;
  intent.behaviorSpec = intent.behaviorSpec ?? {};
  const bs = intent.behaviorSpec;
  for (const k of ['interactions', 'apiCalls', 'dataBindings', 'emits', 'listens', 'triggersDownstream']) {
    if (!Array.isArray(bs[k])) bs[k] = [];
  }

  // 1 · interactions from functionBinding (idempotent: re-derive our entries)
  bs.interactions = bs.interactions.filter((i) => i?.source !== 'functionBinding');
  if (n.functionBinding) {
    bs.interactions.push(bindingInteraction(n.functionBinding));
    interactions++;
  }

  // 2 · intent.animationSpec mirrors the node's motion
  const bindings = (n.animationBindings ?? []).map((b) => ({
    primitive: b.primitive,
    driver: typeof b.driver === 'object' ? (b.driver?.kind ?? null) : (b.driver ?? null),
  }));
  const cinematics = (n.cinematicPrimitives ?? []).map((c) => ({ name: c.name, trigger: c.trigger ?? null }));
  if (bindings.length > 0 || cinematics.length > 0) {
    intent.animationSpec = { bindings, cinematicPrimitives: cinematics };
    animSpecs++;
  } else if (intent.animationSpec && intent.animationSpec.bindings) {
    // previously synced, now motion-free — clear our derived block
    delete intent.animationSpec;
  }

  // 3 · visualSpec.textContent mirrors what a text node says
  intent.visualSpec = intent.visualSpec ?? { textContent: [], layers: [] };
  const content = n.textSpec?.content?.trim();
  if ((n.renderMode ?? 'sprite') === 'text' && content) {
    if (!Array.isArray(intent.visualSpec.textContent) || intent.visualSpec.textContent[0] !== content || intent.visualSpec.textContent.length !== 1) {
      intent.visualSpec.textContent = [content];
      textContents++;
    }
  }

  // 4 · caption enrichment for thin captions — keep the authored stub, append
  // one factual derived sentence. Marked with " ⋄ " so re-runs replace only
  // the derived tail (idempotent).
  const MARK = ' ⋄ ';
  let base = intent.caption ?? '';
  const mi = base.indexOf(MARK);
  if (mi >= 0) base = base.slice(0, mi);
  if (base.trim().length < 40) {
    const hub = hubTitle.get(n.parentHubId) ?? n.parentHubId;
    const bits = [];
    bits.push(`A ${n.subtype} element on the ${hub} page`);
    if (n.globalSlot) bits.push(`pinned to the global app ${n.globalSlot}`);
    if (n.isGlobalElement) bits.push('a global overlay element (opened by other elements, not placed in a page)');
    if (content) bits.push(`reading "${content.length > 70 ? `${content.slice(0, 67)}...` : content}"`);
    if ((n.renderMode ?? 'sprite') === 'mesh') bits.push('rendered as a 3D mesh artifact');
    let derived = `${bits.join('; ')}.`;
    derived += behaviorPhrase(n.functionBinding);
    if (!n.functionBinding) derived += ' No click behavior.';
    intent.caption = `${base.trim()}${MARK}${derived}`;
    captions++;
  } else {
    intent.caption = base; // strip a stale derived tail if the base grew past 40
  }
}

writeFileSync(graphPath, JSON.stringify(g, null, 2) + '\n');
console.log(
  `m2-schema-sync: ${interactions} functionBinding interactions derived · ${animSpecs} animationSpec blocks · ${textContents} textContent mirrors · ${captions} captions enriched (of ${g.nodes.length} nodes)`,
);
