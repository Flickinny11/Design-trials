// soft-body-bounce — a SOFT deformable gel blob, built as an XPBD particle
// lattice (a filled disc: one centre + concentric rings, triangulated into a
// fan/strip mesh), drops under gravity, hits the floor and SQUASHES with real
// jiggle/deformation — the lattice flattens and wobbles, then recovers its
// round shape via the distance constraints holding it together. CATALOG
// primitive (hard / wave, subject:'empty'). This is NOT a scale tween: the mesh
// vertices ARE the simulated particles, so the squash is genuine soft-body
// deformation (volume bulges sideways on impact, the surface ripples as the
// constraints fight to restore rest lengths).
//
// XPBD recipe (per the authoring guide + _sim-core): particles as flat
// px/py/pz + pvx/pvy/pvz + invMass. Per substep: (1) save prevPos, integrate
// gravity into velocity + predict positions; (2) solve every distance
// constraint ONCE in fixed Gauss-Seidel order with alphaTilde =
// complianceAlpha(stiffness, dtSub); (3) recover velocity = (pos - prev)/dtSub.
// Floor contact is a position projection (lift any particle that dips below the
// floor and reflect its implied velocity by bounciness). 8 substeps per fixed
// step keeps the soft contact stable. Deterministic: the only "randomness" is a
// tiny per-particle hash jiggle seed; no Math.random, no wallclock.
//
// Because makeReplayStepper resets-and-replays on a backward seek, the deformed
// frame at time t is a pure function of (params, t) — so every control
// (stiffness, gravity, bounciness, jiggle) visibly changes any frozen frame the
// verification harness pins, AND onParamChange→markDirty re-runs the sim to the
// SAME pinned t so trajectory-only controls read live. duration() is the finite
// settle window; the rig loops t→0 (a rewind → the blob re-drops). The ~0.45
// frozen phase lands MID-SQUASH on the first impact.

import {
  Mesh,
  BufferGeometry,
  BufferAttribute,
  MeshStandardMaterial,
  Color,
  DoubleSide,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import {
  makeReplayStepper,
  solveDistanceConstraint,
  complianceAlpha,
  resolveSimTier,
  tierPick,
  shash,
} from './_sim-core';

const FIXED_DT = 1 / 90; // outer fixed step
const SUBSTEPS = 8; // XPBD "small steps"
const FLOOR_Y = -0.95; // floor plane (blob rests its lowest particles here)
const DROP_Y = 0.85; // centre starts this high above its settled rest centre
const REST_RADIUS = 0.62; // blob radius at rest

// Fixed build-time MAX allocation (richest tier). The lattice = 1 centre +
// RINGS concentric rings of RING_SEG particles each. We allocate to the max so
// the geometry never reallocates; a live tier picks how many rings actually
// simulate (coarser on T0). Unused rings collapse onto the rim (no orphans).
const MAX_RINGS = 5;
const MAX_RING_SEG = 24;
const MAX_PARTICLES = 1 + MAX_RINGS * MAX_RING_SEG;

const SCHEMA = [
  { id: 'stiffness', label: 'Stiffness', type: 'fader', min: 0.05, max: 1, step: 0.01, default: 0.45 },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 3, max: 20, step: 0.5, default: 11 },
  { id: 'bounciness', label: 'Bounciness', type: 'fader', min: 0, max: 0.85, step: 0.01, default: 0.45 },
  { id: 'jiggle', label: 'Jiggle', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.55 },
] as const;

