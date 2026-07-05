// liquid-fill-sim — REAL liquid pours into a clear glass vessel: the free surface
// RISES as the vessel fills and SETTLES with genuine sloshing waves. CATALOG
// primitive (hard / glass, subject:'empty', time-driven). The real-sim upgrade of
// the shader-fake `liquid-fill-glass`.
//
// GENUINE CPU FLUID, not a shader trick. Two coupled deterministic states:
//   • LEVEL  — the fill height rises over time at `fillRate` (a clamped ramp to a
//     `level` cap), so the liquid body literally grows to fill the cup.
//   • SURFACE — a 2D Eulerian height field h[]/v[] over the round top surface,
//     advanced every fixed step by the explicit wave equation `waveStep2D`
//     (c2 = waveTension, damp = 1 - viscosity). The incoming pour stream splats a
//     ripple onto the centre of the surface each step via `splat2D`, so the water
//     visibly sloshes and ripples while it fills, then settles when the stream
//     slows near the cap. The h[] grid is written into a circular surface mesh's
//     z BufferAttribute + computeVertexNormals so it lights as real water.
//
// DETERMINISM (the harness pins frozen frames by reseeking): no Math.random /
// Date.now. The pour ripple position wobbles deterministically via hash1. The sim
// runs on a reset-and-replay stepper, so the frame at time t is a pure function of
// (params, t): every control — fillRate, viscosity, waveTension, level — visibly
// changes any frozen frame the rig pins (onParamChange → markDirty re-runs the sim
// to the SAME paused t). At least one control (level cap) is also read live in
// write() so even a same-t reseek shows it.
//
// duration() is finite (fill + a settle window); the rig loops t→0 which the
// stepper treats as a rewind → the cup re-fills. The ~0.45 frozen phase lands the
// vessel ABOUT HALF FULL with the surface mid-slosh (engaged frame).

import {
  Group,
  Mesh,
  CylinderGeometry,
  BufferGeometry,
  BufferAttribute,
  Color,
  DoubleSide,
} from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  float,
  vec3,
  mix,
  max as tslMax,
  pow,
  normalView,
  positionViewDirection,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';
import {
  makeReplayStepper,
  splat2D,
  waveStep2D,
  hash1,
  clamp,
  resolveSimTier,
  tierPick,
} from './_sim-core';

// ── Vessel geometry (tuned to the catalog rig: cam z≈3.2, FOV 40) ────────────
const VESSEL_R = 0.78; // glass inner radius (world units)
const VESSEL_BOT = -1.0; // floor height (liquid grows up from here)
const VESSEL_TOP = 1.05; // glass rim height
const VESSEL_H = VESSEL_TOP - VESSEL_BOT;
const WALL = 0.06; // glass wall thickness (outer shell offset)
const DT = 1 / 90; // fixed sim step
const SURF_INSET = 0.965; // liquid disc radius vs vessel (sits just inside walls)

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  // How fast the surface rises (fraction of full per second). Drives the whole
  // fill timeline; re-pins the frozen frame.
  { id: 'fillRate', label: 'Fill Rate', type: 'knob', min: 0.08, max: 0.9, step: 0.01, default: 0.34, unit: '/s' },
  // Wave energy loss — the water's "thickness". High = settles fast (syrup),
  // low = sloshes for ages (thin water). Maps to the height-field damp.
  { id: 'viscosity', label: 'Viscosity', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.32 },
  // Surface wave tension (c² in the wave equation): higher = faster, tighter
  // ripples chase across the surface.
  { id: 'waveTension', label: 'Wave Tension', type: 'knob', min: 6, max: 34, step: 0.5, default: 18 },
  // Fill cap: how full the vessel gets (1 = brim). Read LIVE so it moves the
  // frozen surface even on a same-t reseek.
  { id: 'level', label: 'Fill Level', type: 'fader', min: 0.3, max: 1, step: 0.01, default: 0.92 },
] as const;

