// domino-cascade — a row of thin domino tiles topples in sequence. The first
// tile is knocked and falls as an INVERTED PENDULUM (it pivots about its bottom
// edge under a destabilizing gravity-torque α = (g/L)·sin θ); when a falling
// tile's top swings past the contact angle it imparts angular velocity to the
// next standing tile, which begins its own fall — the impulse cascades down the
// line. CATALOG primitive (hard / transform, subject:'empty').
//
// Genuine simulation, NOT a staggered easing curve: every tile holds its own
// (angle, omega) and integrates with semi-implicit (symplectic) Euler at a
// fixed dt. The hand-off is a real sequential contact test computed each step
// from the live spacing/height geometry — change the spacing and tiles must
// lean further before they reach the next, so the wave's speed changes. Because
// the replay stepper resets-and-replays on a backward seek, the frame at time t
// is a pure function of (params, t), so every control — count, knockForce,
// gravity, spacing — visibly changes any frozen frame the harness pins.
//
// duration() is finite (the time for the wave to run the line + settle); the
// catalog rig loops t back to 0 → the row re-stands and is knocked again. The
// ~0.45 frozen phase lands MID-CASCADE: several tiles down, several still
// standing, one mid-fall.

import {
  Group,
  Mesh,
  BoxGeometry,
  MeshStandardMaterial,
  Color,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import { makeReplayStepper, resolveSimTier, tierPick } from './_sim-core';

// ── Tile + layout constants (catalog frame: x,y ∈ [−1.4,1.4], z near 0) ──────
const MAX_COUNT = 12;       // fixed allocation; live `count` clamps to this
const TILE_H = 0.62;        // domino height (tall axis, pivots about its base)
const TILE_W = 0.10;        // thickness along the fall (X) direction — thin
const TILE_D = 0.40;        // depth (Z) — the broad face we see
const FLOOR_Y = -0.46;      // y of the pivot line (tile bases sit here)
const DT = 1 / 240;         // stiff inverted-pendulum contact → small step
const FALL_ANGLE = Math.PI / 2 - 0.04; // a toppled tile lies (nearly) flat

// Brass / steel palette (Observatory Brass — NO purple).
const TILE_COLOR = '#d9a86c';     // brass
const TILE_EMISSIVE = '#ecd49d';  // warm ice highlight
const STEEL_EMISSIVE = '#cfdde6'; // cool steel rim

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 4, max: 12, step: 1, default: 9 },
  { id: 'knockForce', label: 'Knock Force', type: 'fader', min: 1.2, max: 6, step: 0.1, default: 3 },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 4, max: 24, step: 0.5, default: 13 },
  { id: 'spacing', label: 'Spacing', type: 'fader', min: 0.34, max: 0.62, step: 0.01, default: 0.46, unit: 'u' },
] as const;

