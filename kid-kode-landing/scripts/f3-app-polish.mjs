#!/usr/bin/env node
// FINISH-F3 — shippable watch-app polish, applied THROUGH THE GRAPH.
// Deterministic + idempotent: reads public/prism-mock/home/live-graph.json,
// applies the audited premium/completeness fixes as data, writes it back.
// Every change here is app CONTENT authoring (Law 0: the graph is the app);
// no renderer code is touched by this script.
//
// Fix groups (audit: notes/FINISH-F3-SHIPPABLE-REPORT.md):
//   T1  float tilt-taming     — 21 float bindings ran at the primitive's ±6°
//                               default tilt (headlines/CTAs visibly askew).
//   T2  sub-scrim alignment   — scrims floated 0.4–0.85u BELOW their subheads
//                               (hard-edged empty bars); align + tighten.
//   T3  materia subhead lift  — sat behind the center plate frame.
//   T4  CTA lighting          — hero CTAs read mud-brown in the dim stage
//                               zone; warm emissive lift for legible brass.
//   T5  nameplate lighting    — same dim-zone fix for the materia nameplates.
//   T6  availability line     — too small/low-contrast for a price surface.
//   T7  atelier summary panel — flat matte box → smoked-glass card.
//   T8  typography            — Inter (grotesque, banned by the QA protocol)
//                               → Playfair Display (display serif: headlines,
//                               brand, feature titles) + Sora (everything
//                               else). Served by the font registry / outline
//                               endpoint — pure textSpec data.
//   T9  acquire flow          — RESERVE self-navigated (no-op), ENQUIRE had
//                               no binding, the arrival watch's overlay
//                               elementId didn't exist. Restore/author the 3
//                               global overlay elements + bindings.
//   T10 celestia CTA copy     — "Explore the complication" navigated to
//                               Acquire (copy/action mismatch).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const graphPath = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');
const g = JSON.parse(readFileSync(graphPath, 'utf8'));
const byId = new Map(g.nodes.map((n) => [n.nodeId, n]));
const log = [];
const touch = (msg) => log.push(msg);

// ── T1: float tilt taming ────────────────────────────────────────────────────
// Text, slabs and labels must never rock (±6° default read as broken layout);
// physical objects keep a subtle buoyancy.
const OBJECT_TILT = new Map([
  ['orr-arrival-watch', 1.2],
  ['orr-movement-watch', 1.2],
  ['orr-movement-tourbillon', 1.6],
  ['orr-materia-brass-plate', 0.6],
  ['orr-materia-sapphire-plate', 0.6],
  ['orr-materia-meteorite-plate', 0.6],
  ['orr-acquire-pedestal', 0.4],
  ['orr-acquire-watch', 1.0],
]);
for (const n of g.nodes) {
  for (const b of n.animationBindings ?? []) {
    if (b.primitive !== 'float') continue;
    b.params = b.params ?? {};
    if (b.params.tiltDeg === undefined) {
      b.params.tiltDeg = OBJECT_TILT.get(n.nodeId) ?? 0;
      touch(`T1 float tiltDeg=${b.params.tiltDeg} on ${n.nodeId}`);
    }
  }
}

