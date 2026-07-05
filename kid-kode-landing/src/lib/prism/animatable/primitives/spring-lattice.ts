// spring-lattice — a lattice of masses linked by springs jiggles and ripples,
// a wobble propagating through the connected mesh. CATALOG primitive
// (hard / particles, subject:'empty'). Builds a THREE.Points (one point per
// lattice node) into target.object and runs a DETERMINISTIC stepped spring
// simulation. Each node integrates Hooke forces: an anchor spring pulling it
// toward its rest grid position plus link springs from its 4-neighbours, all
// with velocity damping. A deterministic seed displacement pokes one corner so
// the wobble ripples through the connected lattice and slowly settles; an
// optional re-poke on a loop keeps it alive. seek(t) advances the sim with a
// fixed dt from the last seeked time; reseeking backward (t < lastT) resets and
// replays from 0 so every frame is reproducible (no Math.random anywhere).
// Continuous/stateful, so duration() = Infinity.
//
// DISTINCT from wave-grid (which is a kinematic sine of position/time): here the
// motion emerges from real spring forces propagating node-to-node, so a poke at
// one corner takes time to reach the far corner.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

// Fixed build-time allocation; `grid` is a live control but we allocate to the
// max grid so the geometry never reallocates. Unused nodes are parked far away.
const MAX_GRID = 16; // up to 16x16 = 256 nodes
const MAX_NODES = MAX_GRID * MAX_GRID;
const SPAN = 2.6; // lattice extent (full width/height) about the origin
const FIXED_DT = 1 / 120; // simulation step (small for spring stability)
const POKE_PERIOD = 3.4; // seconds between re-pokes (loop the wobble)
const POKE_AMP = 0.55; // displacement magnitude of the corner poke

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'grid', label: 'Grid', type: 'knob', min: 6, max: 16, step: 1, default: 10 },
  { id: 'stiffness', label: 'Stiffness', type: 'knob', min: 20, max: 240, step: 1, default: 110 },
  { id: 'damping', label: 'Damping', type: 'fader', min: 0.5, max: 6, step: 0.05, default: 2.2 },
] as const;

