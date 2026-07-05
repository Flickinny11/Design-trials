#!/usr/bin/env node
// FINISH-F3 — MOBILE COMPOSITION, authored through the graph (responsiveScenePos).
//
// Design (paired with the GraphScene mobile preview camera at z=9.2):
//   frame: halfH ≈ 3.81u, halfW ≈ 1.76u (390x844, fov 45) → px/unit ≈ 111.
//   Header two-deck band y∈[2.84, 3.76]: brand row + full 6-link nav row.
//   Footer stacked band y∈[-2.88, -3.82]: brand / links / social / legal rows.
//   Content zone y∈[-2.8, +2.7]: each hub re-stacked for portrait, larger
//   relative type instead of a shrunken desktop composition. Unreadable-at-
//   any-fit single-line copy rows are decluttered (hidden) per device — their
//   content remains available in the overlay spec sheets.
//
// Deterministic + idempotent: every touched node gets an ABSOLUTE mobile pose;
// stale P5-era authored poses are overwritten. Prints any node left with a
// mobile override this script does not own.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const graphPath = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');
const g = JSON.parse(readFileSync(graphPath, 'utf8'));
const byId = new Map(g.nodes.map((n) => [n.nodeId, n]));
const touched = new Set();
let count = 0;

const M = (id, pose) => {
  const n = byId.get(id);
  if (!n) { console.warn('  !! missing node', id); return; }
  n.responsiveScenePos = { ...(n.responsiveScenePos ?? {}), mobile: pose };
  touched.add(id);
  count++;
};
const hide = (id) => M(id, { hidden: true });

// Scale/offset a multi-node assembly about an anchor to a target center.
const assembly = (ids, anchor, scale, target) => {
  for (const id of ids) {
    const n = byId.get(id);
    if (!n) { console.warn('  !! missing assembly node', id); continue; }
    const p = n.scenePosition ?? { x: 0, y: 0 };
    M(id, {
      x: +(target.x + (p.x - anchor.x) * scale).toFixed(3),
      y: +(target.y + (p.y - anchor.y) * scale).toFixed(3),
      scale,
    });
  }
};
const idsWhere = (pred) => g.nodes.filter(pred).map((n) => n.nodeId);

// ── Shell: header + footer, per hub ─────────────────────────────────────────
const HUBS = ['s1-arrival', 's2-movement', 's3-materia', 's4-celestia', 's5-acquire', 's6-atelier'];
const NAV_ORDER = ['arrival', 'movement', 'materia', 'celestia', 'acquire', 'atelier'];
const NAV_Y = 2.98;
const NAV_X0 = -1.4;
const NAV_STEP = 0.56;

for (const hub of HUBS) {
  const inHub = (pred) => g.nodes.filter((n) => n.parentHubId === hub && pred(n));
  const one = (subtype) => inHub((n) => n.subtype === subtype)[0];
  const fit = (node, width) => +(width / (node?.meshPrimitive?.params?.width ?? node?.visual?.transform?.width ?? width)).toFixed(3);

  const bar = one('app-header');
  if (bar) M(bar.nodeId, { x: 0, y: 3.26, scaleX: fit(bar, 4.44), scaleY: 2.0 });
  const rule = one('app-header-rule');
  if (rule) M(rule.nodeId, { x: 0, y: 2.74, scaleX: fit(rule, 4.44) });
  const brand = one('brand-wordmark');
  if (brand) M(brand.nodeId, { x: -1.05, y: 3.44, scale: 0.85 });

  // Nav links + their hit planes, one compact row.
  for (let i = 0; i < NAV_ORDER.length; i++) {
    const x = +(NAV_X0 + i * NAV_STEP).toFixed(3);
    const link = inHub((n) => n.subtype === 'nav-link' && n.nodeId.includes(`nav-${NAV_ORDER[i]}`))[0];
    if (link) M(link.nodeId, { x, y: NAV_Y, scale: 0.72 });
    const hitId = inHub((n) => /nav-hit/.test(n.subtype ?? '') && n.nodeId.includes(`nav-${NAV_ORDER[i]}-navhit`))[0];
    if (hitId) M(hitId.nodeId, { x, y: NAV_Y, scale: 0.72, scaleX: 0.76 });
  }
  const activeRule = inHub((n) => n.subtype === 'nav-active-rule')[0];
  if (activeRule) {
    const idx = HUBS.indexOf(hub);
    M(activeRule.nodeId, { x: +(NAV_X0 + idx * NAV_STEP).toFixed(3), y: 2.8, scale: 0.5 });
  }
  // Header CTA declutters on compact (Reserve lives in footer nav + Acquire).
  for (const n of inHub((x) => (x.subtype === 'cta-button' || x.subtype === 'cta-label') && /header-cta/.test(x.nodeId))) hide(n.nodeId);
  const brandHit = inHub((n) => /brandhit/.test(n.nodeId) && !/footer/.test(n.nodeId))[0];
  if (brandHit) M(brandHit.nodeId, { x: -1.05, y: 3.44, scale: 0.85 });

  // Footer band.
  const fbar = one('app-footer');
  if (fbar) M(fbar.nodeId, { x: 0, y: -3.22, scaleX: fit(fbar, 4.44), scaleY: 2.6 });
  const frule = one('app-footer-rule');
  if (frule) M(frule.nodeId, { x: 0, y: -2.72, scaleX: fit(frule, 4.44) });
  const fbrand = one('footer-brand');
  if (fbrand) M(fbrand.nodeId, { x: -1.25, y: -2.92, scale: 0.8 });
  const flinks = one('footer-links');
  if (flinks) M(flinks.nodeId, { x: 0, y: -3.16, scale: 0.78 });
  const fsocial = one('footer-social');
  if (fsocial) M(fsocial.nodeId, { x: 0, y: -3.38, scale: 0.8 });
  const flegal = one('footer-legal');
  if (flegal) M(flegal.nodeId, { x: 0, y: -3.58, scale: 0.72 });
  // Footer hit planes ride the links row.
  const fhits = inHub((n) => /-fhit$/.test(n.nodeId));
  fhits.forEach((n, i) => M(n.nodeId, { x: +(-0.9 + i * 0.6).toFixed(2), y: -3.16, scale: 0.8 }));
  const fbrandHit = inHub((n) => /footer-brand-brandhit/.test(n.nodeId))[0];
  if (fbrandHit) M(fbrandHit.nodeId, { x: -1.25, y: -2.92, scale: 0.8 });
}

