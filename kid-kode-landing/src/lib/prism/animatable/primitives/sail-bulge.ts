// sail-bulge — CPU vertex displacement on the host plane that reads as a sail
// catching wind. Each vertex's centered coordinates (cx,cy in -0.5..0.5) drive
// a deep radial CENTER billow that breathes with gusts, plus a luffing flap
// (a traveling sine along cy) that ripples the canvas. The billow is pinned at
// the edges (the radial falloff -> 0 toward the rim) and deepest at the center,
// so a center vertex's z swings while the edges stay ~pinned. A gust envelope
// gust(t) = 0.6 + 0.4*sin(t*0.5) makes the whole sail breathe in and out.
//
// Distinct from cloth-sway (TOP-pinned gravity drape) and flag-wave (left-pinned
// horizontal travel): here the displacement is a center-anchored radial bulge
// modulated by wind gusts, with all four edges ~pinned.
//
// Base position attribute is cached once; seek() reads speed/bulge/gustiness
// LIVE so control changes take effect with no rebuild. dispose() restores the
// original vertex positions and normals.

import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.4 },
  { id: 'bulge', label: 'Bulge', type: 'fader', min: 0.2, max: 3, step: 0.05, default: 1.0 },
  { id: 'gustiness', label: 'Gustiness', type: 'knob', min: 0, max: 1, step: 0.05, default: 0.6 },
  { id: 'flap', label: 'Flap', type: 'knob', min: 2, max: 16, step: 0.5, default: 7 },
] as const;

export const sailBulgePrimitive: PrimitiveDefinition = {
  name: 'sail-bulge',
  label: 'Sail Bulge',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'The plane bulges and luffs like a sail catching wind — a deep center billow that breathes with gusts.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'sail-bulge', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry as BufferGeometry;
      const posAttr = geom.getAttribute('position') as BufferAttribute;
      // Cache the base position attribute once.
      const base = new Float32Array(posAttr.array as ArrayLike<number>);
      const count = posAttr.count;

      // Mesh extents -> centered coords cx,cy in -0.5..0.5.
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        if (bx < minX) minX = bx;
        if (bx > maxX) maxX = bx;
        if (by < minY) minY = by;
        if (by > maxY) maxY = by;
      }
      const spanX = maxX - minX || 1;
      const spanY = maxY - minY || 1;

      const applyBulge = (t: number) => {
        const speed = num(params.speed, 1.4);
        const bulge = num(params.bulge, 1.0);
        const gustiness = num(params.gustiness, 0.6);
        const flap = num(params.flap, 7);
        // Gust envelope breathing in/out: gust(t) = 0.6 + 0.4*sin(t*0.5).
        // gustiness blends between a steady fill (1.0) and the full breathing
        // gust, so gustiness=0 holds taut and gustiness=1 swells/luffs fully.
        const rawGust = 0.6 + 0.4 * Math.sin(t * 0.5);
        const gust = 1.0 + (rawGust - 1.0) * gustiness;
        const amp = bulge * 0.4; // luffing flap amplitude scales with bulge
        for (let i = 0; i < count; i++) {
          const bx = base[i * 3];
          const by = base[i * 3 + 1];
          const bz = base[i * 3 + 2];
          const cx = (bx - minX) / spanX - 0.5;
          const cy = (by - minY) / spanY - 0.5;
          // Radial center billow, pinned at the rim: 1 - 4*r^2, clamped >=0.
          const radial = clamp(1 - (cx * cx + cy * cy) * 4, 0, 1);
          // Luffing flap: a traveling sine along the vertical canvas, rim-faded
          // so the flap doesn't fight the pinned edges.
          const edgeFade = clamp(1 - Math.abs(cx) * 2, 0, 1);
          const flapWave = Math.sin(cy * flap + t * speed) * amp * 0.3 * edgeFade;
          const z = bulge * radial * gust + flapWave;
          posAttr.setXYZ(i, bx, by, bz + z);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      return {
        duration: () => Infinity,
        seek: (t) => {
          applyBulge(t);
        },
        dispose: () => {
          for (let i = 0; i < count; i++) {
            posAttr.setXYZ(i, base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
          }
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();
        },
      };
    },
  ),
};