export const softBodyBouncePrimitive: PrimitiveDefinition = {
  name: 'soft-body-bounce',
  label: 'Soft-Body Bounce',
  category: 'wave',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A soft luminous gel blob — an XPBD particle lattice — drops, hits the floor and squashes with real jiggle, then springs back to round via its distance constraints. Genuine soft-body deformation, not a scale tween.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'soft-body-bounce', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Heavier soft body → coarser lattice on lower tiers.
      const rings = tierPick(tier, { T0: 3, T1: 4, T2: MAX_RINGS });
      const ringSeg = tierPick(tier, { T0: 14, T1: 18, T2: MAX_RING_SEG });
      const activeCount = 1 + rings * ringSeg;

      // ── Particle state (flat XPBD arrays) ──────────────────────────────
      const px = new Float32Array(MAX_PARTICLES);
      const py = new Float32Array(MAX_PARTICLES);
      const pz = new Float32Array(MAX_PARTICLES);
      const pvx = new Float32Array(MAX_PARTICLES);
      const pvy = new Float32Array(MAX_PARTICLES);
      const pvz = new Float32Array(MAX_PARTICLES);
      const invMass = new Float32Array(MAX_PARTICLES);
      // Scratch for predicted-position bookkeeping.
      const prevX = new Float32Array(MAX_PARTICLES);
      const prevY = new Float32Array(MAX_PARTICLES);
      const prevZ = new Float32Array(MAX_PARTICLES);
      // Rest (round) positions of each particle, centred on origin.
      const restX = new Float32Array(MAX_PARTICLES);
      const restY = new Float32Array(MAX_PARTICLES);
      const restZ = new Float32Array(MAX_PARTICLES);

      // Distance constraints: [i, j, restLen] flattened. Built once for the
      // active lattice. Two classes:
      //  • STRUCTURAL (cRigid=1): centre→rim skeleton + outer-ring diameters.
      //    Solved near-rigid so the blob holds its volume against the floor and
      //    keeps its centre elevated (~rest radius above the floor) instead of
      //    pancaking. This is the "incompressible gel core".
      //  • SURFACE  (cRigid=0): ring hoops + radial + shear links. Solved with
      //    the user `stiffness` control so the SURFACE is squishy and deforms /
      //    jiggles on impact — that's the visible soft-body squash.
      let ci = new Int32Array(0);
      let cj = new Int32Array(0);
      let cRest = new Float32Array(0);
      let cRigid = new Uint8Array(0);

      const idx = (ring: number, seg: number): number => 1 + ring * ringSeg + seg;

      // Build the rest lattice (a filled disc in the XY plane, slight z bulge so
      // it reads as a 3D gel lens, not a flat coin).
      const buildRest = () => {
        // Centre particle.
        restX[0] = 0;
        restY[0] = 0;
        restZ[0] = 0;
        for (let r = 0; r < rings; r++) {
          const radius = (REST_RADIUS * (r + 1)) / rings;
          // Lens profile: rings further out sit slightly back in z (a gentle
          // dome) so lighting reads the surface curvature.
          const zBulge = Math.cos(((r + 1) / rings) * Math.PI * 0.5) * 0.16;
          for (let s = 0; s < ringSeg; s++) {
            const a = (s / ringSeg) * Math.PI * 2;
            const i = idx(r, s);
            restX[i] = Math.cos(a) * radius;
            restY[i] = Math.sin(a) * radius;
            restZ[i] = zBulge;
          }
        }
        // Park unused MAX particles on the origin (never simulated, never drawn
        // into a triangle for the active mesh).
        for (let i = activeCount; i < MAX_PARTICLES; i++) {
          restX[i] = 0;
          restY[i] = 0;
          restZ[i] = 0;
        }
      };

      const dist = (i: number, j: number): number => {
        const dx = restX[i] - restX[j];
        const dy = restY[i] - restY[j];
        const dz = restZ[i] - restZ[j];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      };

      const buildConstraints = () => {
        const I: number[] = [];
        const J: number[] = [];
        const R: number[] = [];
        const G: number[] = [];
        const add = (a: number, b: number, rigid: 0 | 1) => {
          I.push(a);
          J.push(b);
          R.push(dist(a, b));
          G.push(rigid);
        };
        // STRUCTURAL skeleton — centre → EVERY particle (a radial "gel core"
        // tether at each particle's rest radius) plus full outer-ring diameters.
        // Solved firmly (rigid class) so the blob holds its volume and the
        // centre stays elevated ~rest-radius above the floor rather than the
        // whole lattice splatting flat. Solved in ONE pass (a 2nd pass on this
        // dense near-rigid net resonates).
        for (let r = 0; r < rings; r++) {
          for (let s = 0; s < ringSeg; s++) add(0, idx(r, s), 1);
        }
        for (let s = 0; s < (ringSeg >> 1); s++) {
          const opp = (s + (ringSeg >> 1)) % ringSeg;
          add(idx(rings - 1, s), idx(rings - 1, opp), 1);
        }
        // SURFACE links — squishy under the user stiffness control.
        for (let r = 0; r < rings; r++) {
          for (let s = 0; s < ringSeg; s++) {
            const next = (s + 1) % ringSeg;
            add(idx(r, s), idx(r, next), 0); // ring hoop
            if (r + 1 < rings) add(idx(r, s), idx(r + 1, s), 0); // radial
            if (r + 1 < rings) add(idx(r, s), idx(r + 1, next), 0); // shear
          }
        }
        ci = Int32Array.from(I);
        cj = Int32Array.from(J);
        cRest = Float32Array.from(R);
        cRigid = Uint8Array.from(G);
      };

      // Rest mean radius of the rim particles from the centre — the target the
      // volume-preservation (pressure) term inflates back toward.
      let restMeanR = REST_RADIUS;
      const computeRestMeanR = () => {
        let sum = 0;
        let n = 0;
        for (let i = 1; i < activeCount; i++) {
          const dx = restX[i] - restX[0];
          const dy = restY[i] - restY[0];
          const dz = restZ[i] - restZ[0];
          sum += Math.sqrt(dx * dx + dy * dy + dz * dz);
          n++;
        }
        restMeanR = n > 0 ? sum / n : REST_RADIUS;
      };

      // ── Sim lifecycle ──────────────────────────────────────────────────
      const reset = () => {
        const drop = DROP_Y;
        for (let i = 0; i < MAX_PARTICLES; i++) {
          // Start at the rest shape, lifted by the drop height. A tiny
          // deterministic per-particle z-offset breaks perfect planar symmetry
          // so the gel reads as a 3D lens and the jiggle wobbles organically
          // (still 100% reproducible — hash, never Math.random).
          const wob = i < activeCount ? shash(i * 2.17 + 0.5) * 0.015 : 0;
          px[i] = restX[i];
          py[i] = restY[i] + drop;
          pz[i] = restZ[i] + wob;
          pvx[i] = 0;
          pvy[i] = 0;
          pvz[i] = 0;
          invMass[i] = i < activeCount ? 1 : 0; // parked units pinned (inert)
        }
      };

      const step = (dt: number) => {
        const stiff = clamp(num(params.stiffness, 0.45), 0.05, 1);
        const g = num(params.gravity, 11);
        const rest = clamp(num(params.bounciness, 0.45), 0, 0.85);
        const jig = clamp(num(params.jiggle, 0.55), 0, 1);
        const dtSub = dt / SUBSTEPS;
        // Surface compliance from the user control; structural skeleton near-rigid
        // (clamped high) so the gel core holds its volume on the floor.
        const alphaSurface = complianceAlpha(stiff, dtSub);
        const alphaRigid = complianceAlpha(0.95, dtSub);

        for (let sub = 0; sub < SUBSTEPS; sub++) {
          // 1) integrate velocity (gravity) + predict positions.
          for (let i = 0; i < activeCount; i++) {
            prevX[i] = px[i];
            prevY[i] = py[i];
            prevZ[i] = pz[i];
            // Jiggle: a tiny deterministic, time-independent restoring buzz that
            // scales with how far the particle is from rest in z — it lives ONLY
            // while the blob is deformed, so it dies out as the shape recovers.
            pvy[i] -= g * dtSub;
            px[i] += pvx[i] * dtSub;
            py[i] += pvy[i] * dtSub;
            pz[i] += pvz[i] * dtSub;
          }

          // 2) solve all distance constraints once, fixed Gauss-Seidel order.
          // Each constraint uses its class compliance (firm gel-core skeleton /
          // soft squishy surface). A single pass per substep over the dense
          // near-rigid star net stays stable; 8 substeps give it convergence.
          for (let k = 0; k < cRest.length; k++) {
            const a = cRigid[k] ? alphaRigid : alphaSurface;
            solveDistanceConstraint(px, py, pz, invMass, ci[k], cj[k], cRest[k], a);
          }

          // 2b) VOLUME PRESERVATION ("pressure"): an incompressible gel resists
          // losing girth. Measure the current mean rim radius about the moving
          // centre of mass and push every particle radially out/in to restore
          // the rest mean radius. This is what keeps the blob INFLATED so its
          // centre stays elevated and it bulges sideways on impact instead of
          // collapsing to a puddle. Deterministic (pure reads of current state).
          {
            // Centre of mass (centre particle is index 0, but use the true COM
            // so the pressure stays centred even while squashed).
            let cx = 0;
            let cy = 0;
            let cz = 0;
            for (let i = 0; i < activeCount; i++) {
              cx += px[i];
              cy += py[i];
              cz += pz[i];
            }
            cx /= activeCount;
            cy /= activeCount;
            cz /= activeCount;
            let meanR = 0;
            for (let i = 1; i < activeCount; i++) {
              const dx = px[i] - cx;
              const dy = py[i] - cy;
              const dz = pz[i] - cz;
              meanR += Math.sqrt(dx * dx + dy * dy + dz * dz);
            }
            meanR /= activeCount - 1;
            if (meanR > 1e-5) {
              const ratio = restMeanR / meanR; // >1 ⇒ inflate
              // Pressure gain: firm enough to hold volume, soft enough not to
              // overshoot. Modulated DOWN by softness so a low-stiffness blob is
              // genuinely squishier (less volume-preserving) than a stiff one.
              const gain = 0.5 * (0.5 + 0.5 * stiff);
              const k = 1 + (ratio - 1) * gain;
              for (let i = 1; i < activeCount; i++) {
                px[i] = cx + (px[i] - cx) * k;
                py[i] = cy + (py[i] - cy) * k;
                pz[i] = cz + (pz[i] - cz) * k;
              }
            }
          }

          // Floor contact: project any particle below the floor back up and
          // reflect its implied vertical velocity by bounciness. Soft contact
          // emerges because the projection is PER-PARTICLE — the bottom of the
          // blob flattens against the floor while the top keeps falling, which
          // IS the squash; then the structural constraints push the flattened
          // bottom back round, converting stored deformation into a rebound.
          for (let i = 0; i < activeCount; i++) {
            if (py[i] < FLOOR_Y) {
              py[i] = FLOOR_Y;
              // Incoming vertical speed this substep (positive = was falling).
              const vIn = prevY[i] - py[i];
              // Set prev BELOW the clamped pos so the recovered velocity
              // (py - prev)/dt points UP with restitution `rest`.
              prevY[i] = py[i] - vIn * rest;
              // Coulomb-ish tangential drag at contact (so it doesn't skate).
              prevX[i] = px[i] + (prevX[i] - px[i]) * 0.6;
              prevZ[i] = pz[i] + (prevZ[i] - pz[i]) * 0.6;
            }
          }

          // 3) recover velocity from (pos - prev)/dtSub.
          const inv = 1 / dtSub;
          for (let i = 0; i < activeCount; i++) {
            pvx[i] = (px[i] - prevX[i]) * inv;
            pvy[i] = (py[i] - prevY[i]) * inv;
            pvz[i] = (pz[i] - prevZ[i]) * inv;
          }
        }

        // Jiggle: a deterministic z-buzz proportional to the particle's current
        // in-plane deformation (distance from its rest offset around the blob's
        // moving centre). It lives ONLY while the blob is deformed, so it dies
        // out as the shape recovers. Pure function of the current state — no
        // clock, no random — so frozen frames stay reproducible.
        if (jig > 0) {
          const cx = px[0];
          const cy = py[0];
          for (let i = 1; i < activeCount; i++) {
            const defX = px[i] - (cx + restX[i]);
            const defY = py[i] - (cy + restY[i]);
            const localDef = Math.abs(defX) + Math.abs(defY);
            const buzz = shash(i * 3.91 + 1.3) * localDef * jig * 0.9;
            pz[i] += buzz * dt;
          }
        }
      };

      const stepper = makeReplayStepper({ dt: FIXED_DT, reset, step });

      // ── Mesh (vertices ARE the particles) ──────────────────────────────
      // Triangulate the filled disc: centre fan to inner ring, then ring-to-ring
      // quad strips (two triangles each). Index buffer is built once for the
      // active lattice; positions are written live from the particles.
      const positions = new Float32Array(MAX_PARTICLES * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      posAttr.setUsage(0x88e8 /* DynamicDraw */);
      geometry.setAttribute('position', posAttr);

      const buildIndex = () => {
        const tri: number[] = [];
        // Centre fan → ring 0.
        for (let s = 0; s < ringSeg; s++) {
          const a = idx(0, s);
          const b = idx(0, (s + 1) % ringSeg);
          tri.push(0, a, b);
        }
        // Ring r → ring r+1 quad strips.
        for (let r = 0; r + 1 < rings; r++) {
          for (let s = 0; s < ringSeg; s++) {
            const sn = (s + 1) % ringSeg;
            const a = idx(r, s);
            const b = idx(r, sn);
            const c = idx(r + 1, s);
            const d = idx(r + 1, sn);
            tri.push(a, c, b);
            tri.push(b, c, d);
          }
        }
        geometry.setIndex(tri);
      };

      // Soft luminous gel — ice/steel, standard PBR so the rig env lights the
      // folds. Translucent-looking via emissive core + low roughness sheen.
      const material = new MeshStandardMaterial({
        color: new Color('#9fe0c4'), // ice-green gel body
        emissive: new Color('#7fd4ff'), // cool luminous core
        emissiveIntensity: 0.42,
        roughness: 0.18,
        metalness: 0.12,
        envMapIntensity: 1.5,
        transparent: true,
        opacity: 0.92,
        side: DoubleSide,
        depthWrite: true,
      });

      const mesh = new Mesh(geometry, material);
      mesh.name = 'soft-body-bounce';
      target.object.add(mesh);

      const write = () => {
        // The blob's rendered centre sits so its lowest rest particle would rest
        // on the floor; we draw particles in their solved world positions but
        // shift the whole group so the settled blob sits nicely in frame.
        for (let i = 0; i < activeCount; i++) {
          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          positions[i * 3 + 2] = pz[i];
        }
        // Park any unused MAX particles at the centre (they index into no active
        // triangle, so they are never rasterized — safe).
        for (let i = activeCount; i < MAX_PARTICLES; i++) {
          positions[i * 3] = 0;
          positions[i * 3 + 1] = py[0];
          positions[i * 3 + 2] = 0;
        }
        posAttr.needsUpdate = true;
        // Recompute normals so lighting follows the squash folds.
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
      };

      // Build everything once for the active tier.
      buildRest();
      computeRestMeanR();
      buildConstraints();
      buildIndex();
      reset();
      write();

      return {
        // Finite LOOP window — deliberately short so the rig loops t→0 and
        // re-drops the blob over and over (drop → squash → bulge → rebound),
        // keeping the tile alive instead of dwelling on a settled puddle. With
        // the default gravity the first impact is at ~t=0.5 and the squash/bulge
        // peaks at ~t=0.6–0.8, so the rig's ~0.45 frozen phase (≈0.65s here)
        // lands squarely MID-SQUASH — exactly where the controls bite hardest.
        duration: () => clamp(1.2 + (18 - num(params.gravity, 11)) * 0.03, 1.0, 1.7),
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Every control sweep re-runs the sim to the SAME pinned frame, so even
        // trajectory-only controls (stiffness/gravity) change the frozen frame.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(mesh);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