// ── s1 Arrival ───────────────────────────────────────────────────────────────
M('orr-arrival-headline', { x: 0, y: 2.34, scale: 0.49 });
M('orr-arrival-sub', { x: 0, y: 1.88, scale: 0.45 });
M('orr-arrival-sub-scrim', { x: 0, y: 1.88, scale: 0.45 });
M('orr-arrival-watch', { x: 0, y: -0.5, scale: 0.85 });
M('hero-atelier-slab', { x: 0, y: -1.82, scale: 0.72 });
M('hero-atelier-label', { x: 0, y: -1.82, scale: 0.72 });
M('hero-cta-slab', { x: 0, y: -2.4, scale: 0.72 });
M('hero-cta-label', { x: 0, y: -2.4, scale: 0.72 });

// ── s2 Movement ──────────────────────────────────────────────────────────────
M('orr-movement-headline', { x: 0, y: 2.36, scale: 0.55 });
M('orr-movement-sub', { x: 0, y: 1.94, scale: 0.44 });
M('orr-movement-sub-scrim', { x: 0, y: 1.94, scale: 0.44 });
M('orr-movement-watch', { x: 0, y: 0.0, scale: 0.8 });
M('orr-movement-tourbillon', { x: -1.1, y: -1.45, scale: 0.75 });
// Single-line copy rows can never fit readable at 390px — declutter; the
// numbers live on in the watch detail card overlay.
hide('orr-movement-spec-strip');
hide('orr-movement-craft');
hide('orr-movement-spec-rail');
hide('orr-movement-spec-rail-edge');

// ── s3 Materia ───────────────────────────────────────────────────────────────
M('orr-materia-headline', { x: 0, y: 2.4, scale: 0.55 });
M('orr-materia-sub', { x: 0, y: 2.04, scale: 0.48 });
M('orr-materia-sub-scrim', { x: 0, y: 2.04, scale: 0.48 });
assembly(idsWhere((n) => n.nodeId.startsWith('orr-materia-sapphire')), { x: 0, y: -0.23 }, 0.52, { x: 0, y: 0.88 });
assembly(idsWhere((n) => n.nodeId.startsWith('orr-materia-brass')), { x: -3.85, y: -0.11 }, 0.5, { x: 0, y: -0.72 });
assembly(idsWhere((n) => n.nodeId.startsWith('orr-materia-meteorite')), { x: 3.85, y: -0.11 }, 0.45, { x: 0, y: -1.92 });
M('orr-materia-eyebrow', { x: 0, y: -2.26, scale: 0.7, hidden: true });
M('orr-materia-craft-title', { x: 0, y: -2.52, scale: 0.55 });

