// crumble-to-particles — the card disintegrates into a cloud of particles that
// scatter and drift away: a dissolve into dust. CATALOG primitive
// (hard / displacement, subject:'card'). CPU-driven and observable.
//
// build samples the card's bounding box into a grid (one point per cell) and
// creates a THREE.Points cloud into target.object that overlays the card's
// surface. For phase < startDissolve the points sit in their grid cells and the
// card is fully visible. Past startDissolve each point k drifts outward (from
// the card centre) and downward with a deterministic per-index velocity (index
// hash — no Math.random), shrinking and fading; the card subject's opacity
// fades out in lockstep so the panel appears to crumble into the cloud.
//
// DISTINCT from dissolve-to-dust (text subject): this works a card *surface*
// into a 2D grid of surface particles, not glyph coverage.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  Box3,
  Vector3,
  Mesh,
  type Material,
  type Object3D,
} from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type EaseName, type PrimitiveDefinition } from '../contract';

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// Past this phase the grid begins to dissolve; before it the card is intact.
const START_DISSOLVE = 0.18;
const MAX_SIDE = 80; // upper bound on grid points per side (geometry cap)

/** Collect transparent-capable materials on a subtree. */
function materialsOf(root: Object3D): Material[] {
  const out: Material[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        mat.transparent = true;
        out.push(mat);
      }
    }
  });
  return out;
}

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'density', label: 'Density', type: 'knob', min: 20, max: 80, step: 1, default: 44 },
  { id: 'spread', label: 'Spread', type: 'fader', min: 1, max: 6, step: 0.1, default: 3 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeIn',
    options: ['linear', 'easeIn', 'easeInOut', 'expoOut'],
  },
] as const;

