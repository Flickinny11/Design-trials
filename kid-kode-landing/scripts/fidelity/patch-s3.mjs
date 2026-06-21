// s3-materia: kill the flat coplanar-tiles read.
// 1) Title → dimensional brass.  2) Z-stagger the three plate clusters into a
// depth triptych (sapphire forward = hero crystal; brass + meteorite recede).
// 3) Deepen the center frame rim for shadowbox presence.
import { load, save, byId, brassExtrude } from './lib.mjs';

const g = load();
const m = byId(g);
const set = (id, p, v) => {
  const n = m.get(id); if (!n) { console.log('MISSING', id); return; }
  const a = p.split('.'); let c = n;
  for (let i = 0; i < a.length - 1; i++) { if (c[a[i]] == null) c[a[i]] = {}; c = c[a[i]]; }
  c[a[a.length - 1]] = v;
};

// Title → dimensional extruded brass.
set('orr-materia-headline', 'receivesLighting', true);
set('orr-materia-headline', 'textSpec.fill', { kind: 'texture', url: '/prism-mock/orrery/materia/brass-macro.png' });
set('orr-materia-headline', 'textSpec.glow', { color: '#ffe6a8', intensity: 0.16 });
set('orr-materia-headline', 'textSpec.extrude', brassExtrude({
  faceFill: { kind: 'texture', url: '/prism-mock/orrery/materia/brass-macro.png' },
}));

// Z-stagger whole clusters (translate every part by the same Δz → no shear).
const dz = { brass: -0.22, sapphire: 0.18, meteorite: -0.22 };
let moved = 0;
for (const node of g.nodes) {
  if (node.parentHubId !== 's3-materia') continue;
  for (const mat of ['brass', 'sapphire', 'meteorite']) {
    if (node.nodeId.startsWith(`orr-materia-${mat}-`)) {
      const p = node.scenePosition;
      p.z = +(p.z + dz[mat]).toFixed(3);
      if (node.visual?.transform) node.visual.transform.z = p.z;
      moved++;
      break;
    }
  }
}

// Hero sapphire: deeper rim + bevel for a recessed shadowbox crystal feel.
set('orr-materia-sapphire-frame-rim', 'meshPrimitive.params.depth', 0.34);
set('orr-materia-sapphire-frame-bevel', 'meshPrimitive.params.depth', 0.26);

save(g);
console.log(`s3-materia patched. clusters z-staggered (${moved} nodes).`);