// ── T2 + T3: subhead scrims + materia subhead ───────────────────────────────
// Lift the materia subhead clear of the center plate frame first, then seat
// every sub-scrim exactly behind its subhead line, sized to the line.
{
  // Authored subhead rows sat inside the headline's glyph band (the fade-up
  // loop used to displace them downward, masking it). Seat each a clear band
  // below its headline; materia also lifts clear of the center plate frame.
  const SUBHEAD_Y = [
    ['orr-movement-sub', 2.08, undefined],
    ['orr-materia-sub', 2.15, 0.5],
  ];
  for (const [id, y, z] of SUBHEAD_Y) {
    const sub = byId.get(id);
    if (!sub) continue;
    if (sub.scenePosition.y !== y || (z !== undefined && sub.scenePosition.z !== z)) {
      sub.scenePosition.y = y;
      if (z !== undefined) sub.scenePosition.z = z;
      if (sub.visual?.transform) { sub.visual.transform.y = y; if (z !== undefined) sub.visual.transform.z = z; }
      touch(`T3 subhead seated: ${id} y=${y}${z !== undefined ? ' z=' + z : ''}`);
    }
  }
}
// Arrival never had a sub-scrim — its subhead washes out whenever a bright
// nebula cloud drifts behind it. Clone the movement scrim (same subtype →
// same embedded-decoration role; content-atom counts unchanged).
if (!byId.has('orr-arrival-sub-scrim') && byId.get('orr-movement-sub-scrim')) {
  const clone = JSON.parse(JSON.stringify(byId.get('orr-movement-sub-scrim')));
  clone.nodeId = 'orr-arrival-sub-scrim';
  clone.parentHubId = 's1-arrival';
  clone.intent = { ...clone.intent, caption: 'Dark scrim behind the Arrival subhead for contrast over the drifting nebula.' };
  g.nodes.push(clone);
  byId.set(clone.nodeId, clone);
  touch('T2 orr-arrival-sub-scrim created (clone of the movement scrim)');
}
const SCRIM_FOR_SUB = [
  ['orr-arrival-sub-scrim', 'orr-arrival-sub'],
  ['orr-movement-sub-scrim', 'orr-movement-sub'],
  ['orr-materia-sub-scrim', 'orr-materia-sub'],
  ['orr-celestia-sub-scrim', 'orr-celestia-sub'],
];
for (const [scrimId, subId] of SCRIM_FOR_SUB) {
  const scrim = byId.get(scrimId);
  const sub = byId.get(subId);
  if (!scrim || !sub) continue;
  const fs = sub.textSpec?.fontSize ?? 0.16;
  const len = (sub.textSpec?.content ?? '').length;
  const w = Math.min(7.4, len * fs * 0.52 + 0.6);
  const h = fs + 0.24;
  scrim.scenePosition.x = sub.scenePosition.x;
  scrim.scenePosition.y = sub.scenePosition.y;
  scrim.scenePosition.z = Math.max(0.02, (sub.scenePosition.z ?? 0.25) - 0.06);
  if (scrim.meshPrimitive?.params) {
    scrim.meshPrimitive.params.width = +w.toFixed(2);
    scrim.meshPrimitive.params.height = +h.toFixed(2);
  }
  if (scrim.visual) {
    scrim.visual.alpha = 0.42;
    if (scrim.visual.transform) {
      scrim.visual.transform.x = sub.scenePosition.x;
      scrim.visual.transform.y = sub.scenePosition.y;
      scrim.visual.transform.width = +w.toFixed(2);
      scrim.visual.transform.height = +h.toFixed(2);
    }
  }
  touch(`T2 ${scrimId} seated behind ${subId} (y=${sub.scenePosition.y}, ${w.toFixed(2)}x${h.toFixed(2)}, alpha 0.42)`);
}
// The celestia body-copy scrim + acquire availability scrim: tighten alpha so
// they read as contrast bands, not boxes.
for (const id of ['orr-celestia-copy-scrim', 'orr-acquire-availability-scrim']) {
  const s = byId.get(id);
  if (s?.visual && s.visual.alpha > 0.46) {
    s.visual.alpha = 0.42;
    touch(`T2 ${id} alpha -> 0.42`);
  }
}
// Seat the celestia copy scrim to its two-line copy block (it over-covered).
{
  const scrim = byId.get('orr-celestia-copy-scrim');
  const copy = byId.get('orr-celestia-copy');
  if (scrim && copy?.textSpec) {
    const fs = copy.textSpec.fontSize ?? 0.12;
    const h = fs * 2.6 + 0.2;
    scrim.scenePosition.y = copy.scenePosition.y - fs * 0.7;
    if (scrim.meshPrimitive?.params) scrim.meshPrimitive.params.height = +h.toFixed(2);
    if (scrim.visual?.transform) { scrim.visual.transform.y = scrim.scenePosition.y; scrim.visual.transform.height = +h.toFixed(2); }
    touch(`T2 celestia copy scrim seated (h=${h.toFixed(2)})`);
  }
}

