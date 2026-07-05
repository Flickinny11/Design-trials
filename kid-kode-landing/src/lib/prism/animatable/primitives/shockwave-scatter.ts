// shockwave-scatter — a radial SHOCKWAVE expands from the centre across a regular
// GRID of elements (visible tiles). As the expanding force ring sweeps past each
// element it is PUSHED outward (an impulse the moment the ring crosses, plus the
// integrated velocity that follows); a spring then pulls it back toward its grid
// slot — a propagating displacement wave through a layout. After the wave passes
// and the grid settles, the shock RECHARGES and re-fires from the centre. CATALOG
// primitive (medium / displacement, subject:'empty').
//
// Genuine integrated particle field, NOT a closed-form position(t): each grid
// element holds velocity state (vx/vy) integrated with semi-implicit (symplectic)
// Euler. The shock contributes a force only while the ring radius is near the
// element's distance from centre (a thin moving annulus), so the outward impulse
// is delivered by the FIELD as it sweeps — never stamped analytically. A Hookean
// spring toward the slot plus drag returns it. Because the stepper resets-and-
// replays on backward seek, the frame at time t is a pure function of (params, t),
// so every control — power, springBack, ringSpeed, gridSize — visibly changes any
// frozen frame the harness pins (onParamChange → markDirty).
//
// duration() is one fire→settle→recharge cycle; the catalog rig loops t back to 0
// (a rewind → re-fire). The ~0.45 frozen phase lands MID-EXPANSION: the ring is
// partway across the grid, a visible bulge wave of displaced elements trailing
// behind it.
//
// RENDER PATH (P0 particle lesson — bubble-rise-sim.ts / smoke-plume-sim.ts):
// THREE.Points render 1px specks on both backends and PointsMaterial.map never
// samples a per-quad uv under three/webgpu, so the grid elements MUST be an
// instanced THREE.Sprite carrying a PointsNodeMaterial whose
//   • positionNode = instancedBufferAttribute(per-element CENTER)
//   • colorNode    = a TSL tile profile of the quad uv: a BRIGHT soft-edged core
//     (luma >> 120) feathered to exact zero before the quad edge, times a
//     per-element instanced COLOR. Generous fixed billboard footprint so each
//     element reads as an object with mass, not a star.
// The expanding shock RING is a SEPARATE single billboard sprite whose TSL
// colorNode draws a bright annulus (the wavefront arc) at a normalised radius;
// the quad is scaled to the live ring radius each frame so the user sees a real
// expanding ring sweep across the grid. It flares bright at the leading edge and
// fades to nothing once the ring has passed the corners (recharge).
// All randomness derives from index hashes (hash1/hash2 — no Math.random, no
// Date.now) so seek() is pure and reproducible headless. DOM-free, TSL only.
//
// Palette: Observatory brass (#ecd49d, rest) → ice (#7fd4ff, excited); the ring
// is amber/ice. Never purple, never 1px squares.

