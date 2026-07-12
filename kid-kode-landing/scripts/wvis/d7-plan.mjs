#!/usr/bin/env node
// W-VIS D7.1 — lane plan: per frozen case, (a) deterministic design
// criticality (hero <=2 seen iterations / standard <=1, OD11 budgets) via the
// PRODUCTION classifier, and (b) design-director preset SELECTIONS (D3
// contract: the director emits ids + optional overrides; the lane inlines the
// preset numbers). Director = Fable 5 on the founder CLI (design authorship
// is Fable/Opus-class per the signed table; the director is lane
// infrastructure, not a contestant) with the deterministic mood fallback if
// the CLI call fails. Output: notes/wvis/d7/plan.json (committed pre-run).

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT, WVIS, callClaudeCli } from './wvis-lib.mjs';

const require_ = createRequire(import.meta.url);
const esbuild = require_(path.join(ROOT, 'node_modules', 'esbuild'));

function importTs(entry, out) {
  esbuild.buildSync({ entryPoints: [path.join(ROOT, entry)], bundle: true, format: 'esm', platform: 'neutral', outfile: out, alias: { '@': path.join(ROOT, 'src') } });
  return import(pathToFileURL(out).href);
}
const presets = await importTs('src/lib/prism/design-presets/index.ts', '/tmp/wvis-presets.mjs');
const lane = await importTs('src/lib/prism/codegen/design-lane.ts', '/tmp/wvis-lane.mjs');

const D7 = path.join(WVIS, 'd7');
mkdirSync(D7, { recursive: true });
const CORPUS = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual', 'cases');
const cases = readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(readFileSync(path.join(CORPUS, f), 'utf8')));

// ── director call: Fable selects presets per case from the catalog digest ──
const digest = presets.buildPresetCatalogDigest();
const briefs = cases.map((c) => {
  const vs = c.node?.intent?.visualSpec ?? {};
  return `${c.caseId} [${c.category}] — ${c.node?.intent?.caption ?? c.title}. effects: ${String(vs.effects ?? '').slice(0, 160)}`;
}).join('\n');
const directorPrompt = [
  'You are the Prism DESIGN DIRECTOR. For each case below, select the best-fitting',
  'design presets from the catalog. Return STRICT JSON only (no fences):',
  '{ "selections": { "<caseId>": { "lightRig": "<id>", "cameraFraming": "<id>", "compositionLayout": "<id>" } } }',
  'Pick composition layouts whose span matches the case category (3d cases need 3d/both layouts).',
  '',
  digest,
  '',
  'CASES:',
  briefs,
].join('\n');

let selections = {};
let directorRoute = 'claude-cli:claude-fable-5';
let directorCostUsd = 0;
try {
  const r = await callClaudeCli({ model: 'claude-fable-5', system: null, user: directorPrompt, effort: 'low', timeoutMs: 300000 });
  directorCostUsd = r.costUsd ?? 0;
  let text = r.text.trim();
  if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  if (!text.startsWith('{')) { const s = text.indexOf('{'); const e = text.lastIndexOf('}'); if (s >= 0 && e > s) text = text.slice(s, e + 1); }
  selections = JSON.parse(text).selections ?? {};
} catch (err) {
  console.error(`director call failed (${String(err?.message ?? err).slice(0, 120)}) — falling back to deterministic mood selection`);
  directorRoute = 'deterministic-mood-fallback';
}

const plan = { plannedAt: new Date().toISOString(), directorRoute, directorCostUsd, cases: [] };
for (const c of cases) {
  const is3d = c.category === '3d';
  const criticality = lane.classifyDesignCriticality(c.node, is3d);
  let sel = selections[c.caseId];
  let selectionSource = 'director';
  const validated = sel ? presets.resolvePresetSelections(sel) : null;
  if (!sel || !validated || validated.unknownIds.length > 0 || !validated.lightRig || !validated.cameraFraming || !validated.compositionLayout) {
    sel = presets.selectPresetsByMood(is3d ? ['dramatic', 'product'] : ['editorial', 'quiet'], is3d);
    selectionSource = sel && selections[c.caseId] ? 'fallback-after-invalid-director-pick' : 'deterministic-mood-fallback';
  }
  // Span guard: a 2d case must not carry a pure-3d layout and vice versa.
  const layout = presets.getCompositionLayout(sel.compositionLayout);
  if (layout && layout.span !== 'both' && layout.span !== c.category) {
    const legal = presets.COMPOSITION_LAYOUTS.filter((l) => l.span === 'both' || l.span === c.category);
    sel = { ...sel, compositionLayout: legal[0]?.id };
    selectionSource += '+span-corrected';
  }
  plan.cases.push({ caseId: c.caseId, category: c.category, criticality, maxSeenIterations: criticality === 'hero' ? 2 : 1, presetSelections: sel, selectionSource });
}
writeFileSync(path.join(D7, 'plan.json'), JSON.stringify(plan, null, 2));
const heroes = plan.cases.filter((c) => c.criticality === 'hero').length;
console.log(`[d7-plan] ${plan.cases.length} cases planned — ${heroes} hero / ${plan.cases.length - heroes} standard; director=${directorRoute} ($${directorCostUsd.toFixed(2)} sub-equivalent)`);
for (const c of plan.cases) console.log(`  ${c.caseId} [${c.category}/${c.criticality}] rig=${c.presetSelections.lightRig} cam=${c.presetSelections.cameraFraming} layout=${c.presetSelections.compositionLayout} (${c.selectionSource})`);
