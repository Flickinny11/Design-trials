// Round-2 advocate fixes: s3 unmistakable depth + s5 clean buy-box CTAs.
import { load, save, byId } from './lib.mjs';

const g = load();
const m = byId(g);
const set = (id, p, v) => {
  const n = m.get(id); if (!n) { console.log('MISS', id); return; }
  const a = p.split('.'); let c = n;
  for (let i = 0; i < a.length - 1; i++) { if (c[a[i]] == null) c[a[i]] = {}; c = c[a[i]]; }
  c[a[a.length - 1]] = v;
};
const mv = (id, x, y) => {
  if (x != null) { set(id, 'scenePosition.x', x); set(id, 'visual.transform.x', x); }
  if (y != null) { set(id, 'scenePosition.y', y); set(id, 'visual.transform.y', y); }
};

// ── s3: SCALE the clusters around their centers (real size hierarchy = depth) ──
// Sapphire (center x0) becomes the forward hero; brass + meteorite recede.
const CLUSTERS = [
  { key: 'brass', cx: -3.85, f: 0.8 },
  { key: 'sapphire', cx: 0, f: 1.26 },
  { key: 'meteorite', cx: 3.85, f: 0.8 },
];
const CY = 0.1; // plate band center
for (const node of g.nodes) {
  if (node.parentHubId !== 's3-materia') continue;
  for (const cl of CLUSTERS) {
    if (node.nodeId.startsWith(`orr-materia-${cl.key}-`)) {
      const sp = node.scenePosition;
      // scale position around the cluster center, and the part's own size
      sp.x = +(cl.cx + (sp.x - cl.cx) * cl.f).toFixed(3);
      sp.y = +(CY + (sp.y - CY) * cl.f).toFixed(3);
      sp.scaleX = +((sp.scaleX ?? 1) * cl.f).toFixed(3);
      sp.scaleY = +((sp.scaleY ?? 1) * cl.f).toFixed(3);
      sp.scaleZ = +((sp.scaleZ ?? 1) * cl.f).toFixed(3);
      if (node.visual?.transform) { node.visual.transform.x = sp.x; node.visual.transform.y = sp.y; }
      break;
    }
  }
}

// ── s5: CTAs → clean right buy-box under the price (no frame-bottom skew) ──
// price is x3.25 y0.74, availability y0.36 → stack RESERVE + ENQUIRE below.
const BX = 3.25;
mv('orr-acquire-reserve-slab', BX, -0.05); mv('orr-acquire-reserve-label', BX, -0.05); mv('orr-acquire-reserve-edge-f4bcta', BX, -0.32);
mv('orr-acquire-enquire-slab', BX, -0.7); mv('orr-acquire-enquire-label', BX, -0.7); mv('orr-acquire-enquire-edge', BX, -0.97);
// fit the panel width; flat-on at mid-height reads clean
for (const id of ['orr-acquire-reserve-slab', 'orr-acquire-enquire-slab']) {
  set(id, 'meshPrimitive.params.width', 2.6);
  set(id, 'meshPrimitive.params.height', 0.5);
  set(id, 'meshPrimitive.params.depth', 0.16);
}
set('orr-acquire-reserve-slab', 'materialSpec.emissiveIntensity', 0.12);
set('orr-acquire-reserve-label', 'scenePosition.z', 0.34);
set('orr-acquire-enquire-label', 'scenePosition.z', 0.34);
// widen the buy-box scrim to back the whole price→CTA stack
set('orr-acquire-availability-scrim', 'meshPrimitive.params.height', 2.4);
mv('orr-acquire-availability-scrim', BX, -0.0);
// assurance line → small print at the very bottom (clear of the CTAs)
mv('orr-acquire-assurance', 0, -2.62);
set('orr-acquire-assurance', 'textSpec.fontSize', 0.072);

save(g);
console.log('Round-2 fixes applied (s3 scale hierarchy + s5 right buy-box).');
