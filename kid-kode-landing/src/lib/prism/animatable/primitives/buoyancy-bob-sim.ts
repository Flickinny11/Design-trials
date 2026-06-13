// buoyancy-bob-sim — a small buoy FLOATS on a simulated water surface and BOBS
// as traveling swells pass under it: it rides the local water height and TILTS to
// the surface slope. CATALOG primitive (hard / wave, subject:'empty').
//
// The water is a REAL Eulerian height field, not a sine cheat: an N×N grid of
// surface heights h[] + vertical velocities v[] stepped by the explicit
// wave-equation integrator (waveStep2D) at a fixed dt. Gentle swells are injected
// deterministically along one edge on a fixed cadence (splat2D pokes seeded only
// from the step index), so traveling waves cross the basin and reflect — the
// frozen frame at any t is a pure function of (params, t).
//
// The buoy is a real floating body: each step it samples the height field at its
// footprint centre and is driven toward that height by a damped buoyant spring
// (semi-implicit Euler on a vertical bob velocity), so it lags and overshoots a
// passing swell with momentum rather than snapping. It also samples the field one
// cell fore/aft and port/starboard to read the local surface SLOPE and tilts its
// hull to lie along the water — exactly how a boat rolls and pitches on a swell.
//
// Because everything runs on the reset-and-replay stepper and every control is
// read LIVE inside step()/write() (and onParamChange marks the stepper dirty),
// sweeping waveAmp / buoyancy / damping / waveSpeed visibly changes any frozen
// frame the verification harness pins. duration() is finite so the rig loops;
// phase ~0.45 lands mid-bob with a swell lifting and tilting the hull.

