#!/usr/bin/env node
// Verify shared shell/global-slot semantics for the Prism root editor.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const graphPath = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');
const resolverPath = join(repoRoot, 'src', 'lib', 'prism-graph', 'assembled-nodes.ts');
const graphScenePath = join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const APP_SHELL_SUBTYPES = new Set([
  'app-header',
  'app-header-rule',
  'brand-wordmark',
  'nav-active-rule',
  'nav-link',
  'app-footer',
  'app-footer-rule',
  'footer-brand',
  'footer-legal',
  'footer-links',
  'footer-social',
]);

function roleFor(node) {
  const id = node.nodeId ?? '';
  const subtype = node.subtype ?? '';
  if (node.isGlobalElement || (!node.parentHubId && !node.globalSlot)) return 'global-overlay';
  if (subtype === 'nav-hit' || /(?:^|[-_])hit(?:$|[-_])/.test(subtype)) return 'hit-target';
  if (node.globalSlot || id.startsWith('shell-') || APP_SHELL_SUBTYPES.has(subtype)) return 'app-shell';
  return 'content';
}

function normalizeShellId(nodeId) {
  return String(nodeId).replace(/^shell-\d+_[a-z0-9]+-/i, 'shell-');
}

function signatureFor(node) {
  const role = roleFor(node);
  if (role !== 'app-shell' && role !== 'hit-target') return null;
  return `${role}:${node.subtype}:${normalizeShellId(node.nodeId)}`;
}

const results = [];
function assert(id, description, fn) {
  try {
    const detail = fn();
    results.push({ id, description, pass: true, detail });
  } catch (error) {
    results.push({ id, description, pass: false, detail: error.message });
  }
}
function warn(id, description, detail) {
  results.push({ id, description, pass: true, warn: true, detail });
}

assert('global-shell:files-present', 'global-slot resolver and root scene exist', () => {
  const missing = [resolverPath, graphScenePath, graphPath].filter((path) => !existsSync(path));
  if (missing.length) throw new Error(`missing: ${missing.map((path) => path.replace(repoRoot + '/', '')).join(', ')}`);
  return 'assembled-nodes.ts, GraphScene.tsx, live-graph.json';
});

const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
const hubs = Array.isArray(graph.hubs) ? graph.hubs : [];
const resolverSrc = readFileSync(resolverPath, 'utf8');
const graphSceneSrc = readFileSync(graphScenePath, 'utf8');

assert('global-shell:resolver-contract', 'resolver includes global slots and duplicate chrome suppression', () => {
  for (const token of [
    'isRenderableGlobalSlotNode',
    'getSharedChromeSignature',
    'hiddenDuplicateChromeIds',
    'resolveAssembledNodesForHub',
  ]) {
    if (!resolverSrc.includes(token)) throw new Error(`missing resolver token: ${token}`);
  }
  return 'resolver contract tokens present';
});

assert('global-shell:root-wired', 'root GraphScene uses assembled node scope, not editor-shell replacement', () => {
  if (!graphSceneSrc.includes('resolveAssembledNodesForHub')) {
    throw new Error('GraphScene does not call resolveAssembledNodesForHub');
  }
  if (!graphSceneSrc.includes('__PRISM_ASSEMBLED_NODE_SCOPE__')) {
    throw new Error('GraphScene missing assembled scope debug probe');
  }
  if (/EditorShellScene|components\/editor-shell/.test(graphSceneSrc)) {
    throw new Error('root GraphScene appears wired to editor-shell replacement path');
  }
  return 'root scene keeps existing runtime path';
});

assert('global-shell:graph-readable', 'live graph has page hubs and app nodes', () => {
  if (hubs.length < 2) throw new Error(`expected multiple hubs, found ${hubs.length}`);
  if (nodes.length < 30) throw new Error(`expected app nodes, found ${nodes.length}`);
  return `${hubs.length} hubs, ${nodes.length} nodes`;
});

const globalSlots = nodes.filter((node) => node.globalSlot === 'header' || node.globalSlot === 'footer');
assert('global-shell:slot-values', 'globalSlot values are header/footer only when present', () => {
  const invalid = nodes.filter((node) => node.globalSlot != null && node.globalSlot !== 'header' && node.globalSlot !== 'footer');
  if (invalid.length) throw new Error(`invalid globalSlot nodes: ${invalid.map((node) => node.nodeId).slice(0, 12).join(', ')}`);
  return `${globalSlots.length} renderable global slot nodes`;
});

const groups = new Map();
for (const node of nodes) {
  const signature = signatureFor(node);
  if (!signature) continue;
  const entry = groups.get(signature) ?? [];
  entry.push(node);
  groups.set(signature, entry);
}
const duplicateGroups = [...groups.values()].filter((group) => {
  const hubsForGroup = new Set(group.map((node) => node.parentHubId || ''));
  return group.length > 1 && hubsForGroup.size > 1;
});
const duplicateNodes = duplicateGroups.reduce((sum, group) => sum + group.length, 0);

if (globalSlots.length === 0) {
  warn(
    'global-shell:migration-pending',
    'current watch graph still duplicates shell chrome per page',
    `${duplicateGroups.length} repeated chrome signatures across ${duplicateNodes} nodes; resolver is ready for globalSlot migration`
  );
} else {
  assert('global-shell:global-slots-authored', 'global shell slots are authored in the graph', () => {
    return `${globalSlots.length} globalSlot nodes; duplicate chrome signatures remaining: ${duplicateGroups.length}`;
  });
}

for (const result of results) {
  const tag = result.warn
    ? `${YELLOW}WARN${RESET}`
    : result.pass
      ? `${GREEN}PASS${RESET}`
      : `${RED}FAIL${RESET}`;
  console.log(`[${tag}] ${result.id.padEnd(36)} ${result.description}`);
  if (result.detail) console.log(`        ${DIM}${result.detail}${RESET}`);
}

const failed = results.filter((result) => !result.pass).length;
console.log('');
console.log(`${failed === 0 ? GREEN : RED}${results.length - failed}/${results.length} passed${RESET}`);
process.exit(failed === 0 ? 0 : 1);
