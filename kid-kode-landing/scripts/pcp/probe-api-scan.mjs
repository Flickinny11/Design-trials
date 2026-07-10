#!/usr/bin/env node
// W-PCP D6 — deterministic API-surface usage scan over the raw probe
// generations. Counts, per arm x model, how many outputs use the REAL
// runtime surface vs the W-BAKE crash-cluster spellings. Pure grep over
// committed run records → notes/pcp-probe/api-usage.json.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../bakeoff/contestants.mjs';

const PROBE = path.join(ROOT, 'notes', 'pcp-probe');
const RUNS = path.join(PROBE, 'runs');

// [marker, meaning, polarity] — polarity 'real' = documented surface,
// 'crash' = the W-BAKE crash-cluster guess it replaces.
const MARKERS = [
  ['ctx.textureLoader.loadTexture(', 'real texture loader', 'real'],
  ['ctx.textureLoader.load(', 'crash-prone .load( guess', 'crash'],
  ['ctx.glbLoader.loadGLB(', 'real GLB loader', 'real'],
  ['ctx.glbLoader.load(', 'crash-prone .load( guess', 'crash'],
  ['ctx.fontAtlas.createText(', 'real MSDF text call', 'real'],
  ['createTextMesh', 'hallucinated createTextMesh', 'crash'],
  ['config.textContent', 'data-driven copy reference', 'real'],
  ["from 'three/addons", 'disallowed addons import', 'crash'],
];

const out = {};
for (const arm of readdirSync(RUNS)) {
  for (const model of readdirSync(path.join(RUNS, arm))) {
    const lane = `${arm}--${model}`;
    const counts = Object.fromEntries(MARKERS.map(([m]) => [m, 0]));
    let n = 0;
    const dir = path.join(RUNS, arm, model);
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const rec = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
      if (!rec.ok) continue;
      n += 1;
      for (const [m] of MARKERS) if ((rec.output ?? '').includes(m)) counts[m] += 1;
    }
    out[lane] = { generations: n, counts };
  }
}
out._markers = MARKERS.map(([marker, meaning, polarity]) => ({ marker, meaning, polarity }));
writeFileSync(path.join(PROBE, 'api-usage.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
