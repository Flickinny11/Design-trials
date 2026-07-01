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
// Embedded decoration — pure visual-support fragments inside a parent element.
// Kept in the runtime graph (Canvas/Preview build them) but collapsed out of the
// Galaxy overview, like ambient backgrounds. Mirrors galaxy-semantics.ts.
const EMBEDDED_DECORATION_SUBTYPES = new Set(['text-scrim', 'spec-rail-edge', 'panel-chrome']);
const EMBEDDED_DECORATION_RE = /(?:^|[-_])(scrim|chrome|underlay)$/i;

function roleFor(node) {
  const id = node.nodeId ?? node.id ?? '';
  const subtype = node.subtype ?? '';
  if (node.isGlobalElement || (!node.parentHubId && (!node.hubIds || node.hubIds.length === 0))) return 'global-overlay';
  if (subtype === 'nav-hit' || /(?:^|[-_])hit(?:$|[-_])/.test(subtype)) return 'hit-target';
  if (AMBIENT_BACKGROUND_RE.test(subtype) || AMBIENT_BACKGROUND_RE.test(id)) return 'ambient-background';
  if (EMBEDDED_DECORATION_SUBTYPES.has(subtype) || EMBEDDED_DECORATION_RE.test(subtype)) return 'embedded-decoration';
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

function ctaBase(id) {
  return String(id)
    .replace(/-(edge|slab|label)-f4bcta$/i, '')
    .replace(/-(slab|label|edge|button|button-secondary)$/i, '')
    .replace(/-f4bcta-(slab|label|edge)$/i, '-f4bcta');
}

function clusterSpecFor(node) {
  const id = node.nodeId ?? node.id ?? '';
  const subtype = node.subtype ?? '';
  const hubId = node.parentHubId ?? node.hubIds?.[0] ?? 'global';
  const atelier = id.match(/^orr-atelier-cat-([a-z0-9]+)-/i);
  if (atelier && (subtype === 'atelier-swatch' || subtype === 'atelier-text')) {
    return { key: `${hubId}:atelier:${atelier[1]}`, minSize: 2 };
  }
  const materia = id.match(/^orr-materia-([a-z0-9]+)-/i);
  if (
    materia &&
    /^(plate-frame-(rim|bevel|lip)|material-plate|nameplate|material-label)$/i.test(subtype)
  ) {
    return { key: `${hubId}:material:${materia[1]}`, minSize: 2 };
  }
  if (/^(cta-button|cta-button-secondary|cta-label|cta-edge)$/i.test(subtype)) {
    return { key: `${hubId}:cta:${ctaBase(id)}`, minSize: 2 };
  }
  if (/^orr-acquire-incl-/i.test(id)) {
    return { key: `${hubId}:included`, minSize: 2 };
  }
  if (/^orr-atelier-btn-/i.test(id)) {
    return { key: `${hubId}:atelier-controls`, minSize: 2 };
  }
  if (/^orr-atelier-(price|summary|reason|price-eyebrow)/i.test(id)) {
    return { key: `${hubId}:atelier-summary`, minSize: 2 };
  }
  // text-scrim / spec-rail-edge / panel-chrome are classified as
  // embedded-decoration and never reach the overview, so no support-layers cluster.
  return null;
}

function projectedNodesFor(list) {
  const entries = [];
  const buckets = new Map();
  for (const node of list) {
    const spec = clusterSpecFor(node);
    if (!spec) {
      entries.push(node);
      continue;
    }
    let bucket = buckets.get(spec.key);
    if (!bucket) {
      bucket = { spec, nodes: [] };
      buckets.set(spec.key, bucket);
      entries.push(bucket);
    }
    bucket.nodes.push(node);
  }
  return entries.flatMap((entry) => {
    if (entry.nodes) {
      return entry.nodes.length >= entry.spec.minSize
        ? [{ nodeId: `galaxy-cluster:${entry.spec.key}`, parentHubId: entry.nodes[0]?.parentHubId, clusterNodeIds: entry.nodes.map((node) => node.nodeId) }]
        : entry.nodes;
    }
    return [entry];
  });
}

const projectedNodes = projectedNodesFor(overviewNodes);

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

assert('galaxy:overview-projects-components', 'Galaxy first-level view groups dense component atoms', () => {
  const atelierCount = projectedNodes.filter((node) => node.parentHubId === 's6-atelier').length;
  const materiaCount = projectedNodes.filter((node) => node.parentHubId === 's3-materia').length;
  if (projectedNodes.length >= overviewNodes.length) {
    throw new Error(`projection did not reduce node count (${projectedNodes.length}/${overviewNodes.length})`);
  }
  if (projectedNodes.length > 64) {
    throw new Error(`projected first-level nodes still too high: ${projectedNodes.length}`);
  }
  if (atelierCount > 18) throw new Error(`atelier projected count too high: ${atelierCount}`);
  if (materiaCount > 12) throw new Error(`materia projected count too high: ${materiaCount}`);
  const clusterCount = projectedNodes.filter((node) => String(node.nodeId ?? '').startsWith('galaxy-cluster:')).length;
  if (clusterCount === 0) throw new Error('no component clusters projected');
  return `${projectedNodes.length} first-level nodes (${clusterCount} clusters) from ${overviewNodes.length} content atoms; atelier:${atelierCount}, materia:${materiaCount}`;
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

assert('galaxy:overview-excludes-decoration', 'embedded decoration (scrims, panel chrome, rail edges) is collapsed out of the overview — no "Support layers" spheres', () => {
  const decorationNodes = nodes.filter((node) => roleFor(node) === 'embedded-decoration');
  if (decorationNodes.length === 0) throw new Error('expected embedded-decoration nodes (scrims/chrome/edges) in current mock graph');
  const leaked = overviewNodes.filter((node) => EMBEDDED_DECORATION_SUBTYPES.has(node.subtype ?? '') || EMBEDDED_DECORATION_RE.test(node.subtype ?? ''));
  if (leaked.length) throw new Error(`decoration leaked into overview: ${leaked.map((n) => n.nodeId).slice(0, 12).join(', ')}`);
  const supportClusters = projectedNodes.filter((node) => String(node.nodeId ?? '').includes(':support-layers'));
  if (supportClusters.length) throw new Error(`support-layers cluster still projected: ${supportClusters.length}`);
  return `${decorationNodes.length} decoration nodes collapsed (${decorationNodes.map((n) => n.subtype).filter((v, i, a) => a.indexOf(v) === i).join(', ')}); 0 leaked into overview`;
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