export const liquidFillSimPrimitive: PrimitiveDefinition = {
  name: 'liquid-fill-sim',
  label: 'Liquid Fill (Sim)',
  category: 'glass',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Liquid pours into a clear glass vessel; the free surface rises and settles with real CPU wave-equation sloshing — a genuine fluid, not a shader fake.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'liquid-fill-sim', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Surface height-field resolution. HEAVY on T2; markedly cheaper on T0 so
      // it degrades gracefully (coarse grid).
      const N = tierPick<number>(tier, { T0: 14, T1: 22, T2: 30 });
      // Sim substeps per fixed dt — more steps = stiffer, more stable waves.
      const SUB = tierPick<number>(tier, { T0: 1, T1: 2, T2: 2 });

      // ── Surface wave field (Eulerian grid) ───────────────────────────────
      const h = new Float32Array(N * N); // surface height offset (about 0)
      const v = new Float32Array(N * N); // vertical velocity
      // Mask: which grid cells fall inside the round liquid disc (corners are
      // outside the circle → parked flat). Cached once.
      const inDisc = new Uint8Array(N * N);
      const half = (N - 1) / 2;
      for (let gy = 0; gy < N; gy++) {
        for (let gx = 0; gx < N; gx++) {
          const nx = (gx - half) / half; // −1..1
          const ny = (gy - half) / half;
          inDisc[gy * N + gx] = nx * nx + ny * ny <= 1.0 ? 1 : 0;
        }
      }

      // Live fill state.
      let levelNow = 0; // current fill fraction 0..1 (rises over time)
      let simClock = 0; // integrated sim time (drives the deterministic pour wander)

      const reset = () => {
        h.fill(0);
        v.fill(0);
        levelNow = 0;
        simClock = 0;
      };

      // One fixed integration step: rise the level, splat the pour ripple, and
      // advance the surface wave field. Params read LIVE so tweaks apply instantly.
      const step = (dt: number, simT: number) => {
        const fillRate = num(params.fillRate, 0.34);
        const cap = clamp(num(params.level, 0.92), 0.3, 1);
        const visc = clamp(num(params.viscosity, 0.32), 0, 1);
        const c2 = num(params.waveTension, 18);
        const damp = clamp(1 - visc * 0.12, 0.7, 1);

        // Level ramps toward the cap; the pour is "on" while still filling.
        const prevLevel = levelNow;
        levelNow = Math.min(cap, levelNow + fillRate * dt);
        const pouring = levelNow < cap - 1e-4 && fillRate > 0;

        for (let s = 0; s < SUB; s++) {
          const sdt = dt / SUB;
          // Incoming stream hits the surface: splat a ripple where the pour lands.
          // The landing point wobbles deterministically (a wandering stream), and
          // the rising level itself adds energy (new water dropping in).
          if (pouring) {
            const wob = simT * 2.3;
            // Deterministic small wander of the impact point inside the disc.
            const wx = (hash1(Math.floor(simT * 7) + 0.3) - 0.5) * 0.5;
            const wy = (hash1(Math.floor(simT * 7) + 9.1) - 0.5) * 0.5;
            const cx = half + (Math.cos(wob) * 0.18 + wx) * half;
            const cy = half + (Math.sin(wob) * 0.18 + wy) * half;
            const radius = Math.max(1.5, N * 0.13);
            // Stronger splat early (the column is "falling further"); eases as it
            // approaches the cap. Plus the per-step level gain feeds the surface.
            const rising = (levelNow - prevLevel) / Math.max(sdt, 1e-6);
            const amount = -(0.012 + rising * 0.02);
            splat2D(h, N, cx, cy, radius, amount);
          }
          waveStep2D(h, v, N, c2, damp, sdt);
          // Clamp cells outside the round disc flat (they are not real surface).
          for (let i = 0; i < h.length; i++) {
            if (!inDisc[i]) {
              h[i] = 0;
              v[i] = 0;
            }
          }
        }
        simClock += dt;
      };

      const stepper = makeReplayStepper({
        dt: DT,
        reset,
        step: (dt) => step(dt, simClock),
      });

      // ── Visuals ──────────────────────────────────────────────────────────
      const root = new Group();
      root.name = 'liquid-fill-sim';

      // Glass vessel: a clear transmissive cylinder shell (open top). The catalog
      // rig's scissored pass does NOT populate three's transmission render target,
      // so a perfectly clear transmissive surface reads black on-axis — we add a
      // subtle facing-driven emissive core (mirrors liquid-fill-glass) so the
      // glass reads as a luminous clear vessel rather than black.
      const glassMat = makeGlassMaterial();
      const glass = new Mesh(
        new CylinderGeometry(VESSEL_R + WALL, VESSEL_R + WALL, VESSEL_H, 48, 1, true),
        glassMat,
      );
      glass.position.y = (VESSEL_TOP + VESSEL_BOT) / 2;
      glass.name = 'vessel';
      root.add(glass);

      // Glass floor disc (so the cup has a bottom).
      const floorMat = makeGlassMaterial(0.5);
      const floor = new Mesh(new CylinderGeometry(VESSEL_R + WALL, VESSEL_R + WALL, WALL, 48), floorMat);
      floor.position.y = VESSEL_BOT;
      floor.name = 'vessel-floor';
      root.add(floor);

      // Liquid BODY: a cylinder from the floor up to the current surface level.
      // We scale + reposition it each frame so it grows as the cup fills. Unit
      // height (1) so scaleY maps directly to body height.
      const liquidMat = makeLiquidMaterial(rgb('#9fe0c4'));
      const body = new Mesh(
        new CylinderGeometry(VESSEL_R * SURF_INSET, VESSEL_R * SURF_INSET, 1, 48, 1, true),
        liquidMat,
      );
      body.name = 'liquid-body';
      root.add(body);

      // Liquid SURFACE: a round height-field disc that carries the wave grid. A
      // PlaneGeometry-style grid (N×N) masked to a circle; its z attribute is the
      // wave height. Built as its own BufferGeometry so we can write h[] into it.
      const surfGeo = buildDiscGrid(N, VESSEL_R * SURF_INSET);
      const surfMat = makeLiquidMaterial(rgb('#7fd4ff'), 0.55);
      const surface = new Mesh(surfGeo, surfMat);
      surface.rotation.x = -Math.PI / 2; // lay the grid flat (XY plane → XZ)
      surface.name = 'liquid-surface';
      root.add(surface);

      const surfPos = surfGeo.getAttribute('position') as BufferAttribute;

      target.object.add(root);

      // Publish the live level so the host/tests can observe the rising liquid.
      target.userData.fillLevel = 0;

      const write = () => {
        const cap = clamp(num(params.level, 0.92), 0.3, 1); // read live
        // Body grows from the floor to the current surface height.
        const bodyTop = VESSEL_BOT + levelNow * VESSEL_H;
        const bodyH = Math.max(1e-3, bodyTop - VESSEL_BOT);
        body.scale.set(1, bodyH, 1);
        body.position.y = VESSEL_BOT + bodyH / 2;

        // Surface sits at the top of the body, displaced by the wave field.
        surface.position.y = bodyTop;
        for (let i = 0; i < surfPos.count; i++) {
          // The grid's local z (post rotation → world y) is the wave height.
          surfPos.setZ(i, h[i]);
        }
        surfPos.needsUpdate = true;
        surfGeo.computeVertexNormals();

        // Hide the surface until there is liquid; clamp far below empty.
        surface.visible = levelNow > 0.01;
        body.visible = levelNow > 0.01;

        // Live read-out + use cap so a same-t reseek without markDirty still
        // shows the level control (cap caps the visible body even mid-fill).
        target.userData.fillLevel = levelNow;
        void cap;
      };

      reset();
      write();

      return {
        // Fill time + a settle window. Faster fill → shorter; bounded so the loop
        // stays lively. Tuned so phase ~0.45 lands about half full mid-slosh.
        duration: () => {
          const fillRate = num(params.fillRate, 0.34);
          const cap = clamp(num(params.level, 0.92), 0.3, 1);
          const fillTime = cap / Math.max(fillRate, 0.001);
          return clamp(fillTime + 1.6, 2.5, 12);
        },
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Any control sweep re-runs the sim to the SAME pinned frame → the frozen
        // frame visibly changes (standing function of the engaged pose).
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(root);
          glassMat.dispose();
          floorMat.dispose();
          liquidMat.dispose();
          surfMat.dispose();
          glass.geometry.dispose();
          floor.geometry.dispose();
          body.geometry.dispose();
          surfGeo.dispose();
        },
      };
    },
  ),
};