export const dominoCascadePrimitive: PrimitiveDefinition = {
  name: 'domino-cascade',
  label: 'Domino Cascade',
  category: 'transform',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A row of thin domino tiles topples in sequence — each falls as an inverted pendulum under gravity-torque and knocks the next into its own fall, a real contact-triggered chain reaction.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'domino-cascade', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Heavy contact loop → fewer substeps on T0 (cheaper, still cascades).
      const substeps = tierPick(tier, { T0: 1, T1: 2, T2: 3 });

      // ── Build a fixed pool of pivot groups, one per possible tile ──────────
      // Each tile is a thin Box whose pivot is at its BOTTOM edge: the mesh is
      // offset +TILE_H/2 inside a pivot Group, so rotating the group about Z
      // swings the tile about its base like a real domino.
      const root = new Group();
      root.name = 'domino-cascade';
      target.object.add(root);

      interface Tile {
        pivot: Group;
        mat: MeshStandardMaterial;
      }
      const tiles: Tile[] = [];
      for (let i = 0; i < MAX_COUNT; i++) {
        const mat = new MeshStandardMaterial({
          color: new Color(TILE_COLOR),
          // Alternate warm-ice / cool-steel highlight so the row reads as a
          // line of distinct brass/steel tiles, not one extruded slab.
          emissive: new Color(i % 2 ? TILE_EMISSIVE : STEEL_EMISSIVE),
          emissiveIntensity: 0.34,
          roughness: 0.3,
          metalness: 0.62,
          envMapIntensity: 1.2,
          transparent: true,
        });
        const mesh = new Mesh(new BoxGeometry(TILE_W, TILE_H, TILE_D), mat);
        mesh.position.y = TILE_H / 2; // base at the pivot origin
        mesh.name = `domino-${i}`;
        const pivot = new Group();
        pivot.name = `domino-pivot-${i}`;
        pivot.add(mesh);
        root.add(pivot);
        tiles.push({ pivot, mat });
      }

      // ── Live simulation state ─────────────────────────────────────────────
      const angle = new Float32Array(MAX_COUNT); // 0 = upright, +→ toppling fwd (+X)
      const omega = new Float32Array(MAX_COUNT); // angular velocity (rad/s)
      const knocked = new Uint8Array(MAX_COUNT);  // has this tile received an impulse

      const liveCount = () =>
        Math.max(2, Math.min(MAX_COUNT, Math.round(num(params.count, 9))));

      const reset = () => {
        for (let i = 0; i < MAX_COUNT; i++) {
          angle[i] = 0;
          omega[i] = 0;
          knocked[i] = 0;
        }
        // Knock the FIRST tile: a deterministic forward push (no randomness).
        const push = clamp(num(params.knockForce, 3), 1.2, 6);
        angle[0] = 0.06; // nudge off the unstable equilibrium so torque engages
        omega[0] = push;
        knocked[0] = 1;
      };

      const step = (dt: number) => {
        const count = liveCount();
        const g = num(params.gravity, 13);
        const spacing = clamp(num(params.spacing, 0.46), 0.34, 0.62);
        // Inverted-pendulum effective length: torque per unit angle ~ g/L. Use
        // the tile half-height as the lever so taller tiles swing a touch slower.
        const invL = 1 / (TILE_H * 0.5);

        // The forward reach of a falling tile's top, H·sinθ, must cover the gap
        // to the next tile's base to make contact. With pivots spaced `spacing`
        // apart and a tile thickness, contact happens when the leaning top has
        // travelled past the next pivot minus a small face offset.
        const reachGap = clamp(spacing - TILE_W * 0.5, 0.05, TILE_H * 0.999);
        const contactAngle = Math.asin(clamp(reachGap / TILE_H, 0, 0.999));

        const sub = dt / substeps;
        for (let s = 0; s < substeps; s++) {
          // 1) Integrate each toppling tile (semi-implicit Euler).
          for (let i = 0; i < count; i++) {
            if (angle[i] >= FALL_ANGLE) {
              // Already flat → rest (lies on the next tile / floor).
              if (omega[i] !== 0) {
                omega[i] = 0;
                angle[i] = FALL_ANGLE;
              }
              continue;
            }
            if (knocked[i] === 0 && omega[i] === 0) continue; // still standing
            // Destabilizing gravity-torque grows with lean: α = (g/L)·sin θ.
            const alpha = g * invL * Math.sin(angle[i]);
            omega[i] += alpha * sub;
            angle[i] += omega[i] * sub;
            // Landing clamp.
            if (angle[i] >= FALL_ANGLE) {
              angle[i] = FALL_ANGLE;
              omega[i] = 0;
            }
          }
          // 2) Sequential contact: a tile past the contact angle imparts angular
          //    velocity to the next still-standing tile (a real hand-off, once).
          for (let i = 0; i < count - 1; i++) {
            if (knocked[i + 1] === 0 && angle[i] >= contactAngle && omega[i] > 0) {
              knocked[i + 1] = 1;
              // Transfer a fraction of the striker's swing speed; a small floor
              // so even a gentle topple still starts the neighbour reliably.
              omega[i + 1] = Math.max(0.9, omega[i] * 0.55);
              angle[i + 1] = 0.04;
            }
          }
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      const HIDDEN_Y = 1000;
      const write = () => {
        const count = liveCount();
        const spacing = clamp(num(params.spacing, 0.46), 0.34, 0.62);
        // Centre the row about x=0 using the live spacing (a control read LIVE
        // in write(): even a same-t reseek without markDirty re-lays the row).
        const span = (count - 1) * spacing;
        const x0 = -span * 0.5;
        for (let i = 0; i < MAX_COUNT; i++) {
          const tile = tiles[i];
          if (i >= count) {
            tile.pivot.visible = false;
            tile.pivot.position.set(0, HIDDEN_Y, 0);
            continue;
          }
          tile.pivot.visible = true;
          tile.pivot.position.set(x0 + i * spacing, FLOOR_Y, 0);
          // Topple FORWARD (+X): negative Z-rotation tips the +Y tile toward +X.
          tile.pivot.rotation.z = -angle[i];
          // Brighten a tile as it falls so the moving wave reads clearly.
          tile.mat.emissiveIntensity = 0.34 + (angle[i] / FALL_ANGLE) * 0.5;
        }
      };

      reset();
      write();

      return {
        // Wave time tracks the actual cascade: each tile takes ≈ (lead-in +
        // k/√g) to topple and hand off, so the row clears in ≈ count·perTile.
        // Duration is sized so the full wave spans ~0.85 of it → phase 0.45
        // lands MID-cascade (several down, several standing). Faster g / tighter
        // spacing → quicker wave → shorter duration; bounded so the loop stays
        // lively but the engaged pose is never past completion.
        duration: () => {
          const count = liveCount();
          const g = num(params.gravity, 13);
          const spacing = clamp(num(params.spacing, 0.46), 0.34, 0.62);
          const perTile = (0.62 + spacing * 0.4) / Math.sqrt(g); // sec / tile
          const wave = 0.2 + count * perTile; // includes the lead tile's fall
          return clamp(wave / 0.82, 1.8, 6);
        },
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Every control sweep re-runs the sim to the same pinned frame, so the
        // frozen frame visibly changes (standing function of the engaged pose).
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(root);
          for (const tile of tiles) {
            const mesh = tile.pivot.children[0] as Mesh;
            mesh.geometry.dispose();
            tile.mat.dispose();
          }
        },
      };
    },
  ),
};
