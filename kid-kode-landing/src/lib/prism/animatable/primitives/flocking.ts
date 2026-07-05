// flocking — a coherent migrating band of particles, like starlings at dusk.
// CATALOG primitive (hard / particles, subject:'empty'). Builds a THREE.Points
// into target.object. Each particle's position is a PURE function of (i, t):
//   centerline(t)  — a shared flow that sweeps the whole band across the field
//                     and undulates via sin fields (the migrating "alignment").
//   laneOffset(i)  — a per-index hash offset (individual local variation).
// The `alignment` knob blends those: high alignment => particles share the flow
// tightly (coherent band); low alignment => they keep their own lane offsets
// (looser). `count` structurally rebuilds the geometry (onParamChange). All
// per-particle randomness derives from an index hash (no Math.random), so the
// motion is deterministic and CPU-observable headless.
//
// DISTINCT from swarm (attractor convergence): flocking never converges to a
// point — the band stays spread and migrates coherently across the field.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const BAND_LEN = 3.0; // length of the band along its travel axis
const BAND_HALF_W = 0.9; // half-width of the lateral spread
const BAND_HALF_H = 0.55; // half-height (vertical spread)
const MIN_COUNT = 100;
const MAX_COUNT = 600;

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.01, default: 0.8 },
  { id: 'alignment', label: 'Alignment', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.7 },
  { id: 'count', label: 'Count', type: 'knob', min: MIN_COUNT, max: MAX_COUNT, step: 10, default: 300 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.005, max: 0.08, step: 0.001, default: 0.024 },
] as const;

/** Deterministic [0,1) hash from an index + salt (no Math.random). */
const hash = (i: number, salt: number): number => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export const flockingPrimitive: PrimitiveDefinition = {
  name: 'flocking',
  label: 'Flocking',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Particles flock in a coherent flowing band, aligning direction and sweeping across the field like starlings at dusk.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'flocking', category: 'particles', schema: SCHEMA },
    (target, params) => {
      let count = Math.round(clamp(num(params.count, 300), MIN_COUNT, MAX_COUNT));

      // Per-particle cached hashes: lane offset within the band + a phase salt
      // for individual undulation. Rebuilt whenever `count` changes.
      let lane: Float32Array; // x,y,z lane offset per particle
      let phaseSalt: Float32Array; // scalar phase per particle
      let arc: Float32Array; // position along the band [0,1)
      let positions: Float32Array;
      let geometry: BufferGeometry;
      let posAttr: BufferAttribute;

      const buildBuffers = (n: number) => {
        lane = new Float32Array(n * 3);
        phaseSalt = new Float32Array(n);
        arc = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          lane[i * 3] = (hash(i, 1) - 0.5) * 2 * BAND_HALF_W;
          lane[i * 3 + 1] = (hash(i, 2) - 0.5) * 2 * BAND_HALF_H;
          lane[i * 3 + 2] = (hash(i, 3) - 0.5) * 2 * BAND_HALF_W;
          phaseSalt[i] = hash(i, 4) * Math.PI * 2;
          arc[i] = i / n; // even spread along the band
        }
        positions = new Float32Array(n * 3);
      };

      buildBuffers(count);
      geometry = new BufferGeometry();
      posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#bcd2ff'),
        size: num(params.size, 0.024),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'flocking';
      target.object.add(points);

      const computeFrame = (t: number) => {
        const speed = num(params.speed, 0.8);
        const align = clamp(num(params.alignment, 0.7), 0, 1);
        material.size = num(params.size, 0.024);

        // Shared centerline migration: the whole band drifts across the field
        // (x sweeps) and undulates vertically/laterally via sin fields. This is
        // the coherent "flow" every particle advects along.
        for (let i = 0; i < count; i++) {
          // Position along the band [0,1), advected forward and wrapped.
          let s = arc[i] + speed * t * 0.15;
          s = s - Math.floor(s);

          // Centerline at this arc + time: a sweeping, undulating ribbon.
          const along = (s - 0.5) * BAND_LEN; // travel axis
          const flowX = along + Math.sin(t * 0.6 + s * Math.PI * 2) * 0.6;
          const flowY = Math.sin(t * 0.9 + s * Math.PI * 4) * 0.5;
          const flowZ = Math.cos(t * 0.5 + s * Math.PI * 2) * 0.5;

          // Individual lane offset + a small per-particle undulation (local
          // variation). `align` blends shared-flow vs individual offset: at
          // align=1 particles hug the flow tightly (coherent band); at align=0
          // they keep their full lane offset (looser, less coherent).
          const ph = phaseSalt[i];
          const wob = (1 - align);
          const ox = lane[i * 3] * wob + Math.sin(t * 1.3 + ph) * 0.08 * wob;
          const oy = lane[i * 3 + 1] * wob + Math.cos(t * 1.1 + ph) * 0.08 * wob;
          const oz = lane[i * 3 + 2] * wob + Math.sin(t * 1.7 + ph) * 0.08 * wob;

          positions[i * 3] = flowX + ox;
          positions[i * 3 + 1] = flowY + oy;
          positions[i * 3 + 2] = flowZ + oz;
        }
        posAttr.needsUpdate = true;
      };

      return {
        duration: () => Infinity,
        seek: (t) => computeFrame(t),
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'count') {
            const next = Math.round(clamp(num(value, count), MIN_COUNT, MAX_COUNT));
            if (next === count) return;
            count = next;
            buildBuffers(count);
            // Swap in a fresh geometry/attribute sized for the new count.
            const old = geometry;
            geometry = new BufferGeometry();
            posAttr = new BufferAttribute(positions, 3);
            geometry.setAttribute('position', posAttr);
            points.geometry = geometry;
            old.dispose();
          } else if (id === 'size') {
            material.size = num(value, 0.024);
          }
        },
        dispose: () => {
          target.object.remove(points);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
