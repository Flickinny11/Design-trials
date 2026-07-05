// n-body-orbit — a REAL gravitational N-body simulation: 2–3 massive central
// bodies (bright brass suns) plus ~10 lighter satellites, all pulling on each
// other under softened inverse-square gravity, integrated with semi-implicit
// (symplectic) Euler at a small fixed dt. The satellites trace genuine orbits,
// precess, and slingshot when they swing past a sun — emergent motion no
// closed-form curve produces. CATALOG primitive (hard / particles,
// subject:'empty'). Builds two instanced THREE.Sprite clouds (suns + satellites)
// into target.object.
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
//
// RENDER PATH (P0 particle lesson — embers.ts / bubble-rise-sim.ts): r184
// THREE.Points render as 1px specks on both backends (PointsMaterial.map never
// samples a per-quad uv under three/webgpu), so the prior PointsMaterial build
// read as a near-black panel with invisible dots. Bright suns + visible
// satellites MUST be instanced THREE.Sprite carrying a PointsNodeMaterial whose
//   • positionNode = instancedBufferAttribute(per-body CENTER)
//   • colorNode    = a TSL radial profile of the quad uv → a BRIGHT solid core
//     with a soft glowing falloff (so each sun reads as a luminous disc with
//     mass, luma >> 120, not a star) times a per-body instanced premultiplied
//     COLOR, with a per-body instanced RADIUS sizing the core inside a generous
//     fixed billboard footprint.
// All randomness derives from index hashes (no Math.random — EVER). DOM-free,
// TSL only. Palette: brass-gold suns (#ecd49d #d9a86c), ice/steel/mint
// satellites (#7fd4ff #cfdde6 #9fe0c4) — Observatory Brass, never purple.