// ── T4: hero CTA hierarchy + lighting (mud-brown fix) ───────────────────────
// PRIMARY (the money action) = lit champagne brass, engraved dark label.
// SECONDARY = dark smoked slab with a light label — the same pairing the
// Acquire page's RESERVE/ENQUIRE row uses. Gives the twin hero CTAs real
// hierarchy instead of one conjoined amber band.
const PRIMARY_CTAS = ['hero-cta-slab', 'orr-celestia-cta-f4bcta-slab', 'orr-acquire-reserve-slab'];
for (const id of PRIMARY_CTAS) {
  const n = byId.get(id);
  if (!n?.materialSpec) continue;
  Object.assign(n.materialSpec, {
    baseColor: '#d8b25a',
    emissive: '#6a4a15',
    // Celestia sits in the dimmest stage zone — extra lift (advocate contrast nudge).
    emissiveIntensity: id === 'orr-celestia-cta-f4bcta-slab' ? 0.62 : 0.5,
    roughness: 0.16,
    envMapIntensity: id === 'orr-celestia-cta-f4bcta-slab' ? 1.85 : 1.7,
  });
  touch(`T4 primary CTA champagne brass: ${id}`);
}
{
  const sec = byId.get('hero-atelier-slab');
  if (sec?.materialSpec) {
    Object.assign(sec.materialSpec, {
      baseColor: '#101623',
      metalness: 0.3,
      roughness: 0.26,
      clearcoat: 0.9,
      clearcoatRoughness: 0.18,
      emissive: '#0c1322',
      emissiveIntensity: 0.22,
      envMapIntensity: 1.35,
    });
    touch('T4 secondary CTA smoked slab: hero-atelier-slab');
  }
  const secLabel = byId.get('hero-atelier-label');
  if (secLabel?.textSpec) {
    secLabel.textSpec.fill = { kind: 'solid', color: '#e9dfc4' };
    touch('T4 secondary CTA label -> light champagne text');
  }
}

// ── T5: materia nameplates ──────────────────────────────────────────────────
for (const n of g.nodes) {
  if (n.subtype === 'nameplate' && n.materialSpec) {
    n.materialSpec.emissiveIntensity = 0.75;
    n.materialSpec.envMapIntensity = Math.max(n.materialSpec.envMapIntensity ?? 1, 1.5);
    touch(`T5 nameplate lit: ${n.nodeId}`);
  }
}

// ── T6: acquire availability line ───────────────────────────────────────────
{
  const n = byId.get('orr-acquire-availability');
  if (n?.textSpec) {
    n.textSpec.fontSize = 0.096;
    n.textSpec.fill = { kind: 'solid', color: '#b7c1d2' };
    touch('T6 availability line 0.096 / #b7c1d2');
  }
}

// ── T7: atelier summary panel — smoked glass ────────────────────────────────
{
  const p = byId.get('orr-atelier-panel-glass');
  if (p?.materialSpec) {
    Object.assign(p.materialSpec, {
      baseColor: '#0b0f18',
      metalness: 0.2,
      roughness: 0.28,
      transmission: 0.35,
      ior: 1.5,
      thickness: 0.7,
      clearcoat: 0.9,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.25,
      emissive: '#0a1220',
      emissiveIntensity: 0.12,
      opacity: 0.94,
    });
    touch('T7 atelier summary panel -> smoked glass');
  }
}

// ── T8: typography (no grotesque anywhere) ──────────────────────────────────
const DISPLAY_SUBTYPES = new Set(['headline-text', 'brand-wordmark', 'footer-brand', 'feature-title']);
let toPlayfair = 0;
let toSora = 0;
for (const n of g.nodes) {
  if (!n.textSpec?.fontFamily) continue;
  const want = DISPLAY_SUBTYPES.has(n.subtype) ? 'Playfair Display' : 'Sora';
  if (n.textSpec.fontFamily !== want) {
    n.textSpec.fontFamily = want;
    if (want === 'Playfair Display') toPlayfair++; else toSora++;
  }
}
touch(`T8 typography: ${toPlayfair} -> Playfair Display, ${toSora} -> Sora`);

