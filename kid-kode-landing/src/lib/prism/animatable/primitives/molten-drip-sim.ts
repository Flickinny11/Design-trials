// molten-drip-sim — a hanging blob of VISCOUS molten metal/lava stretches under
// gravity, NECKS, and DRIPS off a glowing droplet that falls before the column
// reforms and the cycle repeats. CATALOG primitive (hard / glass, subject:'empty').
//
// REAL CPU SIM, not an easing curve. The physics:
//   • A pinned RESERVOIR sits at the top (a fat molten blob).
//   • A dynamic TIP mass (the forming droplet) hangs from it on a viscous spring.
//     It is integrated with semi-implicit (symplectic) Euler under gravity +
//     spring restoring force + viscous velocity damping. As it hangs, the spring
//     stretches and the tip's mass GROWS (surface tension drawing fluid into the
//     bead) so it sags faster — the neck above it thins.
//   • PINCH-OFF: when the neck length (reservoir-root → tip) exceeds a
//     `dripRate`-controlled threshold, the spring SEVERS — the tip becomes a free
//     ballistic DROPLET (gravity-only integration, real free-fall), and a fresh
//     tip nucleates back at the reservoir. Up to MAX_DROPS detached droplets fall
//     at once; one that passes the floor recycles. So the column reforms & drips
//     forever — exactly the pinch-off cadence of a viscous drip.
//   • VISCOSITY makes the spring softer (it draws out a longer, thinner thread
//     before letting go) and damps velocity (syrupy, not bouncy); GRAVITY pulls
//     harder; DRIPRATE sets how soon the neck severs; HEAT sets the emissive glow.
//
// The neck is rendered as a row of lobes interpolated reservoir→tip whose radius
// pinches to a minimum in the MIDDLE (the classic capillary neck profile), so the
// necking reads unmistakably. Reservoir + droplets are fat round beads.
//
// DETERMINISM: reset()-and-replay via makeReplayStepper → the frame at time t is a
// pure function of (params, t). onParamChange → markDirty makes every trajectory
// control (viscosity/gravity/dripRate) visibly change any pinned frozen frame; heat
// is ALSO read live in write() so a same-t reseek still shows a change. No
// Math.random / Date.now — z spread seeded via a fract(sin) hash.
//
// duration() is finite (a few drip cycles) and the rig loops t→0 → re-drip. The
// ~0.45 frozen phase is tuned to catch a droplet MID-DETACH / falling.
//
// Brass/amber EMISSIVE molten material (glowing) — MeshPhysicalMaterial with
// transmission + ior≈1.33 so it reads as a hot, semi-transmissive liquid. NO
// purple. DISTINCT from liquid-metal-flow (a TSL surface shader): this is a
// particle SIM that physically pinches off and drops real free-falling droplets.

import {
  InstancedMesh,
  SphereGeometry,
  MeshPhysicalMaterial,
  Color,
  Matrix4,
  Vector3,
  Quaternion,
  DynamicDrawUsage,
} from 'three';
import { defineAnimatable } from '../base';
import { num, str, type PrimitiveDefinition } from '../contract';
import {
  makeReplayStepper,
  resolveSimTier,
  tierPick,
  clamp,
} from './_sim-core';

const DT = 1 / 120; // small fixed step (stiff-ish spring)
const SOURCE_Y = 1.05; // reservoir root height (pinned)
const FLOOR_Y = -1.35; // a free droplet below this recycles to the reservoir
const MAX_DROPS = 6; // fixed pool of free falling droplets
const RESERVOIR_LOBES = 3; // fat blob lobes at the very top

const SCHEMA = [
  // Viscous resistance: high → the thread draws out long & thin before letting
  // go (slower, syrupy); low → it pinches off quickly like water.
  { id: 'viscosity', label: 'Viscosity', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.6 },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 1.5, max: 12, step: 0.1, default: 6.5 },
  // Drip rate: smaller detach length → it sheds droplets sooner / more often.
  { id: 'dripRate', label: 'Drip Rate', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.5 },
  // Heat → emissive glow of the molten material (read LIVE in write()).
  { id: 'heat', label: 'Heat', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.7 },
  { id: 'tint', label: 'Molten Tint', type: 'color', default: '#d9a86c' },
] as const;

