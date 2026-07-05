// water-balloon-wobble — a pressurized SOFT balloon. An XPBD particle shell
// (a UV-sphere of masses) is held round by TWO forces: distance constraints
// along the surface edges keep the skin taut, and a global VOLUME / PRESSURE
// restoring push (every particle is shoved radially along its own normal in
// proportion to how far the enclosed volume has drifted from its rest volume)
// gives it the springy "it wants to be a sphere" feel of a water balloon. A
// deterministic scripted poke dents the near side; the skin caves, the trapped
// "water" sloshes the dent around the surface, and the pressure term inflates
// it back — overshooting and wobbling before it settles, then re-poking on a
// loop. CATALOG primitive (hard / wave, subject:'sphere').
//
// This is a GENUINE simulation, not an easing curve: it holds per-particle
// velocity, integrates gravity + pressure with XPBD small-substep solving, and
// the frame at time t is a pure function of (params, t) because the replay
// stepper resets-and-replays on a backward seek. So every control — stiffness,
// pressure, damping, poke — visibly changes any frozen frame the verification
// harness pins (onParamChange → markDirty). The ~0.45 frozen phase lands the
// balloon MID-WOBBLE, dented and recovering, where the controls bite hardest.
//
// We GENERATE the soft shell (the sim mesh IS the rendered artifact: a
// translucent water-gel sphere) and add it to target.object, hiding the host
// 'sphere' subject for the lifetime of the primitive; dispose() restores it.
// The shell runs at sim resolution so each rendered vertex IS a sim particle —
// no proxy mapping — and computeVertexNormals() makes the lighting follow the
// dents and folds.