export const crumbleToParticlesPrimitive: PrimitiveDefinition = {
  name: 'crumble-to-particles',
  label: 'Crumble To Particles',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'The card disintegrates into a cloud of particles that scatter and drift away — a dissolve into dust.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'crumble-to-particles', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const subjectMats = materialsOf(subject);

      // Measure the card's surface extents in world-ish local space.
      const box = new Box3().setFromObject(subject);
      const size = new Vector3();
      const center = new Vector3();
      box.getSize(size);
      box.getCenter(center);
      // Fall back to sane card extents if the bbox is degenerate (headless).
      const W = size.x > 1e-4 ? size.x : 1.74;
      const H = size.y > 1e-4 ? size.y : 1.12;
      const cz = box.max.z > -1e9 ? box.max.z : 0.07; // front face

      // Allocate a max-side grid once; live density selects an active subset.
      const MAX_PTS = MAX_SIDE * MAX_SIDE;
      const positions = new Float32Array(MAX_PTS * 3);

      // Per-point deterministic constants: home (grid) position + drift vectors.
      const homeX = new Float32Array(MAX_PTS);
      const homeY = new Float32Array(MAX_PTS);
      const homeZ = new Float32Array(MAX_PTS);
      const velX = new Float32Array(MAX_PTS);
      const velY = new Float32Array(MAX_PTS);
      const velZ = new Float32Array(MAX_PTS);
      const stagger = new Float32Array(MAX_PTS); // per-point dissolve delay 0..1

      // Compute the grid + drift for a given side count. Called on build and
      // whenever density changes (onParamChange) so home cells stay correct.
      let curSide = -1;
      const rebuildGrid = (sideRaw: number) => {
        const side = Math.max(2, Math.min(MAX_SIDE, Math.round(sideRaw)));
        if (side === curSide) return;
        curSide = side;
        const cx = center.x;
        const cy = center.y;
        for (let gy = 0; gy < side; gy++) {
          for (let gx = 0; gx < side; gx++) {
            const idx = gy * side + gx;
            const u = side > 1 ? gx / (side - 1) : 0.5; // 0..1
            const v = side > 1 ? gy / (side - 1) : 0.5;
            const px = cx + (u - 0.5) * W;
            const py = cy + (v - 0.5) * H;
            homeX[idx] = px;
            homeY[idx] = py;
            homeZ[idx] = cz;
            // Outward direction from the card centre (so the cloud expands),
            // plus a deterministic per-point jitter and a downward bias (dust
            // settling). All randomness from the index hash — reproducible.
            const ox = px - cx;
            const oy = py - cy;
            const olen = Math.hypot(ox, oy) || 1;
            const jitterAng = hash1(idx * 1.37 + 0.7) * Math.PI * 2;
            const jitterMag = 0.3 + hash1(idx * 2.91 + 3.3) * 0.7;
            velX[idx] = (ox / olen) * 0.6 + Math.cos(jitterAng) * jitterMag;
            // outward-up component plus a strong downward gravity bias.
            velY[idx] = (oy / olen) * 0.4 + Math.sin(jitterAng) * jitterMag * 0.5 - 0.9;
            velZ[idx] = (hash1(idx * 5.13 + 7.1) - 0.5) * 1.2;
            stagger[idx] = hash1(idx * 3.71 + 1.9); // 0..1 dissolve delay
          }
        }
        // Park unused points far below view.
        for (let i = side * side; i < MAX_PTS; i++) {
          positions[i * 3] = 0;
          positions[i * 3 + 1] = -1e4;
          positions[i * 3 + 2] = 0;
        }
      };
      rebuildGrid(num(params.density, 44));

      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setDrawRange(0, curSide * curSide);

      const baseSize = 0.045;
      const material = new PointsMaterial({
        color: new Color('#7fa6ff'),
        size: baseSize,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'crumble-particles';
      target.object.add(points);

      const PARKED_Y = -1e4;

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          const dur = num(params.duration, 1.6);
          const side = Math.max(2, Math.min(MAX_SIDE, Math.round(num(params.density, 44))));
          if (side !== curSide) {
            rebuildGrid(side);
            geometry.setDrawRange(0, side * side);
          }
          const spread = num(params.spread, 3);
          const curve = str(params.curve, 'easeIn') as EaseName;
          const ph = phase(t, dur);
          const active = side * side;

          // Global dissolve progress 0..1 (0 until START_DISSOLVE).
          const dissolveRaw = ph <= START_DISSOLVE
            ? 0
            : (ph - START_DISSOLVE) / (1 - START_DISSOLVE);

          for (let i = 0; i < active; i++) {
            // Each point starts dissolving after its staggered delay, so the
            // crumble sweeps across the card rather than all at once.
            const local = clamp((dissolveRaw - stagger[i] * 0.35) / 0.65, 0, 1);
            const e = ease(curve, local);
            const travel = e * spread;
            positions[i * 3] = homeX[i] + velX[i] * travel;
            positions[i * 3 + 1] = homeY[i] + velY[i] * travel * 1.0 - e * e * spread * 0.4;
            positions[i * 3 + 2] = homeZ[i] + velZ[i] * travel;
          }
          for (let i = active; i < MAX_PTS; i++) {
            positions[i * 3 + 1] = PARKED_Y;
          }
          posAttr.needsUpdate = true;

          // Particles appear as the card dissolves, then fade as they scatter.
          // Visible band: ramp up to ~START_DISSOLVE+, hold, fade toward end.
          const appear = clamp(ph / Math.max(START_DISSOLVE, 1e-3), 0, 1);
          const cloudFade = 1 - clamp((dissolveRaw - 0.45) / 0.55, 0, 1);
          material.opacity = appear * cloudFade * 0.95;
          material.size = baseSize * (1 - dissolveRaw * 0.5);

          // Couple the card's opacity: full until START_DISSOLVE, then fades to
          // ~0 as the cloud forms.
          const cardOpacity = 1 - clamp(dissolveRaw / 0.5, 0, 1);
          for (const m of subjectMats) {
            (m as Material & { opacity: number }).opacity = cardOpacity;
          }
          subject.visible = cardOpacity > 0.001;
        },
        onParamChange: (id, value) => {
          if (id === 'density') {
            const side = Math.max(2, Math.min(MAX_SIDE, Math.round(num(value as number, 44))));
            rebuildGrid(side);
            geometry.setDrawRange(0, side * side);
            posAttr.needsUpdate = true;
          }
        },
        dispose: () => {
          target.object.remove(points);
          geometry.dispose();
          material.dispose();
          // Restore the card subject to fully visible/opaque.
          subject.visible = true;
          for (const m of subjectMats) {
            (m as Material & { opacity: number }).opacity = 1;
          }
        },
      };
    },
  ),
};