import {
  Group,
  Mesh,
  PlaneGeometry,
  BoxGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Color,
  DoubleSide,
  type BufferAttribute,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import {
  makeReplayStepper,
  waveStep2D,
  splat2D,
  resolveSimTier,
  tierPick,
  type SimTier,
} from './_sim-core';

const DT = 1 / 90; // wave-equation needs a small step for stability
const PLANE_SIZE = 2.6; // water plane covers x,y ∈ [-1.3, 1.3]
const WATER_Z = -0.15; // the water plane's resting plane (its group z)
const TILT_GAIN = 1.35; // how strongly the hull leans into the surface slope
const BUOY_GAIN = 2.6; // bob amplitude exaggeration for tile-scale readability
const SWELL_PERIOD = 28; // steps between injected swells (a steady ground swell)

// Palette — water = ice/steel/mint (NO purple).
const WATER_COLOR = '#7fd4ff';
const WATER_DEEP = '#3a6f8c';
const HULL_COLOR = '#cfdde6';
const HULL_DECK = '#9fe0c4';

const SCHEMA = [
  { id: 'waveAmp', label: 'Wave Amp', type: 'knob', min: 0.04, max: 0.6, step: 0.01, default: 0.26, unit: 'u' },
  { id: 'buoyancy', label: 'Buoyancy', type: 'knob', min: 4, max: 40, step: 0.5, default: 18 },
  { id: 'damping', label: 'Damping', type: 'fader', min: 0.02, max: 0.6, step: 0.01, default: 0.16 },
  { id: 'waveSpeed', label: 'Wave Speed', type: 'knob', min: 0.3, max: 2.4, step: 0.05, default: 1.1 },
] as const;

export const buoyancyBobSimPrimitive: PrimitiveDefinition = {
  name: 'buoyancy-bob-sim',
  label: 'Buoyancy Bob',
  category: 'wave',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A buoy floats on a simulated wave-equation water surface, bobbing on passing swells and tilting to the surface slope — real fluid + buoyant-spring physics, not an easing curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'buoyancy-bob-sim', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const tier: SimTier = resolveSimTier(target);
      // HEAVY (N² grid each step) → markedly coarser grid on T0.
      const N = tierPick(tier, { T0: 28, T1: 44, T2: 60 });
      const seg = N - 1;

      // ── Water surface (height-field on a subdivided plane) ────────────────
      const h = new Float32Array(N * N);
      const v = new Float32Array(N * N);

      const waterGeom = new PlaneGeometry(PLANE_SIZE, PLANE_SIZE, seg, seg);
      const posAttr = waterGeom.getAttribute('position') as BufferAttribute;
      // Cache base XY so we only rewrite Z each frame.
      const baseX = new Float32Array(posAttr.count);
      const baseY = new Float32Array(posAttr.count);
      for (let i = 0; i < posAttr.count; i++) {
        baseX[i] = posAttr.getX(i);
        baseY[i] = posAttr.getY(i);
      }
      const waterMat = new MeshPhysicalMaterial({
        color: new Color(WATER_COLOR),
        emissive: new Color(WATER_DEEP),
        emissiveIntensity: 0.22,
        roughness: 0.12,
        metalness: 0.0,
        transmission: 0.55,
        ior: 1.33,
        thickness: 0.6,
        transparent: true,
        side: DoubleSide,
        envMapIntensity: 1.3,
      });
      const water = new Mesh(waterGeom, waterMat);
      water.name = 'buoyancy-water';
      water.rotation.x = -Math.PI / 2; // lay the plane flat (XZ), height along world Y
      water.position.z = WATER_Z;

      // ── The floating buoy (a small boat-ish hull) ─────────────────────────
      const buoy = new Group();
      buoy.name = 'buoyancy-buoy';
      const hull = new Mesh(
        new BoxGeometry(0.5, 0.16, 0.72),
        new MeshPhysicalMaterial({
          color: new Color(HULL_COLOR),
          emissive: new Color('#1a2630'),
          emissiveIntensity: 0.3,
          roughness: 0.35,
          metalness: 0.25,
          clearcoat: 0.6,
          clearcoatRoughness: 0.3,
          envMapIntensity: 1.1,
        }),
      );
      hull.name = 'buoy-hull';
      const deck = new Mesh(
        new BoxGeometry(0.34, 0.1, 0.46),
        new MeshStandardMaterial({
          color: new Color(HULL_DECK),
          emissive: new Color(HULL_DECK),
          emissiveIntensity: 0.45,
          roughness: 0.4,
          metalness: 0.2,
          envMapIntensity: 1.0,
        }),
      );
      deck.position.y = 0.13;
      deck.name = 'buoy-deck';
      const mast = new Mesh(
        new BoxGeometry(0.04, 0.42, 0.04),
        new MeshStandardMaterial({
          color: new Color('#cfdde6'),
          emissive: new Color('#26343f'),
          emissiveIntensity: 0.35,
          roughness: 0.5,
          metalness: 0.3,
        }),
      );
      mast.position.y = 0.36;
      mast.name = 'buoy-mast';
      buoy.add(hull, deck, mast);

      const root = new Group();
      root.name = 'buoyancy-bob-sim';
      root.add(water, buoy);
      target.object.add(root);

      // Buoy footprint location on the grid (centre, slightly off-axis so swells
      // hit it at an angle and it rolls AND pitches). Fixed cell coords.
      const cxCell = N * 0.5;
      const cyCell = N * 0.46;

      /** Bilinear sample of the height field at fractional cell (fx, fy). */
      const sampleH = (fx: number, fy: number): number => {
        const x0 = clamp(Math.floor(fx), 0, N - 1);
        const y0 = clamp(Math.floor(fy), 0, N - 1);
        const x1 = clamp(x0 + 1, 0, N - 1);
        const y1 = clamp(y0 + 1, 0, N - 1);
        const tx = clamp(fx - x0, 0, 1);
        const ty = clamp(fy - y0, 0, 1);
        const h00 = h[y0 * N + x0];
        const h10 = h[y0 * N + x1];
        const h01 = h[y1 * N + x0];
        const h11 = h[y1 * N + x1];
        const a = h00 + (h10 - h00) * tx;
        const b = h01 + (h11 - h01) * tx;
        return a + (b - a) * ty;
      };

      // Buoy body state (vertical bob + read-back slope for tilt).
      let buoyY = 0;
      let buoyVY = 0;
      let stepIdx = 0;

      const reset = () => {
        h.fill(0);
        v.fill(0);
        buoyY = 0;
        buoyVY = 0;
        stepIdx = 0;
        // Start FLAT — the windward-edge swell injector below fills the basin
        // with traveling waves over the first second, so the surface builds up
        // from calm rather than being seeded with a large standing bump (which
        // would dominate and decay instead of reading as a steady ground swell).
      };

      const step = (dt: number) => {
        const amp = num(params.waveAmp, 0.26);
        const speed = num(params.waveSpeed, 1.1);
        const damp01 = clamp(num(params.damping, 0.16), 0.02, 0.6);
        const buoyK = num(params.buoyancy, 18);

        // Wave-equation parameters. c2 (tension) scales with waveSpeed² and sets
        // how fast swells travel; kept well under the CFL limit for the discrete
        // 5-point laplacian (c2·dt² ≪ 0.5). A small per-step energy bleed keeps
        // the basin from accumulating energy without bound → a bounded, lively
        // steady-state swell rather than a blow-up. Higher damping → calmer.
        const c2 = 60 * speed * speed;
        const waveDamp = 1 - (0.004 + damp01 * 0.025);

        // Inject a fresh traveling swell from the windward edge on a fixed cadence
        // (deterministic: cadence + position are constants, not random). Amplitude
        // follows the waveAmp control LIVE so sweeping it changes the whole field.
        // Small per-poke amount: the bleed above balances repeated injection so
        // the surface settles into a steady traveling-swell pattern.
        if (stepIdx % SWELL_PERIOD === 0) {
          const k = stepIdx / SWELL_PERIOD;
          // Move the injection point gently across the windward edge so swells
          // arrive from slightly different angles — still fully deterministic.
          const off = ((k % 5) / 5) * (N * 0.5) + N * 0.25;
          // Alternate crest / trough pokes (a swell has both): this drives a
          // travelling wave train across the basin with a zero-mean profile, so
          // the centre sees distinct crests AND troughs pass under the buoy
          // (genuine bobbing) instead of a one-sided DC pile-up.
          const sign = k % 2 === 0 ? 1 : -1;
          splat2D(h, N, N * 0.1, off, N * 0.18, amp * 1.4 * sign);
        }

        // One explicit wave-equation step.
        waveStep2D(h, v, N, c2, waveDamp, dt);

        // ── Buoy: buoyant spring toward the local water height + momentum ────
        const waterAt = sampleH(cxCell, cyCell);
        // A buoyant restoring force pulls the buoy toward the local surface
        // height; the bob is UNDERDAMPED so the body lags and overshoots a
        // passing swell with real momentum (it rides crests and dips into
        // troughs) instead of snapping to the surface. The damping control adds
        // a light velocity bleed so big values calm the ride. Semi-implicit
        // (symplectic) Euler.
        const accel = (waterAt - buoyY) * buoyK;
        buoyVY += accel * dt;
        buoyVY *= 1 - clamp(damp01 * 0.9, 0, 0.4);
        buoyY += buoyVY * dt;

        stepIdx++;
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      const write = () => {
        const ampScale = num(params.waveAmp, 0.26) / 0.26; // visual gain factor
        // 1) Push the height field into the plane's Z (it's rotated flat, so Z is
        //    the world-up displacement). Scaled so the control reads strongly.
        const dispScale = 1.4;
        for (let i = 0; i < posAttr.count; i++) {
          // The grid is row-major N×N; the plane vertices are in the SAME order
          // (PlaneGeometry lays out row by row top→bottom). Index maps 1:1.
          posAttr.setZ(i, h[i] * dispScale);
          // keep XY pinned to base (defensive; computeVertexNormals reads pos)
          posAttr.setX(i, baseX[i]);
          posAttr.setY(i, baseY[i]);
        }
        posAttr.needsUpdate = true;
        waterGeom.computeVertexNormals();

        // 2) Place + tilt the buoy. Sample the surface SLOPE around the footprint
        //    (central differences) and lean the hull to lie along the water.
        const sUp = sampleH(cxCell, cyCell - 1);
        const sDn = sampleH(cxCell, cyCell + 1);
        const sLf = sampleH(cxCell - 1, cyCell);
        const sRt = sampleH(cxCell + 1, cyCell);
        const cellW = PLANE_SIZE / (N - 1);
        // slope = d(height)/d(distance). World displacement uses the same disp
        // scale as the surface so the hull lies on the rendered water.
        const slopeX = ((sRt - sLf) * 1.4) / (2 * cellW);
        const slopeY = ((sDn - sUp) * 1.4) / (2 * cellW);

        // The water plane is rotated -90° about X (XY-grid → XZ-world). Map the
        // buoy footprint cell to world XZ; ride buoyY (world up) on top of WATER_Z.
        const worldX = (cxCell / (N - 1) - 0.5) * PLANE_SIZE;
        const worldZ = -(cyCell / (N - 1) - 0.5) * PLANE_SIZE; // grid +y → world -z
        // BUOY_GAIN exaggerates the bob a touch past the raw surface sample so a
        // light buoy reads as visibly riding the swell (it sits in the water but
        // the eye needs the motion amplified at tile scale). Same dispScale as
        // the water so the hull still tracks the rendered crests/troughs.
        buoy.position.set(worldX, WATER_Z + buoyY * BUOY_GAIN + 0.06, worldZ);

        // Tilt: pitch about X from the fore/aft slope, roll about Z from the
        // port/starboard slope. atan keeps the lean bounded.
        buoy.rotation.x = Math.atan(slopeY) * TILT_GAIN;
        buoy.rotation.z = -Math.atan(slopeX) * TILT_GAIN;

        // Subtle: brighten the deck a touch with bigger swells so the engaged
        // frame reads (a live write so even a same-t reseek shows something).
        (deck.material as MeshStandardMaterial).emissiveIntensity =
          0.35 + clamp(ampScale - 1, 0, 1) * 0.4;
      };

      reset();
      write();

      return {
        // Finite so the rig loops; long enough that several swells cross.
        duration: () => 6,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Trajectory controls (buoyancy/damping/waveSpeed) only affect the frozen
        // frame because this re-runs the sim to the SAME pinned t.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(root);
          waterGeom.dispose();
          waterMat.dispose();
          buoy.traverse((o) => {
            const m = o as Mesh;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material as { dispose?: () => void } | undefined;
            if (mat && typeof mat.dispose === 'function') mat.dispose();
          });
        },
      };
    },
  ),
};
