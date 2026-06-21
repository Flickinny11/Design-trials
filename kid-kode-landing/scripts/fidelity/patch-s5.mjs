// s5-acquire → a real pricing / reserve / acquire section.
import { load, save, byId, upsert, makeText, brassExtrude } from './lib.mjs';

const g = load();
const m = byId(g);
const set = (id, path, val) => {
  const n = m.get(id); if (!n) { console.log('MISSING', id); return; }
  const parts = path.split('.'); let c = n;
  for (let i = 0; i < parts.length - 1; i++) { if (c[parts[i]] == null) c[parts[i]] = {}; c = c[parts[i]]; }
  c[parts[parts.length - 1]] = val;
};

// 1. Headline → dimensional extruded brass, lifted to make room for the price band.
set('orr-acquire-headline', 'receivesLighting', true);
set('orr-acquire-headline', 'scenePosition.y', 2.2);
set('orr-acquire-headline', 'textSpec.fontSize', 0.46);
set('orr-acquire-headline', 'textSpec.extrude', brassExtrude({
  faceFill: { kind: 'texture', url: '/prism-mock/orrery/materia/brass-macro.png' },
}));

// 2. Eyebrow up top.
set('orr-acquire-eyebrow', 'scenePosition.y', 2.78);
set('orr-acquire-eyebrow', 'visual.transform.y', 2.78);

// 3. Repurpose the old tiny price line as a clean availability sub-line.
set('orr-acquire-availability', 'textSpec.content', 'Edition of 11 · Delivery 2027 · By appointment, Geneva');
set('orr-acquire-availability', 'textSpec.fontSize', 0.092);
set('orr-acquire-availability', 'textSpec.letterSpacing', 0.04);
set('orr-acquire-availability', 'textSpec.fill', { kind: 'solid', color: '#9aa3b4' });
set('orr-acquire-availability', 'scenePosition.y', 1.2);
set('orr-acquire-availability', 'scenePosition.z', 0.32);
set('orr-acquire-availability', 'visual.transform.y', 1.2);

// 4. Back the price band with the existing scrim (lift it under the price).
set('orr-acquire-availability-scrim', 'scenePosition.y', 1.42);
set('orr-acquire-availability-scrim', 'visual.transform.y', 1.42);

// 5. NEW prominent price.
upsert(g, makeText('orr-acquire-price', 's5-acquire', 'CHF 340,000', {
  x: 0, y: 1.56, z: 0.34, fontSize: 0.3, weight: 600, letterSpacing: 0.01,
  color: '#eccf86', subtype: 'price-display', caption: 'Flagship edition price.',
  glow: { color: '#e8c87a', intensity: 0.16 },
  animationBindings: [{ id: 'f4b-fade-up-price', primitive: 'fade-up', driver: 'time', params: { delay: 0.3, duration: 0.9 }, order: 263 }],
}));

// 6. Hero watch — more presence, nudged down to clear the price band.
set('orr-acquire-watch', 'scenePosition.scaleX', 1.72);
set('orr-acquire-watch', 'scenePosition.scaleY', 1.72);
set('orr-acquire-watch', 'scenePosition.scaleZ', 1.72);
set('orr-acquire-watch', 'scenePosition.y', -0.35);

// 7. "What you receive" block, lower-left — gives the page acquire substance.
upsert(g, makeText('orr-acquire-incl-eyebrow', 's5-acquire', 'WHAT YOU RECEIVE', {
  x: -3.55, y: -1.4, z: 0.32, fontSize: 0.078, weight: 500, letterSpacing: 0.26,
  align: 'left', color: '#8b93a6', subtype: 'section-eyebrow', caption: 'Included eyebrow.', width: 3,
}));
const incl = [
  ['orr-acquire-incl-1', 'Hand-finished tourbillon calibre'],
  ['orr-acquire-incl-2', 'Sapphire orrery complication'],
  ['orr-acquire-incl-3', 'Lifetime atelier service, Geneva'],
];
incl.forEach(([id, txt], i) => {
  upsert(g, makeText(id, 's5-acquire', txt, {
    x: -3.55, y: -1.7 - i * 0.26, z: 0.32, fontSize: 0.094, weight: 400,
    align: 'left', color: '#cdd4e0', subtype: 'feature-body', caption: txt, width: 3.4,
  }));
});

// 8. RESERVE primary brass key — bigger, clearly primary.
set('orr-acquire-reserve-slab', 'meshPrimitive.params.width', 2.5);
set('orr-acquire-reserve-slab', 'meshPrimitive.params.height', 0.6);
set('orr-acquire-reserve-slab', 'meshPrimitive.params.depth', 0.3);
set('orr-acquire-reserve-slab', 'materialSpec.clearcoat', 0.85);
set('orr-acquire-reserve-slab', 'materialSpec.emissiveIntensity', 0.28);
set('orr-acquire-reserve-label', 'textSpec.fontSize', 0.15);

save(g);
console.log('s5-acquire patched. nodes=', g.nodes.length);