// ── s4 Celestia ──────────────────────────────────────────────────────────────
M('orr-celestia-headline', { x: 0, y: 2.38, scale: 0.55 });
M('orr-celestia-sub', { x: 0, y: 2.0, scale: 0.42 });
M('orr-celestia-sub-scrim', { x: 0, y: 2.0, scale: 0.42 });
M('orr-celestia-orrery', { x: 0, y: 0.15, scale: 0.48 });
M('orr-celestia-armillary', { x: 0, y: -0.2, scale: 0.55 });
M('orr-celestia-cta-f4bcta-slab', { x: 0, y: -1.85, scale: 0.7 });
M('orr-celestia-cta-f4bcta-label', { x: 0, y: -1.85, scale: 0.7 });
hide('orr-celestia-copy');
hide('orr-celestia-copy-scrim');

// ── s5 Acquire ───────────────────────────────────────────────────────────────
M('orr-acquire-eyebrow', { x: 0, y: 2.56, scale: 0.7 });
M('orr-acquire-headline', { x: 0, y: 2.2, scale: 0.44 });
M('orr-acquire-price', { x: 0, y: 1.6, scale: 0.75 });
M('orr-acquire-availability', { x: 0, y: 1.3, scale: 0.7 });
M('orr-acquire-availability-scrim', { x: 0, y: 1.45, scale: 0.75, scaleX: 1.35, scaleY: 0.55 });
M('orr-acquire-watch', { x: 0, y: -0.1, scale: 0.75 });
M('orr-acquire-pedestal', { x: 0, y: -1.22, scale: 0.7 });
M('orr-acquire-incl-eyebrow', { x: -0.95, y: -1.88, scale: 0.7 });
M('orr-acquire-incl-1', { x: -0.95, y: -2.08, scale: 0.62 });
M('orr-acquire-incl-2', { x: -0.95, y: -2.28, scale: 0.62 });
M('orr-acquire-incl-3', { x: -0.95, y: -2.48, scale: 0.62 });
M('orr-acquire-reserve-slab', { x: 0.85, y: -2.0, scale: 0.6 });
M('orr-acquire-reserve-label', { x: 0.85, y: -2.0, scale: 0.6 });
M('orr-acquire-reserve-edge-f4bcta', { x: 0.85, y: -2.17, scale: 0.6 });
M('orr-acquire-enquire-slab', { x: 0.85, y: -2.46, scale: 0.6 });
M('orr-acquire-enquire-label', { x: 0.85, y: -2.46, scale: 0.6 });
M('orr-acquire-enquire-edge', { x: 0.85, y: -2.63, scale: 0.6 });
hide('orr-acquire-assurance');

// ── s6 Atelier ───────────────────────────────────────────────────────────────
M('orr-atelier-headline', { x: 0, y: 2.52, scale: 0.5 });
M('orr-atelier-sub', { x: 0, y: 2.2, scale: 0.42 });
M('orr-atelier-watch', { x: 0.32, y: -1.3, scale: 0.55 });
assembly(
  ['orr-atelier-panel-glass', 'orr-atelier-price-eyebrow', 'orr-atelier-price', 'orr-atelier-summary', 'orr-atelier-reason', 'orr-atelier-btn-save', 'orr-atelier-btn-save-label', 'orr-atelier-btn-reset', 'orr-atelier-btn-reset-label'],
  { x: 3, y: 0.12 }, 0.44, { x: -1.0, y: -1.55 },
);
assembly(
  idsWhere((n) => n.parentHubId === 's6-atelier' && (n.subtype === 'atelier-swatch' || /orr-atelier-cat-.*-label$/.test(n.nodeId))),
  { x: -2.77, y: 0.225 }, 0.55, { x: -0.35, y: 0.95 },
);
M('orr-atelier-btn-flip', { x: 0.32, y: -2.3, scale: 0.7 });
M('orr-atelier-btn-flip-label', { x: 0.32, y: -2.3, scale: 0.7 });
M('orr-atelier-btn-explode', { x: 1.15, y: -2.3, scale: 0.7 });
M('orr-atelier-btn-explode-label', { x: 1.15, y: -2.3, scale: 0.7 });

// ── Report ───────────────────────────────────────────────────────────────────
const stale = g.nodes.filter((n) => n.responsiveScenePos?.mobile && !touched.has(n.nodeId));
for (const n of stale) console.warn('  ?? untouched pre-existing mobile override:', n.nodeId, JSON.stringify(n.responsiveScenePos.mobile));

writeFileSync(graphPath, JSON.stringify(g, null, 2) + '\n');
console.log(`f3-author-mobile: ${count} mobile poses authored across ${touched.size} nodes (${g.nodes.length} total)`);