import {
  Mesh,
  BufferGeometry,
  BufferAttribute,
  MeshPhysicalMaterial,
  Color,
  DoubleSide,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import {
  makeReplayStepper,
  resolveSimTier,
  tierPick,
  complianceAlpha,
  solveDistanceConstraint,
  hash1,
} from './_sim-core';

const DT = 1 / 90; // one rendered frame of sim time
const SUBSTEPS = 8; // XPBD small-steps per frame (the recipe)
const RADIUS = 0.78; // rest radius of the balloon (≈ the host sphere's 0.82)
const POKE_PERIOD = 3.6; // seconds between scripted pokes (loop the wobble)
const GRAVITY = 1.1; // gentle sag — a water balloon is heavy but mostly held
const POKE_VEL = 2.4; // peak inward velocity (units/s) of a full-strength poke
const ANCHOR_BASE = 18; // skin-tension restoring (units/s² per unit displacement)
const ANCHOR_GAIN = 26; // extra anchor stiffness scaled by the stiffness control

const SCHEMA = [
  { id: 'stiffness', label: 'Skin Stiffness', type: 'knob', min: 0.05, max: 1, step: 0.01, default: 0.4 },
  { id: 'pressure', label: 'Pressure', type: 'knob', min: 0.2, max: 6, step: 0.05, default: 2.6 },
  { id: 'damping', label: 'Damping', type: 'fader', min: 0.2, max: 6, step: 0.05, default: 1.6 },
  { id: 'poke', label: 'Poke Force', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.62 },
] as const;

export const waterBalloonWobblePrimitive: PrimitiveDefinition = {
  name: 'water-balloon-wobble',
  label: 'Water Balloon Wobble',
  category: 'wave',
  difficulty: 'hard',
  subject: 'sphere',
  defaultDriver: 'pointer',
  description:
    'A pressurized soft balloon: an XPBD particle shell held round by surface springs plus a volume/pressure restoring force. Poke it and the skin dents, the trapped water sloshes, and it wobbles back to round — physics, not an easing curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'water-balloon-wobble', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Sim resolution = render resolution. Heavy cloth-like solve → coarser on
      // T0 so it degrades gracefully; full fidelity at T2 (the catalog default).
      const RINGS = tierPick(tier, { T0: 10, T1: 14, T2: 18 }); // latitude bands
      const SECT = tierPick(tier, { T0: 14, T1: 20, T2: 26 }); // longitude segs

      // ── Build the UV-sphere particle topology ────────────────────────────
      // Particles: 2 poles + (RINGS-1)*SECT interior vertices. Each interior
      // ring shares the SAME SECT longitude columns; poles are single shared
      // particles so the mesh closes without a seam in the sim.
      const N = 2 + (RINGS - 1) * SECT;
      const TOP = 0; // north pole particle index
      const BOT = 1; // south pole particle index
      const ringBase = (r: number) => 2 + (r - 1) * SECT; // first idx of ring r

      // Rest unit directions (sphere normals) — the seed shape, and the axis the
      // pressure term pushes along. Deterministic by construction.
      const restDir = new Float32Array(N * 3);
      const setDir = (idx: number, x: number, y: number, z: number) => {
        restDir[idx * 3] = x;
        restDir[idx * 3 + 1] = y;
        restDir[idx * 3 + 2] = z;
      };
      setDir(TOP, 0, 1, 0);
      setDir(BOT, 0, -1, 0);
      for (let r = 1; r < RINGS; r++) {
        const phi = (r / RINGS) * Math.PI; // 0..π latitude
        const sy = Math.cos(phi);
        const sr = Math.sin(phi);
        for (let c = 0; c < SECT; c++) {
          const theta = (c / SECT) * Math.PI * 2;
          setDir(ringBase(r) + c, sr * Math.cos(theta), sy, sr * Math.sin(theta));
        }
      }

      // ── Flat particle state (the XPBD arrays) ────────────────────────────
      const px = new Float32Array(N);
      const py = new Float32Array(N);
      const pz = new Float32Array(N);
      const pvx = new Float32Array(N);
      const pvy = new Float32Array(N);
      const pvz = new Float32Array(N);
      const invMass = new Float32Array(N); // all dynamic (1); no pinning here
      const prevX = new Float32Array(N);
      const prevY = new Float32Array(N);
      const prevZ = new Float32Array(N);

      // ── Distance constraints (the taut skin) ─────────────────────────────
      // Ring-circumference links (neighbour columns), longitude links (ring to
      // ring), pole links, and a short diagonal shear so the skin holds its
      // shape rather than collapsing into a paper bag. Stored as flat (i, j,
      // rest) triples in fixed order → deterministic Gauss-Seidel.
      const cI: number[] = [];
      const cJ: number[] = [];
      const cRest: number[] = [];
      const dist = (a: number, b: number) => {
        const dx = restDir[a * 3] - restDir[b * 3];
        const dy = restDir[a * 3 + 1] - restDir[b * 3 + 1];
        const dz = restDir[a * 3 + 2] - restDir[b * 3 + 2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz) * RADIUS;
      };
      const addC = (a: number, b: number) => {
        cI.push(a);
        cJ.push(b);
        cRest.push(dist(a, b));
      };
      for (let r = 1; r < RINGS; r++) {
        const base = ringBase(r);
        for (let c = 0; c < SECT; c++) {
          const cur = base + c;
          const nxt = base + ((c + 1) % SECT); // wrap the ring
          addC(cur, nxt); // circumference
          if (r === 1) addC(TOP, cur); // cap to north pole
          if (r === RINGS - 1) addC(BOT, cur); // cap to south pole
          if (r < RINGS - 1) {
            const below = ringBase(r + 1) + c;
            addC(cur, below); // longitude (ring→ring)
            addC(cur, ringBase(r + 1) + ((c + 1) % SECT)); // shear diagonal
          }
        }
      }
      const CCOUNT = cI.length;

      // Rest volume of the seeded sphere (target for the pressure term).
      const restVol = (4 / 3) * Math.PI * RADIUS * RADIUS * RADIUS;

      // ── Geometry: one triangle quad per (ring,col) cell + pole fans ───────
      const tris: number[] = [];
      for (let r = 1; r < RINGS - 1; r++) {
        const base = ringBase(r);
        const below = ringBase(r + 1);
        for (let c = 0; c < SECT; c++) {
          const c1 = (c + 1) % SECT;
          const a = base + c;
          const b = base + c1;
          const d = below + c;
          const e = below + c1;
          tris.push(a, d, b, b, d, e);
        }
      }
      // North cap fan.
      {
        const base = ringBase(1);
        for (let c = 0; c < SECT; c++) tris.push(TOP, base + c, base + ((c + 1) % SECT));
      }
      // South cap fan.
      {
        const base = ringBase(RINGS - 1);
        for (let c = 0; c < SECT; c++) tris.push(BOT, base + ((c + 1) % SECT), base + c);
      }

      const positions = new Float32Array(N * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setIndex(tris);
      geometry.computeVertexNormals();

      // Translucent water-gel skin (ice palette, NO purple). Physical material
      // with transmission so it reads as a wobbling sack of water.
      const material = new MeshPhysicalMaterial({
        color: new Color('#9fe0c4'),
        emissive: new Color('#0e2a33'),
        emissiveIntensity: 0.35,
        roughness: 0.12,
        metalness: 0,
        transmission: 0.82,
        thickness: 0.9,
        ior: 1.33, // water
        attenuationColor: new Color('#7fd4ff'),
        attenuationDistance: 1.6,
        clearcoat: 0.6,
        clearcoatRoughness: 0.18,
        envMapIntensity: 1.3,
        transparent: true,
        side: DoubleSide, // see the far wall through the gel
      });

      const shell = new Mesh(geometry, material);
      shell.name = 'water-balloon-wobble';
      target.object.add(shell);

      // Hide the host sphere subject for our lifetime (our shell replaces it).
      const subject = target.subject;
      const subjectWasVisible = subject ? subject.visible : true;
      if (subject) subject.visible = false;

      // ── Sim lifecycle ────────────────────────────────────────────────────
      let lastPoke = -1; // last poke interval applied
      let simClock = 0; // local integrated time (drives the poke schedule)

      const reset = () => {
        for (let i = 0; i < N; i++) {
          px[i] = restDir[i * 3] * RADIUS;
          py[i] = restDir[i * 3 + 1] * RADIUS;
          pz[i] = restDir[i * 3 + 2] * RADIUS;
          pvx[i] = 0;
          pvy[i] = 0;
          pvz[i] = 0;
          invMass[i] = 1;
        }
        lastPoke = -1;
      };

      /** Deterministic poke: dent a near-side patch inward (toward −normal),
       *  centred on a hemisphere point that drifts per interval (hashed) so the
       *  loop never repeats the exact same dent. Pointer biases the centre when
       *  the stage supplies one. The poke strength scales with the live 'poke'
       *  control. */
      const applyPoke = (intervalIndex: number) => {
        const pokeAmt = clamp(num(params.poke, 0.62), 0, 1);
        if (pokeAmt <= 0) return;
        // Poke centre: front hemisphere (+z toward camera) nudged by hash and
        // by the pointer if present.
        const ptr = (target.userData as { pointer?: { x: number; y: number } }).pointer;
        const hx = (hash1(intervalIndex * 3.1 + 0.7) - 0.5) * 1.4;
        const hy = (hash1(intervalIndex * 5.9 + 2.3) - 0.5) * 1.4;
        let cx = hx;
        let cy = hy;
        if (ptr) {
          cx = (ptr.x - 0.5) * 2.0; // 0..1 → −1..1 across the front face
          cy = (0.5 - ptr.y) * 2.0; // screen-y is inverted
        }
        // Direction of the poke centre on the unit sphere (front-biased).
        let dx = cx;
        let dy = cy;
        let dz = 0.85; // strong +z so the dent faces the camera
        const dl = Math.hypot(dx, dy, dz) || 1;
        dx /= dl;
        dy /= dl;
        dz /= dl;
        const force = pokeAmt * POKE_VEL; // peak inward velocity (units/s)
        // Push every particle within an angular cap inward (toward the sphere
        // centre) with a smooth radial falloff — a finger denting the skin.
        for (let i = 0; i < N; i++) {
          const ndot = restDir[i * 3] * dx + restDir[i * 3 + 1] * dy + restDir[i * 3 + 2] * dz;
          if (ndot <= 0.55) continue; // only the patch near the poke centre
          const fall = (ndot - 0.55) / 0.45; // 0 at edge → 1 at centre
          const k = fall * fall * force;
          // Inward = toward origin = −own rest normal.
          pvx[i] -= restDir[i * 3] * k;
          pvy[i] -= restDir[i * 3 + 1] * k;
          pvz[i] -= restDir[i * 3 + 2] * k;
        }
      };

      /** Current enclosed volume via the signed-tetrahedron sum over the
       *  triangle mesh (deterministic, fixed triangle order). */
      const computeVolume = (): number => {
        let v = 0;
        for (let t = 0; t < tris.length; t += 3) {
          const a = tris[t];
          const b = tris[t + 1];
          const c = tris[t + 2];
          // (a · (b × c)) / 6 summed over outward-facing triangles.
          const bx = py[b] * pz[c] - pz[b] * py[c];
          const by = pz[b] * px[c] - px[b] * pz[c];
          const bz = px[b] * py[c] - py[b] * px[c];
          v += px[a] * bx + py[a] * by + pz[a] * bz;
        }
        return v / 6;
      };

      const step = (dt: number) => {
        const stiffness = clamp(num(params.stiffness, 0.4), 0.05, 1);
        const pressure = num(params.pressure, 2.6);
        const damping = clamp(num(params.damping, 1.6), 0.2, 6);
        const dtSub = dt / SUBSTEPS;
        const alphaTilde = complianceAlpha(stiffness, dtSub);
        // Velocity damping factor per substep (exp so it's dt-stable).
        const dragMul = Math.exp(-damping * dtSub);

        for (let s = 0; s < SUBSTEPS; s++) {
          // PRESSURE / VOLUME restoring force. The balloon "wants" its rest
          // volume: when the global enclosed volume drops below rest (a poke
          // squashes it) the whole skin is pushed OUTWARD along each particle's
          // rest normal — the sum of radial pushes toward the target volume the
          // spec calls for. `deficit` is the dimensionless fractional volume
          // error (>0 squashed), `pressure` scales the radial acceleration.
          const vol = computeVolume();
          const deficit = clamp((restVol - vol) / restVol, -1, 1); // ±1 cap
          const pAccel = deficit * pressure;
          // SKIN-TENSION anchor: each particle is also pulled back toward its
          // rest sphere position by a per-particle radial spring. This is what
          // makes a pressurized membrane LOCALLY stable — without it the global
          // volume push, fighting only soft distance constraints, slowly
          // inflates the shell without bound. The anchor strength rides with the
          // skin stiffness so a stiffer skin snaps back rounder. It is a true
          // displacement spring (force ∝ −(pos − restPos)), so it dissipates
          // rather than injects energy: the system can only settle to rest.
          const anchorK = ANCHOR_BASE + stiffness * ANCHOR_GAIN; // units/s² per unit
          for (let i = 0; i < N; i++) {
            const rx = restDir[i * 3] * RADIUS;
            const ry = restDir[i * 3 + 1] * RADIUS;
            const rz = restDir[i * 3 + 2] * RADIUS;
            // pressure (outward along rest normal) − anchor (toward rest pos).
            const ax = restDir[i * 3] * pAccel - (px[i] - rx) * anchorK;
            const ay = restDir[i * 3 + 1] * pAccel - (py[i] - ry) * anchorK - GRAVITY;
            const az = restDir[i * 3 + 2] * pAccel - (pz[i] - rz) * anchorK;
            pvx[i] += ax * dtSub;
            pvy[i] += ay * dtSub;
            pvz[i] += az * dtSub;
            // damp
            pvx[i] *= dragMul;
            pvy[i] *= dragMul;
            pvz[i] *= dragMul;
            // save prev + predict
            prevX[i] = px[i];
            prevY[i] = py[i];
            prevZ[i] = pz[i];
            px[i] += pvx[i] * dtSub;
            py[i] += pvy[i] * dtSub;
            pz[i] += pvz[i] * dtSub;
          }
          // 2) solve all distance constraints ONCE in fixed order.
          for (let k = 0; k < CCOUNT; k++) {
            solveDistanceConstraint(px, py, pz, invMass, cI[k], cJ[k], cRest[k], alphaTilde);
          }
          // 3) velocity = (pos − prevPos)/dtSub.
          const invDt = 1 / dtSub;
          for (let i = 0; i < N; i++) {
            pvx[i] = (px[i] - prevX[i]) * invDt;
            pvy[i] = (py[i] - prevY[i]) * invDt;
            pvz[i] = (pz[i] - prevZ[i]) * invDt;
          }
        }
      };

      // The replay clock owns reset-and-replay (rewind / markDirty); we drive
      // the poke SCHEDULE off the same integrated time inside step() so a reset
      // re-seeds poke 0 and re-pokes land at the same wall-times every replay —
      // making the frame a pure function of (params, t).
      const reset2 = () => {
        reset();
        simClock = 0;
        applyPoke(0); // seed the opening poke so phase 0 already wobbles
        lastPoke = 0;
      };
      const stepWithPokes = (dt: number) => {
        step(dt);
        // Advance our own clock and check whether we crossed a poke boundary.
        simClock += dt;
        const interval = Math.floor(simClock / POKE_PERIOD);
        if (interval > lastPoke) {
          for (let iv = lastPoke + 1; iv <= interval; iv++) applyPoke(iv);
          lastPoke = interval;
        }
      };
      const stepper = makeReplayStepper({ dt: DT, reset: reset2, step: stepWithPokes });

      const write = () => {
        for (let i = 0; i < N; i++) {
          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          positions[i * 3 + 2] = pz[i];
        }
        posAttr.needsUpdate = true;
        geometry.computeVertexNormals();
      };

      reset2();
      write();

      return {
        duration: () => Infinity, // continuous looped wobble
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Trajectory-only controls (stiffness/pressure/damping/poke) must change
        // the frozen frame: re-run the sim to the same pinned t.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(shell);
          geometry.dispose();
          material.dispose();
          if (subject) subject.visible = subjectWasVisible;
        },
      };
    },
  ),
};
