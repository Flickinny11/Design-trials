// s6-atelier: currency consistency + dimensional brass title (house style).
import { load, save, byId, brassExtrude } from './lib.mjs';

const g = load();
const m = byId(g);
const set = (id, p, v) => {
  const n = m.get(id); if (!n) { console.log('MISSING', id); return; }
  const a = p.split('.'); let c = n;
  for (let i = 0; i < a.length - 1; i++) { if (c[a[i]] == null) c[a[i]] = {}; c = c[a[i]]; }
  c[a[a.length - 1]] = v;
};

// Initial static price string aligns with the CHF formatter (applier overrides live).
set('orr-atelier-price', 'textSpec.content', 'CHF 38,000');

// Title → dimensional extruded brass (was flat cool-white, off house style).
set('orr-atelier-headline', 'receivesLighting', true);
set('orr-atelier-headline', 'textSpec.fill', { kind: 'texture', url: '/prism-mock/orrery/materia/brass-macro.png' });
set('orr-atelier-headline', 'textSpec.glow', { color: '#ffe6a8', intensity: 0.16 });
set('orr-atelier-headline', 'textSpec.extrude', brassExtrude({
  faceFill: { kind: 'texture', url: '/prism-mock/orrery/materia/brass-macro.png' },
}));

save(g);
console.log('s6-atelier patched.');
