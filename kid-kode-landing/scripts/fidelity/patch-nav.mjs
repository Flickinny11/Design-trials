// Wave 6 — Navigation / IA: make the Atelier discoverable + reachable everywhere,
// give s6 a full chrome shell (was a dead-end), register s6 structurally.
import { load, save, byId } from './lib.mjs';

const g = load();
const m = byId(g);
const set = (id, p, v) => {
  const n = m.get(id); if (!n) return false;
  const a = p.split('.'); let c = n;
  for (let i = 0; i < a.length - 1; i++) { if (c[a[i]] == null) c[a[i]] = {}; c = c[a[i]]; }
  c[a[a.length - 1]] = v; return true;
};
const clone = (o) => JSON.parse(JSON.stringify(o));

// Hub → nav-prefix and own-tab.
const HUBS = [
  { hub: 's1-arrival',  pre: 'shell',            own: 'arrival'  },
  { hub: 's2-movement', pre: 'shell-2_movement', own: 'movement' },
  { hub: 's3-materia',  pre: 'shell-3_materia',  own: 'materia'  },
  { hub: 's4-celestia', pre: 'shell-4_celestia', own: 'celestia' },
  { hub: 's5-acquire',  pre: 'shell-5_acquire',  own: 'acquire'  },
  { hub: 's6-atelier',  pre: 'shell-6_atelier',  own: 'atelier'  },
];
// 6-tab even spacing using the empty left zone; clear of the Reserve pill (x≈4.7+).
const TAB_X = { arrival: -3.3, movement: -1.95, materia: -0.6, celestia: 0.75, acquire: 2.1, atelier: 3.45 };
const TAB_LABEL = { arrival: 'Arrival', movement: 'Movement', materia: 'Materia', celestia: 'Celestia', acquire: 'Acquire', atelier: 'Atelier' };
const TAB_HUB = { arrival: 's1-arrival', movement: 's2-movement', materia: 's3-materia', celestia: 's4-celestia', acquire: 's5-acquire', atelier: 's6-atelier' };

// 1) Clone a full chrome shell onto s6 from s5 (s6 currently has zero chrome).
const s5shell = g.nodes.filter((n) => n.nodeId.startsWith('shell-5_acquire-'));
for (const src of s5shell) {
  const newId = src.nodeId.replace('shell-5_acquire-', 'shell-6_atelier-');
  if (m.has(newId)) continue;
  const c = clone(src);
  c.nodeId = newId;
  c.parentHubId = 's6-atelier';
  g.nodes.push(c);
  m.set(newId, c);
}

// 2) Re-space nav to 6 tabs on every hub + add the Atelier tab.
const nudgeNavBar = (pre) => {
  // widen the header bar already exists; nothing to resize (full-width cube).
};
for (const { pre, own } of HUBS) {
  nudgeNavBar(pre);
  const tabs = ['arrival', 'movement', 'materia', 'celestia', 'acquire'];
  for (const t of tabs) {
    const linkId = `${pre}-nav-${t}`;
    const hitId = `${pre}-nav-${t}-navhit`;
    set(linkId, 'scenePosition.x', TAB_X[t]);
    set(linkId, 'visual.transform.x', TAB_X[t]);
    set(linkId, 'textSpec.content', TAB_LABEL[t]); // 'The Movement' → 'Movement'
    set(hitId, 'scenePosition.x', TAB_X[t]);
    set(hitId, 'visual.transform.x', TAB_X[t]);
  }
  // Add the Atelier tab by cloning this hub's acquire link + hit.
  const srcLink = m.get(`${pre}-nav-acquire`);
  const srcHit = m.get(`${pre}-nav-acquire-navhit`);
  if (srcLink && !m.has(`${pre}-nav-atelier`)) {
    const l = clone(srcLink);
    l.nodeId = `${pre}-nav-atelier`;
    l.textSpec.content = 'Atelier';
    l.scenePosition.x = TAB_X.atelier; if (l.visual?.transform) l.visual.transform.x = TAB_X.atelier;
    l.functionBinding = { kind: 'navigate', hubId: 's6-atelier' };
    g.nodes.push(l); m.set(l.nodeId, l);
  }
  if (srcHit && !m.has(`${pre}-nav-atelier-navhit`)) {
    const h = clone(srcHit);
    h.nodeId = `${pre}-nav-atelier-navhit`;
    h.scenePosition.x = TAB_X.atelier; if (h.visual?.transform) h.visual.transform.x = TAB_X.atelier;
    h.functionBinding = { kind: 'navigate', hubId: 's6-atelier' };
    g.nodes.push(h); m.set(h.nodeId, h);
  }
  // Active-rule under this hub's own tab.
  const arc = m.get(`${pre}-nav-active-arc`);
  if (arc) { set(`${pre}-nav-active-arc`, 'scenePosition.x', TAB_X[own]); set(`${pre}-nav-active-arc`, 'visual.transform.x', TAB_X[own]); }
}

// 3) Landing: add a prominent 'ENTER THE ATELIER' CTA (≤1-action discoverability).
//    Split the bottom hero CTA row: Atelier (primary, left) + Reserve (right).
set('hero-cta-slab', 'scenePosition.x', 1.15);
set('hero-cta-slab', 'meshPrimitive.params.width', 3.0);
set('hero-cta-label', 'scenePosition.x', 1.15);
set('hero-cta-label', 'textSpec.content', 'RESERVE No.7');
if (!m.has('hero-atelier-slab')) {
  const slab = clone(m.get('hero-cta-slab'));
  slab.nodeId = 'hero-atelier-slab';
  slab.scenePosition.x = -1.95; if (slab.visual?.transform) slab.visual.transform.x = -1.95;
  slab.meshPrimitive.params.width = 3.2;
  // brighter brass = visually primary
  slab.materialSpec.baseColor = '#c79444';
  slab.materialSpec.emissiveIntensity = 0.34;
  slab.functionBinding = { kind: 'navigate', hubId: 's6-atelier' };
  g.nodes.push(slab); m.set(slab.nodeId, slab);
  const lab = clone(m.get('hero-cta-label'));
  lab.nodeId = 'hero-atelier-label';
  lab.scenePosition.x = -1.95; if (lab.visual?.transform) lab.visual.transform.x = -1.95;
  lab.textSpec.content = 'ENTER THE ATELIER';
  lab.functionBinding = { kind: 'navigate', hubId: 's6-atelier' };
  g.nodes.push(lab); m.set(lab.nodeId, lab);
}

// 4) Structural: register s6 in the hub registry + add nav/journey edges.
const root = Array.isArray(g.rootNodes) ? g.rootNodes[0] : g.rootNodes;
const reg = root?.hubRegistry;
if (reg && !reg.some((h) => h.hubId === 's6-atelier')) {
  reg.push({ hubId: 's6-atelier', role: 'atelier' });
}
g.edges = g.edges || [];
const addEdge = (s) => { if (!g.edges.includes(s) && !g.edges.some((e) => (e.from + '->' + e.to) === s)) g.edges.push(s); };
for (const { pre } of HUBS) addEdge(`${pre}-nav-atelier->s6-atelier`);
addEdge('orr-acquire-watch->s6-atelier');

save(g);
console.log('Nav/IA patched. nodes=', g.nodes.length, '| s6 chrome cloned:', g.nodes.filter((n) => n.nodeId.startsWith('shell-6_atelier-')).length);
