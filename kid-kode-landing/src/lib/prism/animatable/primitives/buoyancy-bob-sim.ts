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
// RENDER (advocate fix): the water surface is a height-field plane TILTED toward
// the fixed head-on camera (camera at z≈3.2 looking down −z) so the surface reads
// as a wide body of water RECEDING to a horizon and FILLS the frame — not laid
// dead-flat (edge-on → an invisible sliver) as before. A calm baseline ripple
// keeps the resting surface a visible blue field. The buoy is a SMOOTH lathed
// float (rounded hull + conical top + slim mast), not stacked rectangles, and is
// placed by SAMPLING the height field directly under it on the SAME tilted plane,
// so it always sits IN the water. buoyancy now drives the float's draft (how high
// it rides) AND the spring stiffness, so sweeping it visibly changes the frame.
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
  LatheGeometry,
  CylinderGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Color,
  Vector2,
  DoubleSide,
  BufferAttribute,
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
const PLANE_SIZE = 5.2; // water plane is large + tilted so it FILLS the frame
const WATER_TILT = -1.12; // rad: tilt toward the head-on camera (≈ -64°)
const WATER_Y = -0.62; // drop the surface so it sits in the lower frame
const WATER_Z = -0.35; // push the basin slightly behind the buoy
const DISP_SCALE = 1.55; // height-field → world displacement gain (readability)
const TILT_GAIN = 1.5; // how strongly the hull leans into the surface slope
const BUOY_GAIN = 2.4; // bob amplitude exaggeration for tile-scale readability
const SWELL_PERIOD = 26; // steps between injected swells (a steady ground swell)