export const springLatticePrimitive: PrimitiveDefinition = {
  name: 'spring-lattice',
  label: 'Spring Lattice',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A lattice of masses linked by springs jiggles and ripples, a wobble propagating through the connected mesh — physics.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'spring-lattice', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Rest grid positions (recomputed when the grid size changes). The lattice
      // lives in the XY plane; a small per-node Z hash gives it gentle depth.
      const restX = new Float32Array(MAX_NODES);
      const restY = new Float32Array(MAX_NODES);
      const restZ = new Float32Array(MAX_NODES);

      // Live simulation state (closure-held): displacement from rest + velocity.
      const dx = new Float32Array(MAX_NODES);
      const dy = new Float32Array(MAX_NODES);
      const dz = new Float32Array(MAX_NODES);
      const vx = new Float32Array(MAX_NODES);
      const vy = new Float32Array(MAX_NODES);
      const vz = new Float32Array(MAX_NODES);

      let gridN = -1; // current grid dimension the rest/state were built for
      let restLink = SPAN / 9; // rest length of a neighbour link (set in build)
      let lastT = 0;
      let lastPoke = -1; // index of the last poke interval applied

      /** (Re)build rest positions + reset displacement for an N×N grid. */
      const buildGrid = (n: number) => {
        gridN = n;
        restLink = n > 1 ? SPAN / (n - 1) : SPAN;
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            const i = r * n + c;
            restX[i] = -SPAN / 2 + (n > 1 ? (c / (n - 1)) * SPAN : 0);
            restY[i] = -SPAN / 2 + (n > 1 ? (r / (n - 1)) * SPAN : 0);
            // Deterministic gentle depth so the mesh reads as 3D, not flat.
            restZ[i] = (hash1(i * 3.17 + 1.7) - 0.5) * 0.18;
          }
        }
        resetState();
      };

      /** Reset displacement/velocity to zero and clear the sim clock. */
      function resetState() {
        for (let i = 0; i < MAX_NODES; i++) {
          dx[i] = 0;
          dy[i] = 0;
          dz[i] = 0;
          vx[i] = 0;
          vy[i] = 0;
          vz[i] = 0;
        }
        lastT = 0;
        lastPoke = -1;
      }

      /** Seed a deterministic poke at the (0,0) corner node — the wobble source. */
      const applyPoke = (n: number, intervalIndex: number) => {
        const corner = 0; // top-left grid node
        // Direction varies deterministically per interval (hash of the index),
        // but is fully reproducible — never Math.random.
        const ang = hash1(intervalIndex * 5.31 + 2.9) * Math.PI * 2;
        dx[corner] += Math.cos(ang) * POKE_AMP;
        dy[corner] += Math.sin(ang) * POKE_AMP;
        dz[corner] += (hash1(intervalIndex * 7.13 + 0.4) - 0.5) * POKE_AMP * 0.6;
      };

      const positions = new Float32Array(MAX_NODES * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#8fb6ff'),
        size: 0.06,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'spring-lattice';
      target.object.add(points);

      const HIDDEN = SPAN + 1000; // park unused nodes far away

      /** One fixed-step spring integration over the active N×N grid. */
      const step = (n: number, stiffness: number, damping: number) => {
        const dt = FIXED_DT;
        const total = n * n;
        // Forces are computed from the CURRENT displacement (semi-implicit Euler:
        // update velocity from force, then position from new velocity).
        // Anchor spring pulls each node toward its rest (displacement 0).
        // Link springs pull neighbours toward the rest link separation, which —
        // since neighbours share the same rest grid spacing — reduces to a
        // Hooke term on the *difference* of displacements.
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            const i = r * n + c;
            // Anchor force (toward rest position).
            let fx = -stiffness * 0.25 * dx[i];
            let fy = -stiffness * 0.25 * dy[i];
            let fz = -stiffness * 0.25 * dz[i];
            // Link forces from the 4 axis-neighbours.
            // Right neighbour.
            if (c + 1 < n) {
              const j = i + 1;
              fx += stiffness * (dx[j] - dx[i]);
              fy += stiffness * (dy[j] - dy[i]);
              fz += stiffness * (dz[j] - dz[i]);
            }
            // Left neighbour.
            if (c - 1 >= 0) {
              const j = i - 1;
              fx += stiffness * (dx[j] - dx[i]);
              fy += stiffness * (dy[j] - dy[i]);
              fz += stiffness * (dz[j] - dz[i]);
            }
            // Down neighbour.
            if (r + 1 < n) {
              const j = i + n;
              fx += stiffness * (dx[j] - dx[i]);
              fy += stiffness * (dy[j] - dy[i]);
              fz += stiffness * (dz[j] - dz[i]);
            }
            // Up neighbour.
            if (r - 1 >= 0) {
              const j = i - n;
              fx += stiffness * (dx[j] - dx[i]);
              fy += stiffness * (dy[j] - dy[i]);
              fz += stiffness * (dz[j] - dz[i]);
            }
            // Damping (velocity drag).
            fx -= damping * vx[i];
            fy -= damping * vy[i];
            fz -= damping * vz[i];
            // Integrate velocity (unit mass).
            vx[i] += fx * dt;
            vy[i] += fy * dt;
            vz[i] += fz * dt;
          }
        }
        // Integrate position from the updated velocity.
        for (let i = 0; i < total; i++) {
          dx[i] += vx[i] * dt;
          dy[i] += vy[i] * dt;
          dz[i] += vz[i] * dt;
        }
      };

      const writePositions = (n: number) => {
        const total = n * n;
        for (let i = 0; i < total; i++) {
          positions[i * 3] = restX[i] + dx[i];
          positions[i * 3 + 1] = restY[i] + dy[i];
          positions[i * 3 + 2] = restZ[i] + dz[i];
        }
        for (let i = total; i < MAX_NODES; i++) {
          positions[i * 3] = HIDDEN;
          positions[i * 3 + 1] = HIDDEN;
          positions[i * 3 + 2] = 0;
        }
        posAttr.needsUpdate = true;
      };

      // Suppress unused-var lint on restLink: it documents the rest spacing and
      // keeps the physics intent explicit even though the difference-form Hooke
      // term doesn't reference it directly.
      void restLink;

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const n = Math.max(6, Math.min(MAX_GRID, Math.round(num(params.grid, 10))));
          const stiffness = num(params.stiffness, 110);
          const damping = clamp(num(params.damping, 2.2), 0.5, 6);

          if (n !== gridN) buildGrid(n);

          if (t < 0) t = 0;
          // Reseek backward → reset and replay from 0 so frames are reproducible.
          if (t < lastT) resetState();

          // Apply the initial poke at t=0 (interval 0) and re-poke each loop.
          if (lastPoke < 0) {
            applyPoke(n, 0);
            lastPoke = 0;
          }

          // Step the sim forward from lastT to t in fixed dt increments,
          // re-poking the corner when crossing each POKE_PERIOD boundary.
          let simT = lastT;
          let guard = 0;
          while (simT + FIXED_DT <= t && guard < 200000) {
            step(n, stiffness, damping);
            simT += FIXED_DT;
            guard++;
            const interval = Math.floor(simT / POKE_PERIOD);
            if (interval > lastPoke) {
              applyPoke(n, interval);
              lastPoke = interval;
            }
          }
          lastT = simT;

          writePositions(n);
        },
        onParamChange: (id) => {
          // A grid change restructures the lattice — rebuild on the next seek.
          if (id === 'grid') gridN = -1;
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