// ── T9: acquire flow — the three global overlay elements + bindings ─────────
const emptyIntent = (caption) => ({
  caption,
  behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
  stateEffects: [],
  visualSpec: { textContent: [], layers: [] },
  contracts: { inputs: {}, outputs: {} },
});
const globalOverlayNode = (nodeId, caption, overlaySpec) => ({
  nodeId,
  subtype: 'overlay-element',
  parentHubId: '',
  serviceTag: 'ui-overlay',
  visual: { transform: { x: 0, y: 0, width: 0.35, height: 0.35, z: 0 }, alpha: 1 },
  intent: emptyIntent(caption),
  codeRef: '',
  backendRef: null,
  // Schema-complete renderer fields (verify:prism renderer-graph check) even
  // though a global element never scene-mounts — it renders as the overlay.
  renderMode: 'sprite',
  depthMapUrl: null,
  meshUrl: null,
  cinematicPrimitives: [],
  scenePosition: { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
  isGlobalElement: true,
  overlaySpec,
});
// Retro-fit the renderer fields onto overlay elements created by an earlier
// run of this script (idempotent).
for (const id of ['orr-watch-detail-card', 'orr-acquire-reserve-card', 'orr-acquire-enquire-card']) {
  const n = byId.get(id);
  if (n && !n.renderMode) {
    Object.assign(n, {
      renderMode: 'sprite',
      depthMapUrl: null,
      meshUrl: null,
      cinematicPrimitives: [],
      scenePosition: { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
    });
    touch(`T9 renderer fields retro-fitted: ${id}`);
  }
}
const OVERLAY_ELEMENTS = [
  globalOverlayNode(
    'orr-watch-detail-card',
    'Holographic spec sheet for the ORRERY No.7 — opens as an overlay when the watch itself is clicked.',
    {
      kind: 'holographic-detail',
      title: 'ORRERY No.7',
      tagline: 'The planetary complication — a sky, machined.',
      imageUrl: '/prism-mock/orrery/refs/watch-hero.png',
      specs: [
        { label: 'Movement', value: 'Cal. OR-7 — flying tourbillon' },
        { label: 'Components', value: '311 · 27 jewels' },
        { label: 'Power reserve', value: '96 hours' },
        { label: 'Case', value: 'Meteorite · sapphire dome · 41 mm' },
        { label: 'Edition', value: 'Eleven made — one is yours' },
      ],
    },
  ),
  globalOverlayNode(
    'orr-acquire-reserve-card',
    'Reservation flow card — opened by the Acquire RESERVE action; states the commission terms and next step.',
    {
      kind: 'holographic-detail',
      title: 'Reserve № 7',
      tagline: 'A private commission, confirmed in Geneva.',
      imageUrl: '/prism-mock/orrery/refs/watch-hero.png',
      specs: [
        { label: 'Edition', value: 'One of eleven' },
        { label: 'Price', value: 'CHF 340,000' },
        { label: 'Deposit', value: 'CHF 34,000 — fully refundable' },
        { label: 'Delivery', value: '2027 · hand-delivered' },
        { label: 'Appointment', value: 'Rue du Rhône, Geneva' },
        { label: 'Next step', value: 'A curator replies within 24 hours' },
      ],
    },
  ),
  globalOverlayNode(
    'orr-acquire-enquire-card',
    'Concierge enquiry card — opened by the Acquire ENQUIRE action; how to reach the atelier.',
    {
      kind: 'holographic-detail',
      title: 'Speak with the Atelier',
      tagline: 'A curator answers within one day.',
      imageUrl: '/prism-mock/orrery/arrival/atelier-craft.png',
      specs: [
        { label: 'Email', value: 'atelier@orrery.ch' },
        { label: 'Telephone', value: '+41 22 555 0007' },
        { label: 'Visits', value: 'Geneva · by appointment' },
        { label: 'Hours', value: 'Mon–Fri · 9–18 CET' },
      ],
    },
  ),
];
for (const el of OVERLAY_ELEMENTS) {
  const existing = byId.get(el.nodeId);
  if (!existing) {
    g.nodes.push(el);
    byId.set(el.nodeId, el);
    touch(`T9 global overlay element added: ${el.nodeId}`);
  } else if (JSON.stringify(existing.overlaySpec) !== JSON.stringify(el.overlaySpec)) {
    existing.overlaySpec = el.overlaySpec;
    touch(`T9 overlaySpec refreshed: ${el.nodeId}`);
  }
}
// The arrival watch's authored overlay size clipped the spec sheet — give the
// card room for the hero image + five spec rows.
{
  const w = byId.get('orr-arrival-watch');
  if (w?.functionBinding?.kind === 'overlay') {
    w.functionBinding.size = { w: 0.34, h: 0.8 };
    touch('T9 watch detail overlay size -> 0.34 x 0.8');
  }
}
const bind = (ids, fb) => {
  for (const id of ids) {
    const n = byId.get(id);
    if (!n) continue;
    n.functionBinding = fb;
    touch(`T9 bind ${id} -> ${fb.kind}:${fb.elementId ?? fb.hubId}`);
  }
};
bind(['orr-acquire-reserve-slab', 'orr-acquire-reserve-label', 'orr-acquire-reserve-edge-f4bcta'], {
  kind: 'overlay',
  elementId: 'orr-acquire-reserve-card',
  size: { w: 0.34, h: 0.84 },
  anchor: { x: 0.5, y: 0.5 },
});
bind(['orr-acquire-enquire-slab', 'orr-acquire-enquire-label', 'orr-acquire-enquire-edge'], {
  kind: 'overlay',
  elementId: 'orr-acquire-enquire-card',
  size: { w: 0.32, h: 0.78 },
  anchor: { x: 0.5, y: 0.5 },
});

// ── T10: celestia CTA copy/action coherence ─────────────────────────────────
{
  const label = byId.get('orr-celestia-cta-f4bcta-label');
  if (label?.textSpec && /Explore the complication/i.test(label.textSpec.content ?? '')) {
    label.textSpec.content = 'Own the complication';
    touch('T10 celestia CTA copy -> "Own the complication" (action: Acquire)');
  }
}

// ── T13: remove the looping fade-up entrances ────────────────────────────────
// The binding player LOOPS every finite time-driver timeline (repeat(-1), by
// design — bindings.ts). A 'fade-up' entrance on the time driver therefore
// cycles forever: text fades in, snaps 0.9u down + transparent, fades in
// again. This was the "washed-out subhead", the "empty spec rail" (its copy
// was mid-cycle below it), and the flickering price. Hub navigation already
// provides entrance motion (curtain + camera dolly) — drop the loop.
for (const n of g.nodes) {
  if (!n.animationBindings) continue;
  const before = n.animationBindings.length;
  n.animationBindings = n.animationBindings.filter((b) => b.primitive !== 'fade-up');
  if (n.animationBindings.length !== before) touch(`T13 fade-up loop removed: ${n.nodeId}`);
}

// ── T11: small-text legibility over the animated nebula ─────────────────────
// Subheads ride over live cloud drift: brighter fill + a thin dark MSDF
// outline lifts them off any backdrop state. Footer fine-print gets a size
// and contrast bump (0.08 Sora rendered crunchy at ~10px).
for (const n of g.nodes) {
  if (n.subtype === 'subhead-text' && n.textSpec) {
    n.textSpec.fill = { kind: 'solid', color: '#e6eaf2' };
    n.textSpec.outline = { color: '#070a12', width: 0.1 };
    touch(`T11 subhead lifted: ${n.nodeId}`);
  }
  if ((n.subtype === 'footer-legal' || n.subtype === 'footer-social') && n.textSpec) {
    if (n.textSpec.fontSize < 0.09) n.textSpec.fontSize = 0.092;
    n.textSpec.fill = { kind: 'solid', color: '#a7b0c2' };
    touch(`T11 footer fine-print: ${n.nodeId}`);
  }
}

writeFileSync(graphPath, JSON.stringify(g, null, 2) + '\n');
console.log(log.map((l) => '  · ' + l).join('\n'));
console.log(`\nf3-app-polish: ${log.length} changes written to live-graph.json (${g.nodes.length} nodes)`);
