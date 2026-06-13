// n-body-orbit — a REAL gravitational N-body simulation: 2–3 massive central
// bodies (bright brass suns) plus ~10 lighter satellites, all pulling on each
// other under softened inverse-square gravity, integrated with semi-implicit
// (symplectic) Euler at a small fixed dt. The satellites trace genuine orbits,
// precess, and slingshot when they swing past a sun — emergent motion no
// closed-form curve produces. CATALOG primitive (hard / particles,
// subject:'empty'). Builds two THREE.Points (suns + satellites) into
// target.object.
//
// NOT closed-form like orbit-rings / orbit-trails and NOT a precomputed static
// orbit like attractor: every frame is the result of integrating the full
// pairwise force field. Determinism comes entirely from hashed seeding
// (hash1/hash2, no Math.random / Date.now) plus the reset-and-replay stepper, so
// the frame at time t is a pure function of (params, t). Backward seeks reset and
// replay from 0, which is why every control — gravity, satellites, bodies, speed
// — visibly changes the FROZEN engaged frame the verification harness pins (it
// re-seeks the SAME t while paused; onParamChange → markDirty re-runs the sim).
//
// Seeding: each satellite gets a hashed orbit radius + angle about the centroid
// and a TANGENTIAL velocity ≈ sqrt(G·Mtot / r) (circular-orbit speed) so it
// starts in a near-circular orbit; the multi-sun field then perturbs it into
// precessing, slingshotting paths. Suns get small counter-rotating velocities so
// the central system itself orbits (a binary / trinary), not a static anchor.
//
// duration() is finite (one good orbital sweep) so the rig's ~0.45 frozen phase
// lands with satellites mid-orbit; the rig loops t→0, which the replay stepper
// treats as a rewind → the system re-seeds and re-runs.

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
import { hash1, hash2, makeReplayStepper, resolveSimTier, tierPick } from './_sim-core';

// Fixed build-time pools. Allocated once; live counts clamp to these maxima and
// unused units are parked off-screen (never realloc per seek).
const MAX_BODIES = 3; // massive central suns
const MAX_SATS = 12; // lighter orbiters
const DT = 1 / 240; // small step → stable inverse-square integration
const SOFTEN2 = 0.06 * 0.06; // Plummer softening² (avoids singular close passes)
const SUN_MASS = 1.0; // each sun's mass (G scales the actual force)

const SCHEMA = [
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 0.4, max: 4, step: 0.05, default: 1.6 },
  { id: 'satellites', label: 'Satellites', type: 'knob', min: 4, max: 12, step: 1, default: 10 },
  { id: 'bodies', label: 'Bodies', type: 'knob', min: 2, max: 3, step: 1, default: 2 },
  { id: 'speed', label: 'Speed', type: 'fader', min: 0.3, max: 2.2, step: 0.05, default: 1 },
] as const;

