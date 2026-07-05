// Advocate Gate-3 fix round — addresses every ANNOYED verdict.
import { load, save, byId } from './lib.mjs';

const g = load();
const m = byId(g);
const set = (id, p, v) => {
  const n = m.get(id); if (!n) { console.log('MISS', id); return; }
  const a = p.split('.'); let c = n;
  for (let i = 0; i < a.length - 1; i++) { if (c[a[i]] == null) c[a[i]] = {}; c = c[a[i]]; }
  c[a[a.length - 1]] = v;
};
const move = (id, x, y, z) => {
  if (x != null) { set(id, 'scenePosition.x', x); set(id, 'visual.transform.x', x); }
  if (y != null) { set(id, 'scenePosition.y', y); set(id, 'visual.transform.y', y); }
  if (z != null) { set(id, 'scenePosition.z', z); set(id, 'visual.transform.z', z); }
};

// ── s1: stop the hero watch occluding the type; ensure CTA labels legible ──
set('orr-arrival-watch', 'scenePosition.scaleX', 2.35);
set('orr-arrival-watch', 'scenePosition.scaleY', 2.35);
set('orr-arrival-watch', 'scenePosition.scaleZ', 2.35);
set('orr-arrival-watch', 'scenePosition.y', -0.75);
move('orr-arrival-sub', null, 1.62, null);
set('hero-cta-label', 'textSpec.fontSize', 0.17);
set('hero-atelier-label', 'textSpec.fontSize', 0.17);

// ── s2: watch off the subhead; brighten the dim closing caption ──
set('orr-movement-watch', 'scenePosition.scaleX', 1.5);
set('orr-movement-watch', 'scenePosition.scaleY', 1.5);
set('orr-movement-watch', 'scenePosition.scaleZ', 1.5);
set('orr-movement-watch', 'scenePosition.y', -0.35);
move('orr-movement-sub', null, 2.34, null);
set('orr-movement-craft', 'textSpec.fill', { kind: 'solid', color: '#c4ccd8' });

// ── s3: make the depth UNMISTAKABLE + fix the meteorite white-card + bigger title ──
// extra z-spread on top of the existing stagger (whole-cluster translate, no shear)
const extraDz = { brass: -0.45, sapphire: 0.28, meteorite: -0.45 };
for (const node of g.nodes) {
  if (node.parentHubId !== 's3-materia') continue;
  for (const mat of ['brass', 'sapphire', 'meteorite']) {
    if (node.nodeId.startsWith(`orr-materia-${mat}-`)) {
      const pz = +(node.scenePosition.z + extraDz[mat]).toFixed(3);
      node.scenePosition.z = pz; if (node.visual?.transform) node.visual.transform.z = pz;
      break;
    }
  }
}
// meteorite plate: swap white-bg plate render for the dark macro texture (match siblings)
set('orr-materia-meteorite-plate', 'visual.sourceAsset', '/prism-mock/orrery/materia/meteorite-macro.png');
set('orr-materia-headline', 'textSpec.fontSize', 0.74);
move('orr-materia-headline', null, 2.62, null);

// ── s4: fix the broken see-through final 'a' — solid brass fill (no texture-UV path) ──
set('orr-celestia-headline', 'textSpec.fill', { kind: 'solid', color: '#d8bd72' });
set('orr-celestia-headline', 'textSpec.extrude.faceFill', { kind: 'solid', color: '#d8bd72' });

// ── s5: RESERVE = clean primary matching ENQUIRE; lift the row out of the warp zone ──
set('orr-acquire-reserve-slab', 'meshPrimitive.params.depth', 0.16);
set('orr-acquire-reserve-slab', 'meshPrimitive.params.width', 2.7);
set('orr-acquire-reserve-slab', 'meshPrimitive.params.height', 0.56);
set('orr-acquire-reserve-slab', 'materialSpec.emissiveIntensity', 0.2);
set('orr-acquire-reserve-label', 'textSpec.content', 'RESERVE');
set('orr-acquire-reserve-label', 'textSpec.fontSize', 0.16);
for (const id of ['orr-acquire-reserve-slab','orr-acquire-reserve-label','orr-acquire-reserve-edge-f4bcta','orr-acquire-enquire-slab','orr-acquire-enquire-label','orr-acquire-enquire-edge']) {
  const n = m.get(id); if (!n) continue;
  n.scenePosition.y += 0.45; if (n.visual?.transform) n.visual.transform.y = (n.visual.transform.y ?? 0) + 0.45;
}

// ── s6: 'THE ATELIER' → true liquid glass (advocate wants glass, not flat brass) ──
set('orr-atelier-headline', 'textSpec.fill', { kind: 'solid', color: '#f3ead2' });
set('orr-atelier-headline', 'textSpec.glow', { color: '#ffe6a8', intensity: 0.26 });
set('orr-atelier-headline', 'textSpec.extrude', {
  enabled: true, depth: 0.2, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.02,
  bevelSegments: 3, curveSegments: 14, transmission: 0.9, ior: 1.5, thickness: 0.2,
  clearcoat: 1, clearcoatRoughness: 0.06, dispersion: 0.3, roughness: 0.05, metalness: 0,
  sideFill: { kind: 'solid', color: '#d8c69a' },
});

save(g);
console.log('Fix round 1 applied. nodes=', g.nodes.length);
