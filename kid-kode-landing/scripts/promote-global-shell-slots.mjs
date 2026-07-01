#!/usr/bin/env node
// Promote exact repeated mock-app shell chrome into authored global slots.
//
// This is intentionally conservative: it only promotes a repeated shell/hit
// signature when every hub has an identical render payload apart from nodeId,
// parentHubId, and globalSlot. Page-specific variants such as active nav rules
// or the Atelier-shifted right-side nav/footer stay local.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const graphPath = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');

const args = new Set(process.argv.slice(2));
const write = args.has('--write');

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
  'cta-button',
  'cta-label',
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

function renderFingerprint(node) {
  const clone = JSON.parse(JSON.stringify(node));
  delete clone.nodeId;
  delete clone.parentHubId;
  delete clone.globalSlot;
  return JSON.stringify(clone);
}

function slotFor(node) {
  return (node.scenePosition?.y ?? 0) >= 0 ? 'header' : 'footer';
}

const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
const hubs = Array.isArray(graph.hubs) ? graph.hubs : [];
const hubOrder = new Map(hubs.map((hub, index) => [hub.hubId, index]));
const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];

const groups = new Map();
for (const node of nodes) {
  const signature = signatureFor(node);
  if (!signature) continue;
  const group = groups.get(signature) ?? [];
  group.push(node);
  groups.set(signature, group);
}

const promoted = [];
const skipped = [];

for (const [signature, group] of groups) {
  const hubIds = new Set(group.map((node) => node.parentHubId).filter(Boolean));
  if (hubIds.size !== hubs.length || group.length !== hubs.length) continue;

  const variants = new Set(group.map(renderFingerprint));
  if (variants.size !== 1) {
    skipped.push({ signature, reason: `${variants.size} render variants` });
    continue;
  }

  const canonical = [...group].sort((a, b) => {
    const ai = hubOrder.get(a.parentHubId) ?? Number.MAX_SAFE_INTEGER;
    const bi = hubOrder.get(b.parentHubId) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi || a.nodeId.localeCompare(b.nodeId);
  })[0];
  const slot = slotFor(canonical);
  if (canonical.globalSlot === slot) continue;
  canonical.globalSlot = slot;
  promoted.push({
    signature,
    nodeId: canonical.nodeId,
    slot,
    duplicatesCovered: group.length - 1,
  });
}

if (write && promoted.length) {
  writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`);
}

console.log(JSON.stringify({
  graphPath: graphPath.replace(`${repoRoot}/`, ''),
  write,
  promoted,
  skipped,
  promotedCount: promoted.length,
  duplicateNodesCovered: promoted.reduce((sum, item) => sum + item.duplicatesCovered, 0),
}, null, 2));
