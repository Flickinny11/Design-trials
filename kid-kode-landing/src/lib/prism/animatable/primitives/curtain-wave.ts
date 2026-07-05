// curtain-wave — CPU vertex displacement that reads as a pleated curtain
// swaying side to side. Two distinct deformations are composited on the host
// plane:
//
//  1. PLEATS (static structure): a vertical accordion fold pushed into z as a
//     function of the horizontal coordinate — z += sin(u * pleats * 2PI) *
//     pleatDepth. This gives the standing corrugated curtain its ribbed look.
//  2. SWAY (animated): the whole sheet swings left/right in x, pinned at the
//     TOP rail (v=0) and free at the BOTTOM hem (v=1) — x += sin(t*speed +
//     v*2) * swayAmp * v. The v factor means top vertices stay ~fixed on the
//     rail while the hem swings the most; the v*2 phase term gives the hem a
//     gentle hanging lag so the pleats swing together as a body.
//
// Distinct from cloth-sway (a z billow with no fixed pleats) and hair-sway
// (independent strands): here the structure is a fixed pleated z corrugation
// and the motion is a coherent x-sway of the whole sheet.
//
// Base position attribute is cached once; seek() reads pleats/speed/swayAmp
// LIVE so control changes take effect with no rebuild. dispose() restores the
// original vertex positions and normals.

import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const TWO_PI = Math.PI * 2;

const SCHEMA = [
  { id: 'pleats', label: 'Pleats', type: 'knob', min: 4, max: 16, step: 1, default: 8 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.2 },
  { id: 'swayAmp', label: 'Sway', type: 'fader', min: 0.05, max: 0.6, step: 0.01, default: 0.24 },
  { id: 'pleatDepth', label: 'Pleat Depth', type: 'fader', min: 0, max: 0.4, step: 0.01, default: 0.14 },
] as const;

export const curtainWavePrimitive: PrimitiveDefinition = {
  name: 'curtain-wave',
  label: 'Curtain Wave',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A pleated curtain sways side to side, its vertical pleats swinging together with a gentle hanging motion.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'curtain-wave', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry as BufferGeometry;
      const posAttr = geom.getAttribute('position') as BufferAttribute;
      // Cache the base position attribute once.
      const base = new Float32Array(posAttr.array as ArrayLike<number>);
      const count = posAttr.count;

      // Extents of the base mesh, to normalize x -> u (0..1) and y -> v
      // (0 at the TOP rail / pinned, 1 at the BOTTOM hem / free).
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

      const applyCurtain = (t: number) => {
        const pleats = num(params.pleats, 8);
        const speed = num(params.speed, 1.2);
        const swayAmp = num(params.swayAmp, 0.24);
        const pleatDepth = num(params.pleatDepth, 0.14);
        for (let i = 0; i < count; i++) {
          const bx = base[i * 3];
          const by = base[i * 3 + 1];
          const bz = base[i * 3 + 2];
          const u = clamp((bx - minX) / spanX, 0, 1); // 0..1 across width
          const v = clamp((maxY - by) / spanY, 0, 1); // 0 top (pinned) .. 1 hem (free)
          // (1) Static pleated corrugation pushed into z.
          const pleatZ = Math.sin(u * pleats * TWO_PI) * pleatDepth;
          // (2) Animated side-to-side sway in x; pinned at top via v, hem lags.
          const swayX = Math.sin(t * speed + v * 2) * swayAmp * v;
          posAttr.setXYZ(i, bx + swayX, by, bz + pleatZ);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      return {
        duration: () => Infinity,
        seek: (t) => {
          applyCurtain(t);
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