import {
  Sprite,
  BufferGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  Color,
  AdditiveBlending,
  NormalBlending,
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
  uniform,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import { hash2, makeReplayStepper, resolveSimTier, tierPick } from './_sim-core';

const DT = 1 / 120; // stiff spring contact → small step
const HALF = 1.2; // grid half-extent in X/Y about the origin
const MAX_DIM = 11; // build-time max grid edge (MAX_DIM^2 elements allocated)
const MAX_COUNT = MAX_DIM * MAX_DIM;
const RING_WIDTH = 0.36; // thickness of the moving force annulus (world units)
const MAX_RADIUS = 2.0; // ring fully past the corners by here
const CYCLE = 2.6; // seconds per fire→settle→recharge cycle
const EXPAND_FRAC = 0.62; // fraction of the cycle the ring spends expanding
// Generous fixed billboard footprint per grid tile — holds the largest tile a
// dense grid produces plus the feathered edge, so a tile reads as an object.
const TILE_BILLBOARD = 0.34;

const SCHEMA = [
  { id: 'power', label: 'Shock Power', type: 'knob', min: 0.5, max: 6, step: 0.1, default: 3.4 },
  { id: 'springBack', label: 'Spring Back', type: 'fader', min: 0.1, max: 1, step: 0.01, default: 0.55 },
  { id: 'ringSpeed', label: 'Ring Speed', type: 'knob', min: 0.6, max: 3.5, step: 0.05, default: 1.5 },
  { id: 'gridSize', label: 'Grid Size', type: 'knob', min: 4, max: 11, step: 1, default: 9 },
] as const;

export const shockwaveScatterPrimitive: PrimitiveDefinition = {
  name: 'shockwave-scatter',
  label: 'Shockwave Scatter',
  category: 'displacement',
  difficulty: 'medium',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A radial shockwave expands from the centre across a regular grid; each element is pushed outward as the ring sweeps past, then springs back to its slot — a propagating displacement wave, then it recharges and re-fires. Real impulse + spring integration.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'shockwave-scatter', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Heavy O(grid^2) spring field → cheaper grid on T0 so it degrades well.
      const maxDim = tierPick(tier, { T0: 7, T1: 9, T2: MAX_DIM });

      // Per-element slot (home) positions for the FULL build-time grid. The live
      // `gridSize` control re-derives the active layout each reset; elements
      // outside the active grid are parked off-screen.
      const homeX = new Float32Array(MAX_COUNT);
      const homeY = new Float32Array(MAX_COUNT);
      // Live integrated state (closure-held).
      const px = new Float32Array(MAX_COUNT);
      const py = new Float32Array(MAX_COUNT);
      const vx = new Float32Array(MAX_COUNT);
      const vy = new Float32Array(MAX_COUNT);
      // Per-element radial distance from centre (recomputed per reset) and a
      // one-shot latch so the ring delivers its sharp impulse exactly once as it
      // crosses — the rest of the push is integrated velocity + the annulus force.
      const dist = new Float32Array(MAX_COUNT);
      const kicked = new Uint8Array(MAX_COUNT);

      let activeCount = 0; // number of live elements this cycle

      // Lay out a `dim x dim` centred grid into the home arrays and seed live
      // state at home (resting). Reads gridSize LIVE so the control re-layouts.
      const layout = () => {
        const want = Math.round(num(params.gridSize, 9));
        const dim = Math.max(4, Math.min(maxDim, want));
        activeCount = dim * dim;
        const span = HALF * 2;
        const stepGrid = dim > 1 ? span / (dim - 1) : 0;
        let i = 0;
        for (let gy = 0; gy < dim; gy++) {
          for (let gx = 0; gx < dim; gx++) {
            const hx = -HALF + gx * stepGrid;
            const hy = -HALF + gy * stepGrid;
            homeX[i] = hx;
            homeY[i] = hy;
            dist[i] = Math.hypot(hx, hy);
            i++;
          }
        }
      };

      const reset = () => {
        layout();
        for (let i = 0; i < activeCount; i++) {
          px[i] = homeX[i];
          py[i] = homeY[i];
          vx[i] = 0;
          vy[i] = 0;
          kicked[i] = 0;
        }
      };

      // The ring radius is a function of integrated sim time within the cycle —
      // but the DISPLACEMENT it causes is integrated, not stamped: the ring only
      // supplies a force/impulse, and each element carries its own velocity.
      let simClock = 0; // total integrated time, used to phase the ring

      const ringRadius = (ringSpeed: number): number => {
        const cyc = ((simClock % CYCLE) + CYCLE) % CYCLE;
        const expandDur = CYCLE * EXPAND_FRAC;
        if (cyc >= expandDur) return MAX_RADIUS + 10; // ring gone (recharging)
        // Ring sweeps 0 → MAX_RADIUS over the expand window, scaled by ringSpeed.
        const frac = (cyc / expandDur) * clamp(ringSpeed / 1.5, 0.4, 2.4);
        return frac * MAX_RADIUS;
      };

      const step = (dt: number) => {
        const power = num(params.power, 3.4);
        const spring01 = clamp(num(params.springBack, 0.55), 0.1, 1);
        const ringSpeed = num(params.ringSpeed, 1.5);

        // Spring stiffness + drag derived from springBack: more springBack → a
        // stiffer return AND heavier velocity bleed, so even MID-expansion (the
        // pinned frame) a high springBack visibly reins the displaced tiles in
        // toward home while a low springBack lets them fling far out. This is
        // what makes the control move the pinned pose (advocate: springBack dead).
        const k = 22 + spring01 * 150; // Hooke constant toward the slot
        const drag = Math.exp(-(2.6 + spring01 * 11) * dt); // velocity retention

        const r = ringRadius(ringSpeed);
        const half = RING_WIDTH;

        for (let i = 0; i < activeCount; i++) {
          // --- Shock force: only elements whose distance is within the moving
          //     annulus feel an outward push. This is the FIELD sweeping by, so
          //     the impulse arrives at different times for different rings of the
          //     grid → a propagating wave, not a synchronized stamp.
          const dr = dist[i] - r;
          if (dr > -half && dr < half && r < MAX_RADIUS) {
            // Bell across the annulus (peak at the ring centre).
            const f = 1 - Math.abs(dr) / half;
            const env = f * f;
            // Outward radial direction from centre (fallback for the dead-centre
            // element: use a deterministic hashed jitter so it still scatters).
            let nx = px[i];
            let ny = py[i];
            const len = Math.hypot(nx, ny);
            if (len > 1e-4) {
              nx /= len;
              ny /= len;
            } else {
              const a = hash2(i, 1.7) * Math.PI * 2;
              nx = Math.cos(a);
              ny = Math.sin(a);
            }
            // Sharp one-shot impulse the first time the ring reaches this element
            // (the leading-edge "kick"), then a continuous annulus force while it
            // straddles the ring. Both are velocity contributions → integrated.
            // The impulse is damped by springBack so a stiff grid resists the
            // kick (the displacement at the pinned frame scales with the control).
            if (!kicked[i] && dr <= 0) {
              const impulse = power * 1.6 * (1.25 - spring01 * 0.55);
              vx[i] += nx * impulse;
              vy[i] += ny * impulse;
              kicked[i] = 1;
            }
            const force = power * 14 * env * (1.25 - spring01 * 0.55);
            vx[i] += nx * force * dt;
            vy[i] += ny * force * dt;
          }

          // --- Spring back toward the home slot (Hooke) + drag. This is what
          //     makes the displaced element RETURN, so the grid heals behind the
          //     ring and is ready to re-fire next cycle.
          const sx = homeX[i] - px[i];
          const sy = homeY[i] - py[i];
          vx[i] += sx * k * dt;
          vy[i] += sy * k * dt;
          vx[i] *= drag;
          vy[i] *= drag;

          // --- Integrate position (semi-implicit Euler: v already updated).
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
        }

        // Re-arm the per-element kick latch once the ring is gone (next cycle can
        // fire it again). Done once per step, cheap.
        if (r >= MAX_RADIUS) {
          for (let i = 0; i < activeCount; i++) kicked[i] = 0;
        }

        simClock += dt;
      };

      const stepper = makeReplayStepper({
        dt: DT,
        reset: () => {
          simClock = 0;
          reset();
        },
        step,
      });

      // ── GRID TILES: instanced billboard sprite (bright soft-bodied tiles, NOT
      //    1px Points). One quad + per-element instanced center/color. ──────────
      const positions = new Float32Array(MAX_COUNT * 3); // tile centers
      const colors = new Float32Array(MAX_COUNT * 3); // premultiplied tint×brightness
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      posAttr.setUsage(DynamicDrawUsage);
      colAttr.setUsage(DynamicDrawUsage);

      const tileGeo = new BufferGeometry();
      tileGeo.setIndex([0, 1, 2, 0, 2, 3]);
      tileGeo.setAttribute(
        'position',
        new BufferAttribute(
          new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
          3,
        ),
      );
      tileGeo.setAttribute(
        'uv',
        new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
      );
      tileGeo.setAttribute('instancePosition', posAttr);
      tileGeo.setAttribute('instanceColor', colAttr);

      // TSL tile profile: quad-centered coords p = (uv-0.5)*2 → −1..1. Each tile
      // is a SOLID ROUND BALL — NOT an additive glow. On a dense grid additive
      // bright cores SUM past 1.0 everywhere and clip the whole field to white
      // (the round-2 regression). So we render OPAQUE shaded discs with
      // NormalBlending: a filled body with a soft-shaded falloff + a thin bright
      // specular rim, alpha-clipped to a circle so each ball reads as a distinct
      // golden object on a DARK field (idle meanLuma stays in the 30–90 band).
      const tp = uv().sub(0.5).mul(2.0);
      const td = vec2(tp.x, tp.y).length();
      const tileR = float(0.82); // ball radius in quad units
      const tileFeather = float(0.12); // crisp anti-aliased rim (alpha → 0)
      // ALPHA: opaque inside the ball, feathered to 0 at the silhouette so the
      // quad never shows a square and NormalBlending composites a round body.
      const tileAlpha = smoothstep(tileR, tileR.sub(tileFeather), td);
      // SHADE the body: a center-lit falloff (brighter toward the middle, darker
      // toward the rim) gives the ball volume instead of a flat coin. Range stays
      // ≤1 — no additive blow-out.
      const tileShade = smoothstep(float(1.05), float(0.0), td).mul(0.55).add(0.55);
      // Thin bright specular highlight just inside the rim — the premium-physical
      // read (a lit sphere). Kept narrow so it accents, never floods.
      const rimMid = tileR.sub(tileFeather.mul(1.6));
      const rimW = tileFeather.mul(0.9);
      const rimUp = smoothstep(rimMid.sub(rimW), rimMid, td);
      const rimDn = smoothstep(rimMid, rimMid.add(rimW), td).oneMinus();
      const tileBody = tileShade.add(rimUp.mul(rimDn).mul(0.5));
      const tileTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };
      const tileMat = new PointsNodeMaterial({
        size: TILE_BILLBOARD,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: NormalBlending,
        depthWrite: false,
      });
      tileMat.positionNode = instancedBufferAttribute(posAttr);
      // RGB = tint × body shading; ALPHA = circular mask → distinct round balls.
      tileMat.colorNode = vec4(tileTint.mul(tileBody), tileAlpha);

      const tiles = new Sprite(tileMat);
      tiles.geometry = tileGeo;
      tiles.count = MAX_COUNT;
      tiles.frustumCulled = false;
      tiles.name = 'shockwave-scatter';
      target.object.add(tiles);

      // ── SHOCK RING: a single big billboard whose TSL colorNode draws a bright
      //    annulus (the expanding wavefront). The quad is scaled in world space to
      //    the live ring radius each frame, and its brightness driven by a uniform
      //    so it flares at the leading edge and fades once the ring has passed. ──
      const ringGeo = new BufferGeometry();
      ringGeo.setIndex([0, 1, 2, 0, 2, 3]);
      ringGeo.setAttribute(
        'position',
        new BufferAttribute(
          new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
          3,
        ),
      );
      ringGeo.setAttribute(
        'uv',
        new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
      );

      // Uniforms feeding the ring shader: brightness (fades at recharge) and the
      // ring's annulus thickness in normalised-quad units (so the wavefront stays
      // a crisp arc as the quad scales up in world space).
      const ringBright = uniform(0);
      const ringThick = uniform(0.16);
      const rp = uv().sub(0.5).mul(2.0);
      const rd = vec2(rp.x, rp.y).length();
      // Annulus centred at normalised radius 0.84 (just inside the quad edge so
      // the world-radius scale maps the ring front to MAX_RADIUS); a bright thin
      // band feathered both sides → a clean expanding wavefront arc.
      const ringR = float(0.84);
      const inner = smoothstep(ringR.sub(ringThick), ringR, rd);
      const outer = smoothstep(ringR.add(ringThick), ringR, rd);
      const ringBand = inner.mul(outer);
      // Amber→ice wavefront, premultiplied by the brightness uniform (additive).
      const ringColor = vec3(1.0, 0.86, 0.52);
      const ringMat = new PointsNodeMaterial({
        size: 1,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      ringMat.colorNode = vec4(
        ringColor.mul(ringBand).mul(ringBright),
        float(1),
      );

      const ring = new Sprite(ringMat);
      ring.geometry = ringGeo;
      ring.frustumCulled = false;
      ring.name = 'shockwave-scatter-ring';
      target.object.add(ring);

      const HIDDEN = HALF + 1000;
      const brass = new Color('#ecd49d'); // Observatory brass (rest)
      const ice = new Color('#7fd4ff'); // ice (excited / displaced)

      const write = () => {
        const ringSpeed = num(params.ringSpeed, 1.5);
        tiles.count = activeCount;
        for (let i = 0; i < activeCount; i++) {
          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          positions[i * 3 + 2] = 0;
          // Tint by displacement magnitude: a resting element reads brass, a
          // displaced (riding-the-wave) element flares to ice — so the bulge
          // wave is visible as a band of cool colour, read LIVE so a same-t
          // re-seek still shows colour shift if anything moved. Premultiplied to
          // a BRIGHT level (>>120/255 luma) so tiles read as lit objects, not
          // near-black specks — fixes the advocate's near-black / 1px-dot flag.
          const off = Math.hypot(px[i] - homeX[i], py[i] - homeY[i]);
          const m = clamp(off / 0.55, 0, 1);
          const r = brass.r + (ice.r - brass.r) * m;
          const g = brass.g + (ice.g - brass.g) * m;
          const b = brass.b + (ice.b - brass.b) * m;
          // NormalBlending opaque balls — keep the base tint MODERATE so the grid
          // reads as distinct golden bodies on a dark field (not a white waffle
          // wall). Resting tiles sit at a calm brass mid-tone; tiles riding the
          // wave flare a touch brighter to ice, but the body shading (≤1) plus
          // this capped luma keeps the field well under blow-out.
          const lum = 0.6 + m * 0.45; // 0.6 (rest) → 1.05 (peak impact)
          colors[i * 3] = r * lum;
          colors[i * 3 + 1] = g * lum;
          colors[i * 3 + 2] = b * lum;
        }
        for (let i = activeCount; i < MAX_COUNT; i++) {
          positions[i * 3] = HIDDEN;
          positions[i * 3 + 1] = HIDDEN;
          positions[i * 3 + 2] = 0;
          colors[i * 3] = 0;
          colors[i * 3 + 1] = 0;
          colors[i * 3 + 2] = 0;
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;

        // Drive the visible ring: scale the quad to the live ring world radius
        // (the annulus sits at 0.84 of the quad → multiply so the arc lands at
        // the true ring front) and set its brightness so it flares while
        // expanding and fades to nothing during recharge.
        const r = ringRadius(ringSpeed);
        if (r < MAX_RADIUS) {
          const worldR = r / 0.84; // map normalised annulus radius → world front
          const quadScale = Math.max(worldR * 2.0, 0.001); // quad is 1 unit wide
          ring.scale.set(quadScale, quadScale, 1);
          // Brightness is DELIBERATELY DIM and additive only — the ring is a
          // sweeping wavefront accent, not a light source. When the radius is tiny
          // the annulus is concentrated at the centre and additive light pools
          // into a bloom mandala (the round-2 regression), so we FADE IT IN as the
          // ring leaves the centre and FADE IT OUT as it nears the corners. Peak
          // amplitude is kept low (~0.55) so summed coverage stays well under
          // white — the front reads as a clean expanding amber annulus crossing
          // the grid, never a central flare.
          const grow = clamp(r / MAX_RADIUS, 0, 1);
          // Scalar smoothstep (TSL `smoothstep` is for shader nodes, not JS).
          const ss = (e0: number, e1: number, x: number) => {
            const u = clamp((x - e0) / (e1 - e0), 0, 1);
            return u * u * (3 - 2 * u);
          };
          const birthFade = ss(0, 0.18, grow); // off at centre → on once it leaves
          const deathFade = 1 - ss(0.78, 1, grow); // fades before the corners
          ringBright.value = 0.55 * birthFade * deathFade;
          // Wavefront keeps a fairly constant, fairly THIN world thickness → a
          // crisp arc, thinner in normalised-quad units as the quad grows.
          ringThick.value = clamp(0.16 / Math.max(worldR, 0.4), 0.035, 0.2);
        } else {
          // Recharging: ring gone.
          ringBright.value = 0;
          ring.scale.set(0.001, 0.001, 1);
        }
      };

      stepper.reset();
      write();

      return {
        duration: () => CYCLE,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Any control sweep re-runs the sim to the same pinned frame → the frozen
        // frame visibly changes (standing function of the engaged pose).
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(tiles);
          target.object.remove(ring);
          tileGeo.dispose();
          tileMat.dispose();
          ringGeo.dispose();
          ringMat.dispose();
        },
      };
    },
  ),
};
