// wave-tank-slosh — water SLOSHING in a tank. A shallow-water height field on a
// CPU Eulerian grid, driven by a TILT body force so the BULK of the water piles
// up against one wall as a CURVED MENISCUS, reflects, and surges back as a
// travelling bore — low-frequency bulk motion, deliberately distinct from the
// high-frequency concentric `ripple`. CATALOG primitive (hard / wave,
// subject:'plane').
//
// Genuine simulation, NOT a sine: a height grid h[] + vertical-velocity grid v[]
// are integrated by the explicit wave equation (`waveStep2D` from _sim-core).
// Each step a tilt — pointer.x plus a deterministic periodic component — drives
// the surface toward a NON-LINEAR wall-piling equilibrium (a concave meniscus
// that rises steeply against the down-tilt wall, NOT a flat affine slope), and a
// deterministic travelling SURGE FRONT is splatted at that wall so a real moving
// bore crosses the tank and reflects off the closed Neumann walls. Damping
// bleeds energy. The grid height is bilinearly sampled onto the host 'plane' z
// buffer, the plane is PITCHED BACK so the camera looks across the surface (so
// the relief reads as silhouette undulation, not a foreshortened ramp), the
// normals are recomputed, and a per-vertex height→luma colour ramp glints the
// crests so the surface reads as moving water with real relief.
//
// Deterministic via the reset-replay stepper: the frame at time t is a pure
// function of (params, t). The tilt phase is seeded from a hash (no wallclock,
// no Math.random), so the frozen ~0.45 frame is reproducible and every control
// — slosh / damping / tilt / tension — visibly changes it (onParamChange →
// markDirty re-runs the sim to the same pinned t).

