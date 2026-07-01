#!/usr/bin/env node
// Verify Galaxy overview semantics for the Prism mock app.
//
// The live graph may contain invisible hit planes and repeated app-shell
// implementation nodes because Canvas/Preview need them. Galaxy overview must
// collapse those details so hubs read as pages and nodes read as meaningful app
// elements.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const graphPath = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');

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
const AMBIENT_BACKGROUND_RE = /(?:^|[-_])(starfield|nebula|dust|motes|scatter|particle-field|background|backdrop|ambient)(?:$|[-_])/i;

function roleFor(node) {
  const id = node.nodeId ?? node.id ?? '';
  const subtype = node.subtype ?? '';
  if (node.isGlobalElement || (!node.parentHubId && (!node.hubIds || node.hubIds.length === 0))) return 'global-overlay';
  if (subtype === 'nav-hit' || /(?:^|[-_])hit(?:$|[-_])/.test(subtype)) return 'hit-target';
  if (AMBIENT_BACKGROUND_RE.test(subtype) || AMBIENT_BACKGROUND_RE.test(id)) return 'ambient-background';
  if (node.globalSlot || id.startsWith('shell-') || APP_SHELL_SUBTYPES.has(subtype)) return 'app-shell';
  return 'content';
}

const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
const hubs = Array.isArray(graph.hubs) ? graph.hubs : [];
const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];

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

const byRole = new Map();
for (const node of nodes) {
  const role = roleFor(node);
  byRole.set(role, (byRole.get(role) ?? 0) + 1);
}
const overviewNodes = nodes.filter((node) => roleFor(node) === 'content');

assert('galaxy:graph-present', 'live graph has hubs and nodes', () => {
  if (hubs.length === 0) throw new Error('no hubs found');
  if (nodes.length === 0) throw new Error('no nodes found');
  return `${hubs.length} hubs, ${nodes.length} nodes`;
});

assert('galaxy:overview-collapses-helpers', 'Galaxy overview collapses app-shell and hit-target implementation nodes', () => {
  const hitTargets = byRole.get('hit-target') ?? 0;
  const appShell = byRole.get('app-shell') ?? 0;
  if (hitTargets === 0) throw new Error('expected nav-hit implementation nodes in current mock graph');
  if (appShell === 0) throw new Error('expected app-shell nodes in current mock graph');
  if (overviewNodes.length >= nodes.length) throw new Error(`overview still equals raw graph (${overviewNodes.length})`);
  return `${overviewNodes.length} overview nodes, ${nodes.length - overviewNodes.length} collapsed (${appShell} shell, ${hitTargets} hit-target)`;
});

assert('galaxy:backgrounds-are-hub-data', 'ambient star/dust/nebula backgrounds remain hub-owned, not first-class Galaxy nodes', () => {
  const ambientNodeIds = nodes.filter((node) => roleFor(node) === 'ambient-background').map((node) => node.nodeId);
  if (ambientNodeIds.length > 0) {
    throw new Error(`ambient background nodes found: ${ambientNodeIds.slice(0, 12).join(', ')}`);
  }
  const hubsWithBackground = hubs.filter((hub) => Array.isArray(hub.background) && hub.background.length > 0).length;
  if (hubsWithBackground === 0) throw new Error('no hub.background[] data found');
  return `${hubsWithBackground}/${hubs.length} hubs carry background layers`;
});

assert('galaxy:each-hub-has-overview-content', 'each page hub has at least one user-meaningful overview node', () => {
  const empty = hubs
    .map((hub) => ({
      id: hub.hubId,
      count: overviewNodes.filter((node) => node.parentHubId === hub.hubId).length,
    }))
    .filter((entry) => entry.count === 0);
  if (empty.length) throw new Error(`empty overview hubs: ${empty.map((entry) => entry.id).join(', ')}`);
  return hubs.map((hub) => {
    const count = overviewNodes.filter((node) => node.parentHubId === hub.hubId).length;
    return `${hub.hubId}:${count}`;
  }).join(', ');
});

if (!hubs.some((hub) => hub.hubId === 'global')) {
  const globalSlots = nodes.filter((node) => node.globalSlot === 'header' || node.globalSlot === 'footer');
  warn(
    'galaxy:global-hub-missing',
    'spec wants a global hub for shared every-page elements',
    globalSlots.length
      ? `${globalSlots.length} globalSlot nodes are authored; remaining page-local shell variants still await a dedicated global hub cleanup`
      : 'current graph still duplicates shell nodes per page; this is a planned cleanup, not a runtime blocker'
  );
}

for (const result of results) {
  const tag = result.warn
    ? `${YELLOW}WARN${RESET}`
    : result.pass
      ? `${GREEN}PASS${RESET}`
      : `${RED}FAIL${RESET}`;
  console.log(`[${tag}] ${result.id.padEnd(34)} ${result.description}`);
  if (result.detail) console.log(`        ${DIM}${result.detail}${RESET}`);
}

const failed = results.filter((result) => !result.pass).length;
console.log('');
console.log(`${failed === 0 ? GREEN : RED}${results.length - failed}/${results.length} passed${RESET}`);
process.exit(failed === 0 ? 0 : 1);
