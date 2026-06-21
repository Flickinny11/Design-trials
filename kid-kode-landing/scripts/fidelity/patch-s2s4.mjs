// s2-movement + s4-celestia: dimensional brass titles + hero staging.
import { load, save, byId, brassExtrude } from './lib.mjs';

const g = load();
const m = byId(g);
const set = (id, p, v) => {
  const n = m.get(id); if (!n) { console.log('MISSING', id); return; }
  const a = p.split('.'); let c = n;
  for (let i = 0; i < a.length - 1; i++) { if (c[a[i]] == null) c[a[i]] = {}; c = c[a[i]]; }
  c[a[a.length - 1]] = v;
};
const brassTitle = (id) => {
  set(id, 'receivesLighting', true);
  set(id, 'textSpec.fill', { kind: 'texture', url: '/prism-mock/orrery/materia/brass-macro.png' });
  set(id, 'textSpec.glow', { color: '#ffe6a8', intensity: 0.16 });
  set(id, 'textSpec.extrude', brassExtrude({ faceFill: { kind: 'texture', url: '/prism-mock/orrery/materia/brass-macro.png' } }));
};

// s2-movement: title + bigger exposed calibre
brassTitle('orr-movement-headline');
set('orr-movement-tourbillon', 'scenePosition.scaleX', 0.85);
set('orr-movement-tourbillon', 'scenePosition.scaleY', 0.85);
set('orr-movement-tourbillon', 'scenePosition.scaleZ', 0.85);

// s4-celestia: title + bigger armillary hero; lift the CTA clear of it
brassTitle('orr-celestia-headline');
set('orr-celestia-armillary', 'scenePosition.scaleX', 1.35);
set('orr-celestia-armillary', 'scenePosition.scaleY', 1.35);
set('orr-celestia-armillary', 'scenePosition.scaleZ', 1.35);
set('orr-celestia-cta-f4bcta-slab', 'scenePosition.y', -1.5);
set('orr-celestia-cta-f4bcta-label', 'scenePosition.y', -1.5);

save(g);
console.log('s2 + s4 patched.');