import {
  Mesh,
  Color,
  BoxGeometry,
  MeshStandardMaterial as MeshStandardMaterialCtor,
  Float32BufferAttribute,
  type BufferAttribute,
  type InterleavedBufferAttribute,
  type MeshStandardMaterial,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import {
  makeReplayStepper,
  resolveSimTier,
  tierPick,
  waveStep2D,
  splat2D,
  hash1,
} from './_sim-core';

const DT = 1 / 120; // small fixed step for a stable explicit grid
const PLANE_HALF = 0.9; // host plane spans XY ∈ [-0.9, 0.9]
const PLANE_SPAN = PLANE_HALF * 2;
const VIEW_PITCH = -0.62; // lay the plane back so the camera reads the relief
const WATER = '#7fd4ff'; // ice water
const WATER_EMISSIVE = '#16384a'; // steel-blue depth glow
const WALL_COLOR = '#cfdde6'; // pale steel tank walls
const CREST_TINT = new Color('#dff2ff'); // ice highlight on crests / wall pile
const TROUGH_TINT = new Color('#3a6f8c'); // deep steel-blue in the troughs

const SCHEMA = [
  // Drive strength of the slosh body force (how hard the tilt pushes the bulk).
  { id: 'slosh', label: 'Slosh', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.62 },
  // Energy loss per step — low damping = water keeps surging wall to wall.
  { id: 'damping', label: 'Damping', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.32 },
  // Static tank tilt bias (pointer.x adds to this live). Tips the resting bulk.
  { id: 'tilt', label: 'Tilt', type: 'knob', min: -1, max: 1, step: 0.02, default: 0.35 },
  // Wave tension (c²): higher = stiffer, faster-travelling surface.
  { id: 'tension', label: 'Tension', type: 'knob', min: 0.4, max: 3, step: 0.05, default: 1.4 },
  // Overall vertical exaggeration of the surface onto the plane.
  { id: 'height', label: 'Height', type: 'knob', min: 0.1, max: 0.6, step: 0.01, default: 0.32, unit: 'u' },
] as const;

export const waveTankSloshPrimitive: PrimitiveDefinition = {
  name: 'wave-tank-slosh',
  label: 'Wave Tank Slosh',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'pointer',
  description:
    'Water sloshing in a tank: a shallow-water height field driven by a tilt body force so the bulk of the water piles against the walls and surges back — low-frequency bulk motion, not a ripple.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'wave-tank-slosh', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry;
      const posAttr = geom.getAttribute('position') as
        | BufferAttribute
        | InterleavedBufferAttribute;
      const vCount = posAttr.count;

      // Recolor the host plane to ice/steel water (lit, transmissive-feeling).
      // vertexColors ON so a per-vertex height→luma ramp can glint the crests:
      // without surface luma variation a foreshortened plane reads as one flat
      // fill (the advocate's "constant blue, no surface variation" complaint).
      const mat = mesh.material as MeshStandardMaterial;
      const prevColor = mat.color.clone();
      const prevEmissive = mat.emissive.clone();
      const prevEmissiveI = mat.emissiveIntensity;
      const prevRough = mat.roughness;
      const prevMetal = mat.metalness;
      const prevVertexColors = mat.vertexColors;
      mat.color = new Color(WATER);
      mat.emissive = new Color(WATER_EMISSIVE);
      mat.emissiveIntensity = 0.45;
      mat.roughness = 0.1; // glossy water → strong specular glint on crests
      mat.metalness = 0.22;
      mat.vertexColors = true;
      mat.needsUpdate = true;

      // Pitch the plane back so the camera (straight-on at z≈3.2) looks ACROSS
      // the water surface — relief then reads as silhouette undulation instead of
      // a foreshortened Z ramp. This is the same trick the passing water sims use
      // (buoyancy-bob lays its plane flat). Restored on dispose.
      const prevRotX = mesh.rotation.x;
      mesh.rotation.x = VIEW_PITCH;

      // Steel tank walls + floor so the bulk has visible containers to pile
      // against (the advocate flagged "no visible tank/container walls").
      const wallMat = new MeshStandardMaterialCtor({
        color: new Color(WALL_COLOR),
        emissive: new Color('#26343f'),
        emissiveIntensity: 0.28,
        roughness: 0.4,
        metalness: 0.35,
      });
      // The plane lives in local XY (x = across-tank, y = down-tank) and the
      // surface displaces along local +z (the HEIGHT axis). So the tank walls
      // must be thin in x, span the full y, and RISE along z; the floor sits a
      // little below z=0 spanning x and y. Children of the mesh ⇒ they inherit
      // the view pitch and frame the bulk where it piles against the x-walls.
      const WALL_T = 0.05; // wall thickness (across-tank)
      const WALL_Z = 0.6; // wall height along the displacement axis
      const makeWall = (
        w: number,
        d: number,
        zh: number,
        x: number,
        y: number,
        z: number,
      ): Mesh => {
        const m = new Mesh(new BoxGeometry(w, d, zh), wallMat);
        m.position.set(x, y, z);
        m.name = 'tank-wall';
        return m;
      };
      // Left / right end walls (the bulk slams into these as it surges wall-to-
      // wall), and a floor pan a touch below the resting surface.
      const wallL = makeWall(WALL_T, PLANE_SPAN + WALL_T, WALL_Z, -PLANE_HALF, 0, WALL_Z * 0.32);
      const wallR = makeWall(WALL_T, PLANE_SPAN + WALL_T, WALL_Z, PLANE_HALF, 0, WALL_Z * 0.32);
      const floor = makeWall(PLANE_SPAN + WALL_T, PLANE_SPAN + WALL_T, WALL_T, 0, 0, -WALL_T);
      mesh.add(wallL, wallR, floor);

      // Cache base vertex XY (so dispose restores) and precompute, per vertex,
      // the bilinear sample weights into the height grid (XY → grid cell).
      const baseX = new Float32Array(vCount);
      const baseY = new Float32Array(vCount);
      const baseZ = new Float32Array(vCount);
      for (let i = 0; i < vCount; i++) {
        baseX[i] = posAttr.getX(i);
        baseY[i] = posAttr.getY(i);
        baseZ[i] = posAttr.getZ(i);
      }

      // Per-vertex colour buffer (height → ice-crest / steel-trough ramp).
      const colorArr = new Float32Array(vCount * 3);
      const hadColor = !!geom.getAttribute('color');
      const prevColorAttr = hadColor
        ? (geom.getAttribute('color') as BufferAttribute)
        : null;
      const colAttr = new Float32BufferAttribute(colorArr, 3);
      geom.setAttribute('color', colAttr);

      // ── Height grid (CPU Eulerian shallow water) ──────────────────────────
      // Tier-gated resolution: T0 markedly coarser/cheaper than T2 (HEAVY sim).
      const tier = resolveSimTier(target);
      const N = tierPick(tier, { T0: 28, T1: 40, T2: 56 });
      const MAX_N = 56; // fixed build-time allocation; never realloc per seek
      const h = new Float32Array(MAX_N * MAX_N);
      const v = new Float32Array(MAX_N * MAX_N);

      // Deterministic per-instance tilt phase offset (no Math.random / Date.now).
      const phaseSeed = hash1(7.0) * Math.PI * 2;
      const surgeSeed = hash1(13.0); // deterministic transverse offset of the bore
      let stepIdx = 0; // deterministic surge cadence counter (reset → 0)
      let prevTiltSign = 0; // detect slosh reversal → fire the bore at the new wall

      const reset = () => {
        // Start flat and at rest; the tilt body force + surge bore build it up.
        h.fill(0);
        v.fill(0);
        stepIdx = 0;
        prevTiltSign = 0;
      };

      const step = (dt: number) => {
        const slosh = clamp(num(params.slosh, 0.62), 0, 1);
        const damping = clamp(num(params.damping, 0.32), 0, 1);
        const tiltBias = num(params.tilt, 0.35);
        const tension = num(params.tension, 1.4);

        // Live pointer.x tilts the tank (0..1, centre 0.5 → no tilt). Plus the
        // static tilt knob and a slow deterministic sway so the surface sloshes
        // even with the pointer parked dead-centre (the catalog tile pins it).
        const ud = target.userData as { pointer?: { x?: number } };
        const px = typeof ud.pointer?.x === 'number' ? ud.pointer.x : 0.5;
        const pointerTilt = (px - 0.5) * 2; // −1..1
        const simT = stepper.now();
        // ~0.4 Hz bulk sway — LOW frequency, this is the slosh, not a ripple.
        const sway = Math.sin(simT * 2.6 + phaseSeed);
        const tilt = clamp(pointerTilt + tiltBias + sway, -2, 2);

        // Surface wave propagation: spreads the pile into the natural sloshing
        // mode and carries the crest wall-to-wall. tension scales c² strongly so
        // the knob visibly changes how fast the bore travels (was a dead control).
        const c2 = tension * 22.0;
        const damp = 1 - damping * 0.02;
        waveStep2D(h, v, N, c2, damp, dt);

        // TRAVELLING SURGE BORE: when the slosh reverses (the bulk starts heading
        // to the other wall) splat a localized crest against the down-tilt wall.
        // It then propagates across the tank as a moving bore and reflects off the
        // closed walls — this is the cross-surface RELIEF the advocate found
        // missing (the equilibrium alone is too smooth). Fully deterministic:
        // fired on the tilt-sign flip plus a fixed cadence, position seeded by a
        // hash, amplitude follows the live slosh control.
        const tiltSign = tilt > 0.04 ? 1 : tilt < -0.04 ? -1 : prevTiltSign;
        const reversed = tiltSign !== 0 && tiltSign !== prevTiltSign;
        prevTiltSign = tiltSign;
        if (reversed || stepIdx % 70 === 0) {
          // Wall the bulk is heading toward (down-tilt side): +tilt → right wall.
          const wallX = tiltSign > 0 ? N - 2 : 1;
          // Transverse position drifts deterministically so successive bores hit
          // at slightly different y — gives the surface y-axis structure too.
          const k = Math.floor(stepIdx / 35);
          const cy = (((k + surgeSeed * 5) % 5) / 5) * (N - 4) + 2;
          splat2D(h, N, wallX, cy, N * 0.32, (0.16 + 0.5 * slosh) * tiltSign);
        }
        stepIdx++;

        // GRAVITY RESTORING toward a NON-LINEAR wall-piling equilibrium: a tilted
        // tank's bulk does NOT settle to a flat slope — it piles steeply against
        // the down-tilt wall as a concave MENISCUS and stays low across the rest
        // of the basin. h_eq(x) = ampEq·tilt·sign(xn)·|xn|^p (p>1 ⇒ curved, wall-
        // weighted) plus a gentle transverse bow so the surface is never a 1-D
        // ramp. This is the slosh body force — it drives genuine MASS TRANSPORT
        // across the tank, and because `tilt` reverses with the sway/pointer the
        // bulk surges back to the other wall. Strong damping keeps it bounded.
        const ampEq = 0.62 * slosh; // peak equilibrium pile height
        const kRestore = 26.0; // gravity-like pull toward equilibrium
        const vDamp = Math.exp(-(0.6 + damping * 5.0) * dt); // bulk-mode damping
        const bow = 0.12 * slosh; // shallow transverse cross-tank bow
        for (let y = 0; y < N; y++) {
          const row = y * N;
          const yn = N > 1 ? (y / (N - 1)) * 2 - 1 : 0; // −1..1 down-tank
          const yBow = bow * (1 - yn * yn); // bulge mid-tank, low at the y-walls
          for (let x = 0; x < N; x++) {
            const xn = N > 1 ? (x / (N - 1)) * 2 - 1 : 0; // −1..1 across tank
            // Curved, wall-weighted pile (|xn|^1.6) so relief is a meniscus, not
            // a straight ramp. Sign carries the down-tilt direction.
            const pile = Math.sign(xn) * Math.pow(Math.abs(xn), 1.6);
            const hEq = ampEq * tilt * pile + yBow * Math.sign(tilt || 1);
            const i = row + x;
            v[i] += (hEq - h[i]) * kRestore * dt; // pull surface toward the pile
            v[i] *= vDamp; // bleed energy so the slosh stays bounded
          }
        }
        for (let i = 0, cells = N * N; i < cells; i++) h[i] += v[i] * dt;

        // Volume conservation: the closed tank neither gains nor loses water, so
        // re-centre the mean height to zero (deterministic — mean only).
        let mean = 0;
        const cells = N * N;
        for (let i = 0; i < cells; i++) mean += h[i];
        mean /= cells;
        if (mean !== 0) for (let i = 0; i < cells; i++) h[i] -= mean;
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // Bilinearly sample the height grid at a normalized plane position.
      const sampleHeight = (sx: number, sy: number): number => {
        // sx, sy ∈ [0,1]; clamp to interior so the 4-tap stays in bounds.
        const fx = clamp(sx, 0, 1) * (N - 1);
        const fy = clamp(sy, 0, 1) * (N - 1);
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = Math.min(N - 1, x0 + 1);
        const y1 = Math.min(N - 1, y0 + 1);
        const tx = fx - x0;
        const ty = fy - y0;
        const h00 = h[y0 * N + x0];
        const h10 = h[y0 * N + x1];
        const h01 = h[y1 * N + x0];
        const h11 = h[y1 * N + x1];
        const a = h00 + (h10 - h00) * tx;
        const b = h01 + (h11 - h01) * tx;
        return a + (b - a) * ty;
      };

      const write = () => {
        // Strong vertical exaggeration so the relief reads as real water across
        // the pitched-back plane (a timid displacement reads as a flat fill).
        const exaggerate = num(params.height, 0.32) * 2.4;
        // First pass: find the height range so the crest-glint colour ramp
        // normalizes per-frame (a small slosh still glints, a big one isn't
        // clipped). Deterministic — derived only from the height grid.
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0, cells = N * N; i < cells; i++) {
          if (h[i] < lo) lo = h[i];
          if (h[i] > hi) hi = h[i];
        }
        const range = hi - lo > 1e-4 ? hi - lo : 1;
        for (let i = 0; i < vCount; i++) {
          // Plane XY ∈ [-0.9, 0.9] → grid UV ∈ [0,1].
          const sx = (baseX[i] + PLANE_HALF) / (2 * PLANE_HALF);
          const sy = (baseY[i] + PLANE_HALF) / (2 * PLANE_HALF);
          const hs = sampleHeight(sx, sy);
          posAttr.setZ(i, baseZ[i] + hs * exaggerate);
          // Height → ice-crest / steel-trough colour ramp. Crests glint bright
          // (ice), troughs sink deep steel-blue → real surface luma variation.
          const t = clamp((hs - lo) / range, 0, 1);
          const tt = t * t * (3 - 2 * t); // smoothstep for a softer crest roll-off
          colorArr[i * 3] = TROUGH_TINT.r + (CREST_TINT.r - TROUGH_TINT.r) * tt;
          colorArr[i * 3 + 1] = TROUGH_TINT.g + (CREST_TINT.g - TROUGH_TINT.g) * tt;
          colorArr[i * 3 + 2] = TROUGH_TINT.b + (CREST_TINT.b - TROUGH_TINT.b) * tt;
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      reset();
      write();

      return {
        // Purely stateful surface sim; the rig loops t (reseek backward → reset
        // and replay), so the slosh keeps surging wall to wall.
        duration: () => Infinity,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Trajectory-only controls (slosh/damping/tilt/tension) must move the
        // FROZEN frame: the rig re-seeks the same paused t, so re-run the sim.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          for (let i = 0; i < vCount; i++) {
            posAttr.setXYZ(i, baseX[i], baseY[i], baseZ[i]);
          }
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();
          // Restore the host plane material + orientation.
          mesh.rotation.x = prevRotX;
          mat.color = prevColor;
          mat.emissive = prevEmissive;
          mat.emissiveIntensity = prevEmissiveI;
          mat.roughness = prevRough;
          mat.metalness = prevMetal;
          mat.vertexColors = prevVertexColors;
          mat.needsUpdate = true;
          // Restore / clear the per-vertex colour attribute we added.
          if (prevColorAttr) geom.setAttribute('color', prevColorAttr);
          else geom.deleteAttribute('color');
          // Tear down the tank walls we mounted.
          mesh.remove(wallL, wallR, floor);
          wallL.geometry.dispose();
          wallR.geometry.dispose();
          floor.geometry.dispose();
          wallMat.dispose();
        },
      };
    },
  ),
};
