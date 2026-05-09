#!/usr/bin/env node
// Renderer-era Prism artifact verification.

import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const prismPath = join(repoRoot, 'public', 'prism-assets', 'mock-app.prism');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const results = [];
function assert(id, description, fn) {
  try {
    const details = fn();
    results.push({ id, description, pass: true, details });
  } catch (e) {
    results.push({ id, description, pass: false, details: e.message });
  }
}

if (!existsSync(prismPath)) {
  results.push({
    id: 'prism:exists',
    description: '.prism artifact exists',
    pass: false,
    details: `not found at ${prismPath}`,
  });
} else {
  const zip = await JSZip.loadAsync(readFileSync(prismPath));
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  const graph = JSON.parse(await zip.file('graph.json').async('string'));
  const textEntries = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (!entry.dir && /\.(?:js|mjs|cjs|json|txt|fnt|css|html|map)$/.test(path)) {
      textEntries.push([path, await entry.async('string')]);
    }
  }

  assert('prism:manifest', 'manifest.json present + valid JSON', () => {
    if (!manifest.prismVersion) throw new Error('missing prismVersion');
    if (!Array.isArray(manifest.entries)) throw new Error('missing entries[]');
    return `prismVersion=${manifest.prismVersion}, entries=${manifest.entries.length}`;
  });

  assert('prism:renderer-graph', 'graph carries renderer-era node fields', () => {
    for (const node of graph.nodes ?? []) {
      if (!node.renderMode) throw new Error(`${node.nodeId}: missing renderMode`);
      if (!node.scenePosition) throw new Error(`${node.nodeId}: missing scenePosition`);
    }
    return `${graph.nodes.length} nodes`;
  });

  assert('prism:entryHub', 'entryHub matches first graph hub', () => {
    const entry = graph.hubs?.[0]?.hubId;
    if (manifest.entryHub !== entry) throw new Error(`manifest=${manifest.entryHub}, graph=${entry}`);
    return entry;
  });

  assert('prism:nodeCount', 'nodeCount matches graph nodes', () => {
    if (manifest.nodeCount !== graph.nodes.length) {
      throw new Error(`${manifest.nodeCount} != ${graph.nodes.length}`);
    }
    return `${graph.nodes.length}`;
  });

  assert('prism:artifactHash', 'artifactHash present + reproducible from manifest entries', () => {
    if (!/^[a-f0-9]{64}$/.test(manifest.artifactHash)) throw new Error('missing or malformed');
    const sorted = [...manifest.entries].sort((a, b) => a.path.localeCompare(b.path));
    const rollup = createHash('sha256').update(sorted.map((e) => `${e.path}:${e.sha256}`).join('\n')).digest('hex');
    if (rollup !== manifest.artifactHash) throw new Error(`recomputed ${rollup} != manifest ${manifest.artifactHash}`);
    return manifest.artifactHash.slice(0, 12) + '...';
  });

  assert('prism:assets', 'asset registry entries have sha256 + size', () => {
    for (const [path, meta] of Object.entries(manifest.assets ?? {})) {
      if (!/^[a-f0-9]{64}$/.test(meta.sha256)) throw new Error(`${path}: bad sha256`);
      if (typeof meta.size !== 'number' || meta.size <= 0) throw new Error(`${path}: bad size`);
    }
    return `${Object.keys(manifest.assets ?? {}).length} assets`;
  });

  assert('prism:no-pixi', 'artifact text entries contain zero Pixi references', () => {
    const hits = [];
    for (const [path, text] of textEntries) {
      if (/\bpixi\.js\b|\bpixi-filters\b|@pixi\/|\bPIXI\./i.test(text)) hits.push(path);
    }
    if (hits.length) throw new Error(hits.slice(0, 8).join(', '));
    return 'clean';
  });
}

const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
for (const r of results) {
  const tag = r.pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`[${tag}] ${r.id.padEnd(24)} ${r.description}`);
  if (r.details) console.log(`        ${DIM}${r.details}${RESET}`);
}
console.log('');
console.log(`${failed === 0 ? GREEN : RED}${passed}/${results.length} passed${RESET}`);
process.exit(failed === 0 ? 0 : 1);