// Palette — water = ice/steel/mint (NO purple).
const WATER_COLOR = '#7fd4ff';
const WATER_DEEP = '#2d5e7a';
const HULL_COLOR = '#cfdde6';
const HULL_DECK = '#9fe0c4';
const BUOY_AMBER = '#e8b667';

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
      // Vertex colours fade ice→deep with distance so even the calm resting
      // surface reads as a body of water with depth (not a flat blue sheet).
      const ice = new Color(WATER_COLOR);
      const deep = new Color(WATER_DEEP);
      const vcol = new Float32Array(posAttr.count * 3);
      for (let i = 0; i < posAttr.count; i++) {
        // baseY runs −half (near/low) → +half (far/horizon) before tilt.
        const f = clamp((baseY[i] / PLANE_SIZE) + 0.5, 0, 1);
        const c = deep.clone().lerp(ice, 0.35 + (1 - f) * 0.55);
        vcol[i * 3] = c.r;
        vcol[i * 3 + 1] = c.g;
        vcol[i * 3 + 2] = c.b;
      }
      waterGeom.setAttribute('color', new BufferAttribute(vcol, 3));
      const waterMat = new MeshPhysicalMaterial({
        vertexColors: true,
        color: new Color('#ffffff'),
        emissive: new Color(WATER_DEEP),
        emissiveIntensity: 0.45,
        roughness: 0.18,
        metalness: 0.0,
        transmission: 0.32,
        ior: 1.33,
        thickness: 0.5,
        transparent: true,
        opacity: 0.96,
        side: DoubleSide,
        envMapIntensity: 1.6,
      });
      const water = new Mesh(waterGeom, waterMat);
      water.name = 'buoyancy-water';
      // Tilt toward the camera so the surface fills the frame and recedes to a
      // horizon (NOT dead-flat / edge-on). Height field displaces along plane-Z,
      // which after this tilt is mostly world-up — a believable swell.
      water.rotation.x = WATER_TILT;
      water.position.set(0, WATER_Y, WATER_Z);

      // ── The floating buoy (a smooth lathed marker float) ──────────────────
      const buoy = new Group();
      buoy.name = 'buoyancy-buoy';

      // Rounded hull: a lathe profile (bulb belly tapering to a flat-ish deck) so
      // it reads as a smooth fishing/marker float, not stacked boxes.
      const hullProfile: Vector2[] = [];
      const SEGS = 14;
      for (let i = 0; i <= SEGS; i++) {
        const t = i / SEGS; // 0 (bottom) → 1 (top)
        // Belly bulges near the waterline (t≈0.45), tapers to a small flat top.
        const y = -0.26 + t * 0.5;
        const bulge = Math.sin(t * Math.PI) ** 0.85; // fat middle, slim ends
        const r = 0.06 + bulge * 0.26;
        hullProfile.push(new Vector2(Math.max(0.012, r), y));
      }
      const hull = new Mesh(
        new LatheGeometry(hullProfile, 28),
        new MeshPhysicalMaterial({
          color: new Color(HULL_COLOR),
          emissive: new Color('#1f3340'),
          emissiveIntensity: 0.32,
          roughness: 0.3,
          metalness: 0.3,
          clearcoat: 0.7,
          clearcoatRoughness: 0.25,
          envMapIntensity: 1.2,
        }),
      );
      hull.name = 'buoy-hull';

      // A bright deck band around the waterline (mint) for a believable float.
      const band = new Mesh(
        new CylinderGeometry(0.3, 0.3, 0.1, 28, 1, true),
        new MeshStandardMaterial({
          color: new Color(HULL_DECK),
          emissive: new Color(HULL_DECK),
          emissiveIntensity: 0.6,
          roughness: 0.35,
          metalness: 0.15,
          side: DoubleSide,
          envMapIntensity: 1.0,
        }),
      );
      band.position.y = 0.02;
      band.name = 'buoy-band';

      // A small conical topmark (amber) + slim mast — the navigation marker.
      const top = new Mesh(
        new CylinderGeometry(0.02, 0.14, 0.2, 22),
        new MeshStandardMaterial({
          color: new Color(BUOY_AMBER),
          emissive: new Color(BUOY_AMBER),
          emissiveIntensity: 0.7,
          roughness: 0.4,
          metalness: 0.2,
          envMapIntensity: 1.0,
        }),
      );
      top.position.y = 0.34;
      top.name = 'buoy-top';

      const mast = new Mesh(
        new CylinderGeometry(0.018, 0.022, 0.34, 12),
        new MeshStandardMaterial({
          color: new Color('#cfdde6'),
          emissive: new Color('#26343f'),
          emissiveIntensity: 0.35,
          roughness: 0.5,
          metalness: 0.4,
        }),
      );
      mast.position.y = 0.41;
      mast.name = 'buoy-mast';
      buoy.add(hull, band, top, mast);

      const root = new Group();
      root.name = 'buoyancy-bob-sim';
      root.add(water, buoy);
      target.object.add(root);

      // Buoy footprint location on the grid (centre, slightly off-axis so swells
      // hit it at an angle and it rolls AND pitches). Fixed cell coords.
      const cxCell = N * 0.5;
      const cyCell = N * 0.52;

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
        // Seed a gentle baseline ripple so the resting surface already reads as a
        // living body of water (deterministic — pure function of cell index, no
        // randomness, no wall clock). The windward swell injector then layers
        // traveling crests on top.
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            h[y * N + x] =
              Math.sin(x * 0.9 + y * 0.35) * 0.012 +
              Math.cos(y * 0.7 - x * 0.2) * 0.01;
          }
        }
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
        // Pokes are spread BROADLY across the windward edge so swells reach the
        // buoy footprint near frame-centre (not piled in one corner).
        if (stepIdx % SWELL_PERIOD === 0) {
          const k = stepIdx / SWELL_PERIOD;
          // Move the injection point gently across the windward edge so swells
          // arrive from slightly different angles — still fully deterministic.
          const off = ((k % 5) / 5) * (N * 0.6) + N * 0.2;
          // Alternate crest / trough pokes (a swell has both): this drives a
          // travelling wave train across the basin with a zero-mean profile, so
          // the centre sees distinct crests AND troughs pass under the buoy
          // (genuine bobbing) instead of a one-sided DC pile-up.
          const sign = k % 2 === 0 ? 1 : -1;
          // Inject along the FAR (windward) edge so the swell crosses the whole
          // basin toward the buoy at centre. Wider radius → a broad swell.
          splat2D(h, N, N * 0.12, off, N * 0.22, amp * 1.5 * sign);
        }

        // One explicit wave-equation step.
        waveStep2D(h, v, N, c2, waveDamp, dt);

        // ── Buoy: buoyant spring toward the local water height + momentum ────
        const waterAt = sampleH(cxCell, cyCell);
        // Buoyancy drives BOTH the spring stiffness (higher buoyancy → snappier,
        // rides crests harder) AND the rest draft below: a strongly buoyant float
        // overshoots and rides higher, a weakly buoyant one lags low and sluggish.
        // This makes sweeping the buoyancy control visibly re-pin the frozen frame
        // (it was dead before because pure stiffness barely moved a settled body).
        const accel = (waterAt - buoyY) * buoyK;
        buoyVY += accel * dt;
        buoyVY *= 1 - clamp(damp01 * 0.9, 0, 0.4);
        buoyY += buoyVY * dt;

        stepIdx++;
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      /** Map a height-field cell + its displaced height to a WORLD position,
       *  applying the water plane's tilt + offset so the buoy sits ON the
       *  rendered surface (same transform the GPU applies to the plane). */
      const cellToWorld = (
        fx: number,
        fy: number,
        height: number,
      ): { x: number; y: number; z: number } => {
        // Plane local coords (before tilt): X across, Y up the plane, Z = disp.
        const localX = (fx / (N - 1) - 0.5) * PLANE_SIZE;
        const localY = (fy / (N - 1) - 0.5) * PLANE_SIZE;
        const localZ = height * DISP_SCALE;
        // Apply rotation about X by WATER_TILT (matches water.rotation.x).
        const c = Math.cos(WATER_TILT);
        const s = Math.sin(WATER_TILT);
        const wy = localY * c - localZ * s;
        const wz = localY * s + localZ * c;
        return { x: localX, y: WATER_Y + wy, z: WATER_Z + wz };
      };

      const write = () => {
        const ampScale = num(params.waveAmp, 0.26) / 0.26; // visual gain factor
        const buoyK = num(params.buoyancy, 18);
        // 1) Push the height field into the plane's Z (it's tilted, so Z becomes
        //    mostly world-up displacement). Scaled so the control reads strongly.
        for (let i = 0; i < posAttr.count; i++) {
          // The grid is row-major N×N; the plane vertices are in the SAME order
          // (PlaneGeometry lays out row by row top→bottom). Index maps 1:1.
          posAttr.setZ(i, h[i] * DISP_SCALE);
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
        const slopeX = ((sRt - sLf) * DISP_SCALE) / (2 * cellW);
        const slopeY = ((sDn - sUp) * DISP_SCALE) / (2 * cellW);

        // Buoyancy → draft: a strongly buoyant float rides HIGHER above the
        // surface; a weakly buoyant one sits LOW (deeper draft). Maps the control
        // range (4..40) to ~ −0.05 (heavy/low) .. +0.12 (light/high) of extra
        // ride height so low/mid/high buoyancy frames are clearly distinct.
        const buoyT = clamp((buoyK - 4) / 36, 0, 1);
        const draft = -0.05 + buoyT * 0.17;

        // World placement: sample the buoy footprint on the SAME tilted plane so
        // the hull sits IN the rendered water (bob exaggerated for tile scale).
        const w = cellToWorld(cxCell, cyCell, buoyY * BUOY_GAIN);
        buoy.position.set(w.x, w.y + draft + 0.05, w.z);

        // Tilt: pitch about X from the fore/aft slope, roll about Z from the
        // port/starboard slope. atan keeps the lean bounded. Add the water plane's
        // own tilt to the pitch so the hull axis leans WITH the receding surface.
        buoy.rotation.x = WATER_TILT * 0.42 + Math.atan(slopeY) * TILT_GAIN;
        buoy.rotation.z = -Math.atan(slopeX) * TILT_GAIN;

        // Subtle: brighten the deck band a touch with bigger swells so the
        // engaged frame reads (a live write so even a same-t reseek shows it).
        (band.material as MeshStandardMaterial).emissiveIntensity =
          0.6 + clamp(ampScale - 1, 0, 1) * 0.4;
        // And let a strongly buoyant float read brighter on its topmark.
        (top.material as MeshStandardMaterial).emissiveIntensity = 0.5 + buoyT * 0.5;
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
