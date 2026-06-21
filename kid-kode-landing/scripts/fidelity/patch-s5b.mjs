// s5-acquire final layout: product-detail composition.
// TOP: eyebrow + dimensional headline.  CENTER: hero watch+pedestal.
// RIGHT buy-box: price + availability on a scrim panel.  LEFT: what-you-receive.
// BOTTOM: RESERVE (primary) + ENQUIRE (secondary).  + assurance line.
import { load, save, byId, makeText } from './lib.mjs';

const g = load();
const m = byId(g);
const set = (id, p, v) => {
  const n = m.get(id); if (!n) { console.log('MISSING', id); return; }
  const a = p.split('.'); let c = n;
  for (let i = 0; i < a.length - 1; i++) { if (c[a[i]] == null) c[a[i]] = {}; c = c[a[i]]; }
  c[a[a.length - 1]] = v;
};
const move = (id, x, y, z) => {
  set(id, 'scenePosition.x', x); set(id, 'scenePosition.y', y);
  if (z != null) set(id, 'scenePosition.z', z);
  set(id, 'visual.transform.x', x); set(id, 'visual.transform.y', y);
};

// Top band
move('orr-acquire-eyebrow', 0, 2.82);
set('orr-acquire-headline', 'scenePosition.y', 2.44);
set('orr-acquire-headline', 'visual.transform.y', 2.44);

// Center hero
set('orr-acquire-watch', 'scenePosition.y', 0.05);
set('orr-acquire-watch', 'scenePosition.scaleX', 1.6);
set('orr-acquire-watch', 'scenePosition.scaleY', 1.6);
set('orr-acquire-watch', 'scenePosition.scaleZ', 1.6);
set('orr-acquire-pedestal', 'scenePosition.y', -1.35);

// RIGHT buy-box panel (scrim behind price + availability)
set('orr-acquire-availability-scrim', 'meshPrimitive.params.width', 3.0);
set('orr-acquire-availability-scrim', 'meshPrimitive.params.height', 1.15);
move('orr-acquire-availability-scrim', 3.25, 0.5, 0.16);
move('orr-acquire-price', 3.25, 0.74, 0.34);
set('orr-acquire-price', 'textSpec.fontSize', 0.25);
set('orr-acquire-price', 'textSpec.align', 'center');
move('orr-acquire-availability', 3.25, 0.36, 0.34);
set('orr-acquire-availability', 'textSpec.content', 'Edition of 11 · Delivery 2027 · By appointment');
set('orr-acquire-availability', 'textSpec.fontSize', 0.078);
set('orr-acquire-availability', 'textSpec.align', 'center');

// LEFT what-you-receive flank
move('orr-acquire-incl-eyebrow', -3.55, 0.74, 0.34);
['orr-acquire-incl-1', 'orr-acquire-incl-2', 'orr-acquire-incl-3'].forEach((id, i) => {
  move(id, -3.55, 0.42 - i * 0.27, 0.34);
  set(id, 'textSpec.fontSize', 0.092);
  set(id, 'visual.transform.width', 2.7);
});

// Assurance line between pedestal and CTAs.
if (!m.has('orr-acquire-assurance')) {
  g.nodes.push(makeText('orr-acquire-assurance', 's5-acquire',
    'Each ORRERY No.7 is individually numbered and accompanied by a certificate of authenticity.',
    { x: 0, y: -2.18, z: 0.32, fontSize: 0.078, weight: 400, align: 'center',
      color: '#8b93a6', subtype: 'feature-body', caption: 'Assurance line.', width: 6 }));
}

save(g);
console.log('s5 final layout applied. nodes=', g.nodes.length);