export const moltenDripSimPrimitive: PrimitiveDefinition = {
  name: 'molten-drip-sim',
  label: 'Molten Drip',
  category: 'glass',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A hanging blob of viscous molten metal stretches under gravity, necks, and drips off a glowing droplet that falls before the column reforms — a real viscous CPU sim, not an easing curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'molten-drip-sim', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // HEAVY-ish sim: cheaper neck resolution + fewer falling droplets on T0.
      const NECK_LOBES = tierPick(tier, { T0: 5, T1: 7, T2: 9 });
      const dropCount = tierPick(tier, { T0: 3, T1: 4, T2: MAX_DROPS });
      // Fixed build-time allocation (richest tier): reservoir + neck + droplets.
      const MAX_NECK = 9;
      const MAX = RESERVOIR_LOBES + MAX_NECK + MAX_DROPS;

      // ── Tip (the forming droplet hanging on the viscous spring) ────────────
      let tipY = SOURCE_Y - 0.18;
      let tipVy = 0;
      let tipMass = 1; // grows as fluid is drawn into the bead

      // ── Free droplet pool (detached beads in ballistic free-fall) ──────────
      const dropY = new Float32Array(MAX_DROPS);
      const dropVy = new Float32Array(MAX_DROPS);
      const dropX = new Float32Array(MAX_DROPS);
      const dropZ = new Float32Array(MAX_DROPS);
      const dropR = new Float32Array(MAX_DROPS);
      const dropActive = new Uint8Array(MAX_DROPS);
      let nextDrop = 0; // round-robin slot for the next detachment

      // Deterministic per-droplet x/z jitter seed (no Math.random).
      const hash = (n: number): number => {
        const s = Math.sin(n * 12.9898) * 43758.5453;
        return s - Math.floor(s);
      };

      const reset = () => {
        tipY = SOURCE_Y - 0.18;
        tipVy = 0;
        tipMass = 1;
        nextDrop = 0;
        for (let d = 0; d < MAX_DROPS; d++) {
          dropActive[d] = 0;
          dropY[d] = FLOOR_Y - 100; // parked far below
          dropVy[d] = 0;
          dropX[d] = 0;
          dropZ[d] = 0;
          dropR[d] = 0;
        }
      };

      const step = (dt: number) => {
        const visc = clamp(num(params.viscosity, 0.6), 0, 1);
        const g = num(params.gravity, 6.5);
        const drip = clamp(num(params.dripRate, 0.5), 0, 1);

        // Neck length at which the thread severs. Higher dripRate → shorter neck
        // (sheds sooner); higher viscosity → it draws out LONGER before pinch.
        const detachLen = 0.55 + (1 - drip) * 0.5 + visc * 0.7;
        // Surface-tension "spring" RESISTING the stretch — deliberately weaker
        // than gravity so the neck keeps drawing out (an unstable filament that
        // necks toward pinch-off) rather than settling at a Hookean equilibrium.
        // Viscous fluid resists more (low-and-slow draw); water resists less.
        const k = 2.5 + visc * 5.0; // weak restoring constant
        const rest = 0.16;
        // Viscous velocity damping (syrupy → draws out slowly, water → snaps).
        const damp = 1 - (0.4 + visc * 1.6) * dt;

        // ── 1) Integrate the hanging TIP (gravity − weak surface tension) ────
        // Mass grows as fluid is drawn into the forming bead (surface tension),
        // up to a cap — a heavier tip sags faster, thinning the neck above it.
        tipMass = Math.min(tipMass + dt * (0.8 + drip * 0.6), 3.2);
        const neck = SOURCE_Y - tipY; // current neck length (root is fixed)
        const springF = k * Math.max(0, neck - rest); // upward pull, grows with stretch
        const accel = -g + springF / tipMass; // gravity wins → tip keeps descending
        tipVy += accel * dt;
        tipVy *= damp;
        tipY += tipVy * dt;

        // ── 2) PINCH-OFF when the neck stretches past detachLen ──────────────
        if (SOURCE_Y - tipY > detachLen) {
          // Spawn a free droplet at the tip, inheriting its downward velocity.
          const d = nextDrop % dropCount;
          dropActive[d] = 1;
          dropY[d] = tipY;
          dropVy[d] = Math.min(tipVy, -0.2); // ensure it's moving down
          dropX[d] = (hash(nextDrop * 1.7 + 0.3) - 0.5) * 0.18;
          dropZ[d] = (hash(nextDrop * 3.1 + 1.9) - 0.5) * 0.22;
          dropR[d] = 0.15 + tipMass * 0.03; // fatter if more fluid pooled
          nextDrop++;
          // Reservoir reforms a fresh tip back near the root.
          tipY = SOURCE_Y - rest;
          tipVy = 0;
          tipMass = 1;
        }

        // ── 3) Free droplets fall ballistically (real gravity integration) ───
        for (let d = 0; d < MAX_DROPS; d++) {
          if (!dropActive[d]) continue;
          dropVy[d] -= g * dt;
          dropY[d] += dropVy[d] * dt;
          if (dropY[d] < FLOOR_Y) {
            // Hit the molten pool below view → recycle this slot.
            dropActive[d] = 0;
            dropY[d] = FLOOR_Y - 100;
            dropVy[d] = 0;
          }
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Render: glowing molten spheres as one InstancedMesh ───────────────
      const geo = new SphereGeometry(1, 18, 12);
      const baseColor = new Color(str(params.tint, '#d9a86c'));
      const mat = new MeshPhysicalMaterial({
        color: baseColor.clone(),
        emissive: new Color('#ecd49d'), // amber glow
        emissiveIntensity: 1.0,
        roughness: 0.22,
        metalness: 0.35,
        transmission: 0.45, // semi-transmissive hot liquid
        thickness: 0.4,
        ior: 1.33,
        envMapIntensity: 1.3,
        transparent: true,
        opacity: 1,
      });
      const mesh = new InstancedMesh(geo, mat, MAX);
      mesh.name = 'molten-drip-sim';
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      target.object.add(mesh);

      const tmp = new Matrix4();
      const scl = new Vector3();
      const pos = new Vector3();
      const Q = new Quaternion(); // identity (lobes are spheres → no rotation)

      const hideInstance = (i: number) => {
        pos.set(9999, 9999, 9999);
        scl.set(0, 0, 0);
        tmp.compose(pos, Q, scl);
        mesh.setMatrixAt(i, tmp);
      };
      const setInstance = (i: number, x: number, y: number, z: number, r: number) => {
        pos.set(x, y, z);
        scl.set(r, r, r);
        tmp.compose(pos, Q, scl);
        mesh.setMatrixAt(i, tmp);
      };

      const write = () => {
        const heat = clamp(num(params.heat, 0.7), 0, 1);
        const visc = clamp(num(params.viscosity, 0.6), 0, 1);
        // Heat drives the emissive glow LIVE (visible even on a same-t reseek).
        mat.emissiveIntensity = 0.25 + heat * 1.85;
        mat.color.set(str(params.tint, '#d9a86c'));

        const fat = 0.19 * (1 - visc * 0.12); // reservoir bead radius
        let inst = 0;

        // (a) Reservoir blob — fat lobes clustered at the source root.
        for (let i = 0; i < RESERVOIR_LOBES; i++) {
          const y = SOURCE_Y + 0.06 - i * 0.085;
          const r = fat * (1.25 - i * 0.18);
          setInstance(inst++, 0, y, 0, r);
        }

        // (b) The hanging NECK: lobes interpolated root→tip. Radius pinches to a
        //     minimum in the MIDDLE (capillary neck), fattening into the forming
        //     bead at the tip — the necking reads unmistakably as the thread
        //     stretches. The bead at the tip swells with tipMass.
        const rootY = SOURCE_Y - 0.06;
        const neckLen = Math.max(0.0001, rootY - tipY);
        const tipBead = fat * (0.7 + tipMass * 0.16);
        for (let n = 0; n < MAX_NECK; n++) {
          if (n >= NECK_LOBES) {
            hideInstance(inst++);
            continue;
          }
          const f = NECK_LOBES > 1 ? n / (NECK_LOBES - 1) : 1; // 0 root → 1 tip
          const y = rootY - f * neckLen;
          // Neck profile: 1 at root, dips to a thin waist mid-thread, swells at
          // tip. Thinner overall the more the thread is stretched.
          const stretch = clamp(neckLen / 0.55, 0.6, 3);
          const waist = 1 - Math.sin(f * Math.PI) * (0.55 + (stretch - 1) * 0.16);
          const radius =
            f < 0.85
              ? fat * 0.55 * clamp(waist, 0.16, 1)
              : tipBead * (0.6 + (f - 0.85) / 0.15 * 0.4); // swell into the bead
          setInstance(inst++, 0, y, 0, Math.max(radius, 0.02));
        }

        // (c) Free falling droplets (real ballistic beads).
        for (let d = 0; d < MAX_DROPS; d++) {
          if (d >= dropCount || !dropActive[d]) {
            hideInstance(inst++);
            continue;
          }
          setInstance(inst++, dropX[d], dropY[d], dropZ[d], dropR[d]);
        }

        // Park any remaining allocation (defensive; inst should equal MAX here).
        for (; inst < MAX; inst++) hideInstance(inst);

        mesh.instanceMatrix.needsUpdate = true;
      };

      reset();
      write();

      return {
        // A few drip cycles: a more viscous (syrupy) blob draws out longer
        // before each shed, so the loop runs a touch longer.
        duration: () => clamp(3.0 + clamp(num(params.viscosity, 0.6), 0, 1) * 1.6, 2.6, 4.8),
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(mesh);
          geo.dispose();
          mat.dispose();
          mesh.dispose();
        },
      };
    },
  ),
};