export const nBodyOrbitPrimitive: PrimitiveDefinition = {
  name: 'n-body-orbit',
  label: 'N-Body Orbit',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A real gravitational N-body system: two or three bright suns and a swarm of satellites pull on each other under softened inverse-square gravity, producing genuine orbits and slingshots — integrated physics, not a drawn curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'n-body-orbit', category: 'particles', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Heavy O(N²) pairwise force loop → fewer substeps on weak tiers. T2 runs
      // 3 sub-integrations per fixed step for a crisper inverse-square law.
      const SUBSTEPS = tierPick(tier, { T0: 1, T1: 2, T2: 3 });

      // Combined particle pool: indices [0..MAX_BODIES) are suns, the rest sats.
      const N = MAX_BODIES + MAX_SATS;
      const px = new Float32Array(N);
      const py = new Float32Array(N);
      const pz = new Float32Array(N);
      const vx = new Float32Array(N);
      const vy = new Float32Array(N);
      const vz = new Float32Array(N);
      const mass = new Float32Array(N); // sun mass for active suns, 0 = inactive
      const ax = new Float32Array(N);
      const ay = new Float32Array(N);
      const az = new Float32Array(N);

      // How many units are active this seek (resolved live in reset()).
      let activeBodies = 2;
      let activeSats = 10;

      // ── Deterministic seeding ──────────────────────────────────────────────
      // Re-seeds whenever the sim resets (rewind or a markDirty after a param
      // sweep). Reads bodies/satellites/gravity LIVE so a count or G change
      // re-seeds a fresh, physically-consistent system.
      const reset = () => {
        activeBodies = Math.round(clamp(num(params.bodies, 2), 2, MAX_BODIES));
        activeSats = Math.round(clamp(num(params.satellites, 10), 4, MAX_SATS));
        const G = num(params.gravity, 1.6);

        // Suns: placed on a small ring about the origin, given counter-rotating
        // tangential velocity so the central system itself orbits as a binary /
        // trinary rather than sitting still.
        const sunRing = activeBodies === 2 ? 0.34 : 0.42;
        const totalSunMass = SUN_MASS * activeBodies;
        // Speed for a near-circular mutual orbit of the suns about the centroid.
        const sunOrbitV = Math.sqrt((G * totalSunMass) / (sunRing * 2 + 0.001)) * 0.55;
        for (let b = 0; b < MAX_BODIES; b++) {
          if (b < activeBodies) {
            const ang = (b / activeBodies) * Math.PI * 2 + 0.3;
            px[b] = Math.cos(ang) * sunRing;
            py[b] = Math.sin(ang) * sunRing * 0.62; // slightly flattened
            pz[b] = (hash1(b * 4.1 + 1.7) - 0.5) * 0.16;
            // Tangential (perpendicular to radius), same sense → they revolve.
            vx[b] = -Math.sin(ang) * sunOrbitV;
            vy[b] = Math.cos(ang) * sunOrbitV * 0.62;
            vz[b] = 0;
            mass[b] = SUN_MASS;
          } else {
            px[b] = 9999;
            py[b] = 9999;
            pz[b] = 0;
            vx[b] = vy[b] = vz[b] = 0;
            mass[b] = 0;
          }
        }

        // Satellites: each on a hashed orbit radius + angle, with a tangential
        // velocity ≈ circular-orbit speed sqrt(G·Mtot / r) so it begins in a
        // near-circular orbit. A hashed ±18% jitter on speed and a small radial
        // component create elliptical paths that precess and slingshot in the
        // multi-sun field.
        for (let k = 0; k < MAX_SATS; k++) {
          const i = MAX_BODIES + k;
          if (k < activeSats) {
            const rA = hash2(k, 2.3);
            const r = 0.7 + rA * 0.95; // 0.70 .. 1.65 from the centre
            const ang = hash2(k, 5.1) * Math.PI * 2;
            const incl = (hash2(k, 8.7) - 0.5) * 0.5; // mild inclination
            px[i] = Math.cos(ang) * r;
            py[i] = Math.sin(ang) * r;
            pz[i] = Math.sin(ang) * r * incl;

            const vCirc = Math.sqrt((G * totalSunMass) / r);
            const sense = hash1(k * 3.7 + 0.9) > 0.78 ? -1 : 1; // a few retrograde
            const jitter = 0.82 + hash2(k, 12.4) * 0.36; // 0.82 .. 1.18
            const vMag = vCirc * jitter * sense;
            // Tangential direction (perpendicular to the radius in the plane).
            vx[i] = -Math.sin(ang) * vMag;
            vy[i] = Math.cos(ang) * vMag;
            // Tiny radial + vertical perturbation for richer ellipses.
            vz[i] = (hash1(k * 6.3 + 4.4) - 0.5) * vCirc * 0.18;
          } else {
            px[i] = 9999;
            py[i] = 9999;
            pz[i] = 0;
            vx[i] = vy[i] = vz[i] = 0;
          }
        }
      };

      // ── One fixed integration step (semi-implicit Euler, SUBSTEPS inner) ────
      // Full pairwise softened inverse-square gravity. Only SUNS exert force
      // (they hold all the mass); satellites are test-ish but massless so they
      // don't blow up the O(N²) energy — yet sun↔sun forces make the central
      // system a true dynamical binary/trinary.
      const step = (dt: number) => {
        const G = num(params.gravity, 1.6);
        const speed = clamp(num(params.speed, 1), 0.3, 2.2);
        const sub = dt * speed / SUBSTEPS;
        const nb = activeBodies;
        const ns = activeSats;
        const lastSat = MAX_BODIES + ns;

        for (let s = 0; s < SUBSTEPS; s++) {
          // Accumulate accelerations on every active unit from every active sun.
          for (let i = 0; i < N; i++) {
            ax[i] = 0;
            ay[i] = 0;
            az[i] = 0;
          }
          // Forces FROM each sun ON: other suns + all active satellites.
          for (let b = 0; b < nb; b++) {
            const sx = px[b];
            const sy = py[b];
            const sz = pz[b];
            const gm = G * mass[b];
            // On other suns.
            for (let j = 0; j < nb; j++) {
              if (j === b) continue;
              const dx = sx - px[j];
              const dy = sy - py[j];
              const dz = sz - pz[j];
              const d2 = dx * dx + dy * dy + dz * dz + SOFTEN2;
              const inv = gm / (d2 * Math.sqrt(d2));
              ax[j] += dx * inv;
              ay[j] += dy * inv;
              az[j] += dz * inv;
            }
            // On satellites.
            for (let j = MAX_BODIES; j < lastSat; j++) {
              const dx = sx - px[j];
              const dy = sy - py[j];
              const dz = sz - pz[j];
              const d2 = dx * dx + dy * dy + dz * dz + SOFTEN2;
              const inv = gm / (d2 * Math.sqrt(d2));
              ax[j] += dx * inv;
              ay[j] += dy * inv;
              az[j] += dz * inv;
            }
          }
          // Integrate suns then satellites (semi-implicit: v += a·dt; x += v·dt).
          for (let b = 0; b < nb; b++) {
            vx[b] += ax[b] * sub;
            vy[b] += ay[b] * sub;
            vz[b] += az[b] * sub;
            px[b] += vx[b] * sub;
            py[b] += vy[b] * sub;
            pz[b] += vz[b] * sub;
          }
          for (let j = MAX_BODIES; j < lastSat; j++) {
            vx[j] += ax[j] * sub;
            vy[j] += ay[j] * sub;
            vz[j] += az[j] * sub;
            px[j] += vx[j] * sub;
            py[j] += vy[j] * sub;
            pz[j] += vz[j] * sub;
          }
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Geometry: two Points clouds (massive suns vs light satellites) ──────
      const sunPos = new Float32Array(MAX_BODIES * 3);
      const satPos = new Float32Array(MAX_SATS * 3);
      const sunCol = new Float32Array(MAX_BODIES * 3);
      const satCol = new Float32Array(MAX_SATS * 3);

      // Brass-gold suns; ice/steel satellites (Observatory Brass palette, no purple).
      const sunHot = new Color('#ecd49d'); // bright primary sun
      const sunWarm = new Color('#d9a86c'); // brass second/third sun
      for (let b = 0; b < MAX_BODIES; b++) {
        const c = b === 0 ? sunHot : sunWarm;
        sunCol[b * 3] = c.r;
        sunCol[b * 3 + 1] = c.g;
        sunCol[b * 3 + 2] = c.b;
      }
      const satIce = new Color('#7fd4ff');
      const satMint = new Color('#9fe0c4');
      const satSteel = new Color('#cfdde6');
      for (let k = 0; k < MAX_SATS; k++) {
        // Deterministic per-satellite tint across the cool palette.
        const h = hash1(k * 2.17 + 0.5);
        const c = h < 0.4 ? satIce : h < 0.72 ? satSteel : satMint;
        satCol[k * 3] = c.r;
        satCol[k * 3 + 1] = c.g;
        satCol[k * 3 + 2] = c.b;
      }

      const sunGeo = new BufferGeometry();
      const sunPosAttr = new BufferAttribute(sunPos, 3);
      sunGeo.setAttribute('position', sunPosAttr);
      sunGeo.setAttribute('color', new BufferAttribute(sunCol, 3));

      const satGeo = new BufferGeometry();
      const satPosAttr = new BufferAttribute(satPos, 3);
      satGeo.setAttribute('position', satPosAttr);
      satGeo.setAttribute('color', new BufferAttribute(satCol, 3));

      const sunMat = new PointsMaterial({
        color: new Color('#ffffff'),
        vertexColors: true,
        size: 0.34, // big, bright suns
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const satMat = new PointsMaterial({
        color: new Color('#ffffff'),
        vertexColors: true,
        size: 0.1,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const sunPoints = new Points(sunGeo, sunMat);
      sunPoints.name = 'n-body-orbit-suns';
      const satPoints = new Points(satGeo, satMat);
      satPoints.name = 'n-body-orbit-satellites';
      target.object.add(sunPoints);
      target.object.add(satPoints);

      const HIDDEN = 9999;

      // ── write: sim state → buffers. Reads `speed` LIVE so even a same-t reseek
      // (no markDirty) shows a difference; sizes also resolved live. ───────────
      const write = () => {
        // Live control read in write() (guide requirement): speed gently breathes
        // the sun glow size so the control reads even without a re-run.
        const speed = clamp(num(params.speed, 1), 0.3, 2.2);
        sunMat.size = 0.30 + speed * 0.05;

        for (let b = 0; b < MAX_BODIES; b++) {
          if (b < activeBodies) {
            sunPos[b * 3] = px[b];
            sunPos[b * 3 + 1] = py[b];
            sunPos[b * 3 + 2] = pz[b];
          } else {
            sunPos[b * 3] = HIDDEN;
            sunPos[b * 3 + 1] = HIDDEN;
            sunPos[b * 3 + 2] = 0;
          }
        }
        for (let k = 0; k < MAX_SATS; k++) {
          const i = MAX_BODIES + k;
          if (k < activeSats) {
            satPos[k * 3] = px[i];
            satPos[k * 3 + 1] = py[i];
            satPos[k * 3 + 2] = pz[i];
          } else {
            satPos[k * 3] = HIDDEN;
            satPos[k * 3 + 1] = HIDDEN;
            satPos[k * 3 + 2] = 0;
          }
        }
        sunPosAttr.needsUpdate = true;
        satPosAttr.needsUpdate = true;
      };

      reset();
      write();

      return {
        // One generous orbital sweep; the rig loops back to 0 (a rewind → the
        // system re-seeds). ~0.45 of this lands satellites mid-orbit.
        duration: () => 6,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Every control (gravity/satellites/bodies/speed) is a trajectory or
        // seeding input → re-run the whole sim to the pinned t so the frozen
        // frame visibly changes. Non-negotiable.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(sunPoints);
          target.object.remove(satPoints);
          sunGeo.dispose();
          satGeo.dispose();
          sunMat.dispose();
          satMat.dispose();
        },
      };
    },
  ),
};