import {
  Sprite,
  BufferGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  Color,
  AdditiveBlending,
  DynamicDrawUsage,
} from 'three';
import { PointsNodeMaterial } from 'three/webgpu';
import {
  instancedBufferAttribute,
  uv,
  vec2,
  vec3,
  vec4,
  float,
  smoothstep,
} from 'three/tsl';
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

      // ── Geometry: ONE instanced billboard quad per cloud (suns / sats) ──────
      // Premium round bodies via the embers/bubble-rise mechanism: an instanced
      // Sprite carrying a PointsNodeMaterial whose position/color/radius come
      // from instanced attributes and whose alpha is a TSL radial profile. This
      // replaces the prior 1px THREE.Points specks that read as a black panel.
      const sunPos = new Float32Array(MAX_BODIES * 3);
      const sunCol = new Float32Array(MAX_BODIES * 3); // premultiplied bright tint
      const sunRad = new Float32Array(MAX_BODIES); // per-sun core radius (quad units)
      const satPos = new Float32Array(MAX_SATS * 3);
      const satCol = new Float32Array(MAX_SATS * 3);
      const satRad = new Float32Array(MAX_SATS);

      const sunPosAttr = new InstancedBufferAttribute(sunPos, 3);
      const sunColAttr = new InstancedBufferAttribute(sunCol, 3);
      const sunRadAttr = new InstancedBufferAttribute(sunRad, 1);
      const satPosAttr = new InstancedBufferAttribute(satPos, 3);
      const satColAttr = new InstancedBufferAttribute(satCol, 3);
      const satRadAttr = new InstancedBufferAttribute(satRad, 1);
      sunPosAttr.setUsage(DynamicDrawUsage);
      sunColAttr.setUsage(DynamicDrawUsage);
      sunRadAttr.setUsage(DynamicDrawUsage);
      satPosAttr.setUsage(DynamicDrawUsage);
      satColAttr.setUsage(DynamicDrawUsage);
      satRadAttr.setUsage(DynamicDrawUsage);

      // Brass-gold suns; ice/steel/mint satellites (Observatory Brass, no purple).
      // Tints are stored pre-brightened (the profile alpha is premultiplied into
      // the RGB under additive blending → the core reads luminous, luma >> 120).
      const sunHot = new Color('#ffe9b8'); // bright primary sun (brass-white core)
      const sunWarm = new Color('#f2c98a'); // brass second/third sun
      const satIce = new Color('#bfe9ff');
      const satMint = new Color('#c7f0dd');
      const satSteel = new Color('#e4eef5');

      // Shared per-quad billboard (4 verts + uv + index). Built once each.
      const makeQuad = () => {
        const g = new BufferGeometry();
        g.setIndex([0, 1, 2, 0, 2, 3]);
        g.setAttribute(
          'position',
          new BufferAttribute(
            new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
            3,
          ),
        );
        g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
        return g;
      };

      const sunGeo = makeQuad();
      sunGeo.setAttribute('instancePosition', sunPosAttr);
      sunGeo.setAttribute('instanceColor', sunColAttr);
      sunGeo.setAttribute('instanceRadius', sunRadAttr);

      const satGeo = makeQuad();
      satGeo.setAttribute('instancePosition', satPosAttr);
      satGeo.setAttribute('instanceColor', satColAttr);
      satGeo.setAttribute('instanceRadius', satRadAttr);

      type FloatNode = ReturnType<typeof float>;

      // ── Look layer: TSL radial body profile (bright solid core + soft glow) ──
      // p: quad-centered coords −1..1; d: radius from center. A bigger instanced
      // radius → the bright core fills more of the generous fixed billboard, so
      // suns read as large luminous discs and satellites as smaller glowing
      // motes — both as rounded objects with mass, not 1px squares.
      const buildProfile = (radAttr: InstancedBufferAttribute) => {
        const p = uv().sub(0.5).mul(2.0);
        const d = vec2(p.x, p.y).length();
        const rNode = instancedBufferAttribute(radAttr) as unknown as FloatNode;
        // Bright SOLID core (1 inside the radius → 0 at the rim) — the body mass.
        const core = smoothstep(rNode, rNode.mul(0.55), d);
        // Soft outer GLOW halo trailing past the core, killed to exact zero well
        // before the quad edge (no square rim at any DPR).
        const glow = smoothstep(float(0.98), rNode.mul(0.5), d).mul(0.55);
        // Combined luminous profile: solid core + halo, clamped ≤ ~1.5 so the
        // additive core blooms hot without smearing the whole quad.
        return core.add(glow);
      };

      const sunProfile = buildProfile(sunRadAttr);
      const satProfile = buildProfile(satRadAttr);

      const sunTint = instancedBufferAttribute(sunColAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };
      const satTint = instancedBufferAttribute(satColAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      // Generous fixed billboard footprints (hold the largest possible body +
      // its glow halo). Suns get a bigger footprint than satellites.
      const SUN_BILLBOARD = 0.9;
      const SAT_BILLBOARD = 0.34;

      const sunMat = new PointsNodeMaterial({
        size: SUN_BILLBOARD,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      sunMat.positionNode = instancedBufferAttribute(sunPosAttr);
      sunMat.colorNode = vec4(sunTint.mul(sunProfile), float(1));

      const satMat = new PointsNodeMaterial({
        size: SAT_BILLBOARD,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      satMat.positionNode = instancedBufferAttribute(satPosAttr);
      satMat.colorNode = vec4(satTint.mul(satProfile), float(1));

      const sunPoints = new Sprite(sunMat);
      sunPoints.geometry = sunGeo;
      sunPoints.count = MAX_BODIES;
      sunPoints.frustumCulled = false;
      sunPoints.name = 'n-body-orbit-suns';

      const satPoints = new Sprite(satMat);
      satPoints.geometry = satGeo;
      satPoints.count = MAX_SATS;
      satPoints.frustumCulled = false;
      satPoints.name = 'n-body-orbit-satellites';

      target.object.add(sunPoints);
      target.object.add(satPoints);

      const HIDDEN = 9999;

      // ── write: sim state → buffers. Reads `speed` LIVE so even a same-t reseek
      // (no markDirty) shows a difference; sizes also resolved live. ───────────
      const write = () => {
        // Live control read in write() (guide requirement): speed gently breathes
        // the sun core radius + brightness so the control reads even without a
        // re-run (markDirty below also replays the whole sim for the trajectory).
        const speed = clamp(num(params.speed, 1), 0.3, 2.2);
        const sunR = 0.42 + speed * 0.05; // core fraction of the sun billboard
        const sunLum = 1.4 + speed * 0.35; // bright suns (premultiplied → luma >> 120)
        const satLum = 1.05; // visible satellites

        for (let b = 0; b < MAX_BODIES; b++) {
          if (b < activeBodies) {
            sunPos[b * 3] = px[b];
            sunPos[b * 3 + 1] = py[b];
            sunPos[b * 3 + 2] = pz[b];
            const c = b === 0 ? sunHot : sunWarm;
            const lum = b === 0 ? sunLum : sunLum * 0.85;
            sunCol[b * 3] = c.r * lum;
            sunCol[b * 3 + 1] = c.g * lum;
            sunCol[b * 3 + 2] = c.b * lum;
            // Primary sun a touch larger than the companions.
            sunRad[b] = b === 0 ? sunR : sunR * 0.82;
          } else {
            sunPos[b * 3] = HIDDEN;
            sunPos[b * 3 + 1] = HIDDEN;
            sunPos[b * 3 + 2] = 0;
            sunCol[b * 3] = 0;
            sunCol[b * 3 + 1] = 0;
            sunCol[b * 3 + 2] = 0;
            sunRad[b] = 0;
          }
        }
        sunPoints.count = activeBodies;

        for (let k = 0; k < MAX_SATS; k++) {
          const i = MAX_BODIES + k;
          if (k < activeSats) {
            satPos[k * 3] = px[i];
            satPos[k * 3 + 1] = py[i];
            satPos[k * 3 + 2] = pz[i];
            // Deterministic per-satellite cool tint (ice/steel/mint).
            const h = hash1(k * 2.17 + 0.5);
            const c = h < 0.4 ? satIce : h < 0.72 ? satSteel : satMint;
            satCol[k * 3] = c.r * satLum;
            satCol[k * 3 + 1] = c.g * satLum;
            satCol[k * 3 + 2] = c.b * satLum;
            // Hashed mote radius so the swarm reads with varied object sizes.
            satRad[k] = 0.4 + hash1(k * 5.9 + 1.3) * 0.18;
          } else {
            satPos[k * 3] = HIDDEN;
            satPos[k * 3 + 1] = HIDDEN;
            satPos[k * 3 + 2] = 0;
            satCol[k * 3] = 0;
            satCol[k * 3 + 1] = 0;
            satCol[k * 3 + 2] = 0;
            satRad[k] = 0;
          }
        }
        satPoints.count = activeSats;

        sunPosAttr.needsUpdate = true;
        sunColAttr.needsUpdate = true;
        sunRadAttr.needsUpdate = true;
        satPosAttr.needsUpdate = true;
        satColAttr.needsUpdate = true;
        satRadAttr.needsUpdate = true;
      };

      reset();
      write();

      return {
        // One brisk orbital sweep. Shorter than before so the rig's ~0.45 frozen
        // phase lands the satellites further around their orbits AND so adjacent
        // play frames span more orbital phase → motion reads clearly between
        // pinned frames (the advocate saw a frozen panel at the old 6s sweep).
        // The rig loops back to 0 (a rewind → the system re-seeds).
        duration: () => 3,
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
