#!/usr/bin/env node
// Drop source-images/base/*.png files that don't correspond to a node in
// the current home-hub.json (and aren't the page-backdrop). Keeps the atlas
// build deterministic when the graph has been rewritten for a new mockup.
//
// Run: node scripts/cleanup-stale-sources.mjs
// Dry run: DRY=1 node scripts/cleanup-stale-sources.mjs

import { readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const graphPath = resolve(repoRoot, 'src', 'lib', 'prism', 'mock-app-source', 'hubs', 'home-hub.json');
const baseDir = resolve(repoRoot, 'src', 'lib', 'prism', 'mock-app-source', 'assets', 'source-images', 'base');
const DRY = process.env.DRY === '1';

const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
const allowed = new Set(graph.nodes.map((n) => n.visual.sourceAsset || n.nodeId));
allowed.add('page-backdrop');

const files = readdirSync(baseDir).filter((f) => f.endsWith('.png'));
let removed = 0, kept = 0;
for (const f of files) {
  const basename = f.replace(/\.png$/, '');
  if (allowed.has(basename)) { kept++; continue; }
  if (DRY) { console.log(`[cleanup] would remove: ${f}`); }
  else { unlinkSync(join(baseDir, f)); console.log(`[cleanup] removed: ${f}`); }
  removed++;
}
console.log(`[cleanup] kept ${kept}, ${DRY ? 'would-remove' : 'removed'} ${removed}`);