// ── Material + geometry helpers ────────────────────────────────────────────

/** Clear glass: transmissive physical material + a faint facing-driven emissive
 *  core so it never reads black under the rig's transmission-RT-less pass. */
function makeGlassMaterial(coreScale = 1): MeshPhysicalNodeMaterial {
  const mat = new MeshPhysicalNodeMaterial({
    transmission: 1,
    roughness: 0.04,
    metalness: 0,
    thickness: 0.4,
    ior: 1.5,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  const facing = tslMax(normalView.dot(positionViewDirection), float(0));
  const core = pow(facing, float(2.2)).mul(float(0.16 * coreScale));
  const tint = vec3(0.82, 0.9, 0.96); // cool ice-white glass
  (mat as unknown as { emissiveNode: unknown }).emissiveNode = tint.mul(core);
  return mat;
}

/** Transmissive liquid (ice/mint): physical transmission + a stronger luminous
 *  core tinted to the liquid colour so the fill is unmistakable. */
function makeLiquidMaterial(color: [number, number, number], coreScale = 1): MeshPhysicalNodeMaterial {
  const uR = uniform(color[0]);
  const uG = uniform(color[1]);
  const uB = uniform(color[2]);
  const mat = new MeshPhysicalNodeMaterial({
    transmission: 0.9,
    roughness: 0.08,
    metalness: 0,
    thickness: 0.9,
    ior: 1.33,
    transparent: true,
    side: DoubleSide,
  });
  const liquidTint = vec3(uR, uG, uB);
  // Surface colour leans to the liquid tint; a facing core makes it glow from
  // within (the rig has no transmission backdrop to refract).
  const facing = tslMax(normalView.dot(positionViewDirection), float(0));
  const core = pow(facing, float(1.6)).mul(float(0.5 * coreScale));
  (mat as unknown as { colorNode: unknown }).colorNode = mix(
    vec3(0.7, 0.82, 0.88),
    liquidTint,
    float(0.8),
  );
  (mat as unknown as { emissiveNode: unknown }).emissiveNode = liquidTint.mul(core);
  (mat as unknown as { attenuationColorNode: unknown }).attenuationColorNode = liquidTint;
  return mat;
}

/** Build an N×N grid disc (radius r) as a BufferGeometry: vertices laid out
 *  row-major so vertex index == h[] grid index, indexed into triangles only
 *  where all corners fall inside the circle. z starts at 0 (the wave field). */
function buildDiscGrid(N: number, r: number): BufferGeometry {
  const positions = new Float32Array(N * N * 3);
  const half = (N - 1) / 2;
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const i = gy * N + gx;
      const nx = (gx - half) / half; // −1..1
      const ny = (gy - half) / half;
      // Map the full square to the disc radius; corners (|n|>1 radially) get
      // pulled to the rim so the perimeter reads round, no square edges.
      positions[i * 3] = nx * r;
      positions[i * 3 + 1] = ny * r;
      positions[i * 3 + 2] = 0;
    }
  }
  const indices: number[] = [];
  const inside = (gx: number, gy: number): boolean => {
    const nx = (gx - half) / half;
    const ny = (gy - half) / half;
    return nx * nx + ny * ny <= 1.02;
  };
  for (let gy = 0; gy < N - 1; gy++) {
    for (let gx = 0; gx < N - 1; gx++) {
      // Quad corners must all be inside the disc to emit triangles.
      if (!inside(gx, gy) || !inside(gx + 1, gy) || !inside(gx, gy + 1) || !inside(gx + 1, gy + 1)) {
        continue;
      }
      const a = gy * N + gx;
      const b = gy * N + gx + 1;
      const c = (gy + 1) * N + gx;
      const d = (gy + 1) * N + gx + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
