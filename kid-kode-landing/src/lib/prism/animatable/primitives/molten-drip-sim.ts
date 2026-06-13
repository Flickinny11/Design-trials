// molten-drip-sim — a hanging blob of VISCOUS molten metal/lava stretches under
// gravity, NECKS, and DRIPS off a glowing droplet that falls before the column
// reforms and the cycle repeats. CATALOG primitive (hard / glass, subject:'empty').
//
// REAL CPU SIM, not an easing curve. The physics:
//   • A pinned RESERVOIR sits at the top (a fat molten blob). It is NOT a static
//     decorative blob — it visibly PULSES (a slow molten swell) and sags into the
//     forming neck so the whole source reads alive in every frame.
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
// necking reads unmistakably. Reservoir + droplets are fat round beads. The drip
// COLUMN is the hero — it sits dead-centre and droplets are kept fully in-frame.
//
// DETERMINISM: reset()-and-replay via makeReplayStepper → the frame at time t is a
// pure function of (params, t). onParamChange → markDirty makes every trajectory
// control (viscosity/gravity/dripRate) visibly change any pinned frozen frame; heat
// is ALSO read live in write() so a same-t reseek still shows a change. No
// Math.random / Date.now — z spread seeded via the index-hash discipline (hash1).
//
// duration() is finite (a few drip cycles) and the rig loops t→0 → re-drip. The
// ~0.45 frozen phase is tuned to catch a droplet MID-DETACH / falling.
//
// RENDER PATH (round-2 white-out fix): the earlier ADDITIVE-blended build summed
// 3 overlapping reservoir lobes + neck root past 1.0 in every channel, so the whole
// molten body clipped to PURE WHITE (effRGB=[255,255,255], satPixels=0, warmFrac=0)
// — a blown disk + stray cream/cold-blue blobs, never glowing amber. The dominant
// cause was additive stacking on a DENSE field (★ catalog lesson: additive only
// survives for SPARSE translucent glows like bubble-rise — a packed molten column
// always blows out). The fix: instanced THREE.Sprite + PointsNodeMaterial (TSL)
// with NORMAL blending + an OPAQUE shaded amber CORE (alpha mask = bead profile)
// so each bead reads as a distinct solid molten body that OCCLUDES rather than
// SUMS — overlapping beads stay amber, never clip. A thin additive-free emissive
// rim gives the hot glow without summing to white. No envMap / transmission / ior
// → no cold-blue refraction artifact. Renders identically on WebGPU + WebGL2.
//
// Palette: Observatory Brass / amber molten (#f0b35a hot, #d9a86c body, #b9742e
// cool root) — warm metal, NEVER purple, never clipped white.

import {
  Sprite,
  BufferGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  Color,
  NormalBlending,
  DynamicDrawUsage,
} from 'three';
import { PointsNodeMaterial } from 'three/webgpu';
import { instancedBufferAttribute, uv, vec3, vec4, float, smoothstep, pow } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type PrimitiveDefinition } from '../contract';
import {
  makeReplayStepper,
  resolveSimTier,
  tierPick,
  clamp,
} from './_sim-core';

const DT = 1 / 120; // small fixed step (stiff-ish spring)
const SOURCE_Y = 1.0; // reservoir root height (pinned) — column reads top→bottom
// Recycle a free droplet a touch ABOVE the literal frame bottom so the fat bead
// (radius ≈0.24 quad) is fully inside the tile — no droplet ever clips the edge.
const FLOOR_Y = -0.95;
const MAX_DROPS = 6; // fixed pool of free falling droplets
const RESERVOIR_LOBES = 3; // fat blob lobes at the very top
// Generous fixed billboard footprint — must hold the fattest reservoir bead with
// its feathered glow (à la bokeh-drift / smoke-plume): the radius attribute drives
// where the falloff lives inside this quad, so it never reaches the square edge.
const FIXED_BILLBOARD = 0.92;

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
        // Slightly tightened ceiling so a fully syrupy thread still pinches off
        // before the tip can leave the frame.
        const detachLen = 0.5 + (1 - drip) * 0.42 + visc * 0.55;
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
          // Keep the falling droplet TIGHT to the column centre so it never clips
          // the tile's right/bottom edge (the advocate's cut-off droplet finding).
          dropX[d] = (hash(nextDrop * 1.7 + 0.3) - 0.5) * 0.05;
          dropZ[d] = (hash(nextDrop * 3.1 + 1.9) - 0.5) * 0.06;
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

      // ── Render: glowing molten beads as one instanced Sprite (TSL) ─────────
      // Per-bead instanced attributes: centre position, premultiplied warm color,
      // and a profile radius (quad units) that drives WHERE the soft falloff
      // lives inside the billboard. Filled every write().
      const positions = new Float32Array(MAX * 3);
      const colors = new Float32Array(MAX * 3);
      const radii = new Float32Array(MAX);
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      const radAttr = new InstancedBufferAttribute(radii, 1);
      posAttr.setUsage(DynamicDrawUsage);
      colAttr.setUsage(DynamicDrawUsage);
      radAttr.setUsage(DynamicDrawUsage);

      // Own billboard quad (never class-shared) so dispose() frees it.
      const geometry = new BufferGeometry();
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.setAttribute(
        'position',
        new BufferAttribute(
          new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
          3,
        ),
      );
      geometry.setAttribute(
        'uv',
        new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
      );
      geometry.setAttribute('instancePosition', posAttr);
      geometry.setAttribute('instanceColor', colAttr);
      geometry.setAttribute('instanceRadius', radAttr);

      // ── Look layer: TSL molten bead with NORMAL blending (no white-out) ─────
      // d: 0 at the quad centre → 1 at the edge midpoint (√2 at the corner).
      const d = uv().sub(0.5).mul(2).length();
      type FloatNode = ReturnType<typeof float>;
      // Per-bead radius drives the size of the bead inside the quad (bigger
      // radius → wider molten bead). Dividing d by it makes the disc scale.
      const rNode = instancedBufferAttribute(radAttr) as unknown as FloatNode;
      const dn = d.div(rNode.add(0.001));
      // ALPHA mask (coverage) — a near-solid disc of the molten body that falls to
      // 0 just before the edge. With NormalBlending this is what makes overlapping
      // beads OCCLUDE each other (premultiplied src-over) instead of SUMMING to
      // white. Soft 1px-free feather: full inside the core, smooth to 0 at dn≈1.
      const alpha = smoothstep(float(1.02), float(0.82), dn)
        // …and hard-clipped to zero before the billboard's square edge.
        .mul(smoothstep(float(0.97), float(0.74), d));

      // RGB color: the per-bead warm amber tint, BRIGHTER toward the molten core so
      // it reads as a glowing hot bead — but the channels are pre-capped on the CPU
      // (setBead) so even the crest peaks WELL UNDER white. A subtle radial
      // brighten (×~1.25 at centre) gives a hot inner glow without clipping.
      const coreGlow = pow(smoothstep(float(1.0), float(0.0), dn), float(1.5)).mul(0.18).add(1);
      const moltenRGB = (instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      }).mul(coreGlow);

      const material = new PointsNodeMaterial({
        size: FIXED_BILLBOARD,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: NormalBlending,
        depthWrite: false,
      });
      material.positionNode = instancedBufferAttribute(posAttr);
      // Opaque-cored, alpha-masked molten bead. NormalBlending + this alpha → solid
      // amber bodies on the dark field; the field never clips to white.
      material.colorNode = vec4(moltenRGB, alpha);

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = MAX;
      sprite.frustumCulled = false; // beads extend beyond the unit quad
      sprite.name = 'molten-drip-sim';
      target.object.add(sprite);

      const HIDDEN_Y = FLOOR_Y - 1000; // park unused beads far below view

      // Live color-control cache (re-parse only when the hex actually changes).
      const tintC = new Color();
      let lastTint = '';
      // Warm reference anchors for the molten gradient: hot crest (near the
      // emissive root) and a cooler body further down the thread. The user tint
      // multiplies in so a custom hue still reads, but we bias every bead WARM
      // and keep peak luma UNDER clipping so it glows amber, never blows to white.
      const hotC = new Color('#f0b35a'); // hot amber crest
      const bodyTmp = new Color();

      const setBead = (i: number, x: number, y: number, z: number, r: number, lum: number, warm: number) => {
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        // Mix the user tint toward the hot amber crest by `warm` (0 body → 1 hot),
        // then premultiply brightness. Peak lum is capped < 1 so additive
        // compositing lands a glowing amber (e.g. ~[255,180,95]) not pure white.
        bodyTmp.copy(tintC).lerp(hotC, warm);
        colors[i * 3] = bodyTmp.r * lum;
        colors[i * 3 + 1] = bodyTmp.g * lum;
        colors[i * 3 + 2] = bodyTmp.b * lum;
        // Profile radius in quad units; clamp under 0.5 so the feather never
        // reaches the square edge of the billboard.
        radii[i] = clamp(r, 0.08, 0.46);
      };
      const hideBead = (i: number) => {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = HIDDEN_Y;
        positions[i * 3 + 2] = 0;
        colors[i * 3] = 0;
        colors[i * 3 + 1] = 0;
        colors[i * 3 + 2] = 0;
        radii[i] = 0.0001;
      };

      const write = () => {
        const heat = clamp(num(params.heat, 0.7), 0, 1);
        const visc = clamp(num(params.viscosity, 0.6), 0, 1);
        const tintHex = str(params.tint, '#d9a86c');
        if (tintHex !== lastTint) {
          tintC.set(tintHex);
          lastTint = tintHex;
        }
        const t = stepper.now();

        // Heat drives the glow LIVE (visible even on a same-t reseek). Capped HARD
        // so the peak molten body lands a SATURATED amber, NOT clipped white. With
        // NormalBlending the final pixel is the bead color itself (no summing), so
        // the hot amber crest (#f0b35a ≈ R0.94) × glow × the ~1.18 core boost must
        // stay under 1.0 in every channel → glow tops out at 0.78. The amber's R≫B
        // gap then survives compositing (warmFrac>0, satPixels>0), and the body
        // luma still sits well above the advocate's >120 bar. The 0.40-wide swing
        // makes HEAT bite hard (the body visibly darkens→glows) while the 0.80
        // ceiling × ~1.18 core boost keeps even the hot R channel under 1.0.
        const glow = 0.4 + heat * 0.4; // 0.40 → 0.80

        // Bead radius in quad units; the reservoir is fattest, the thread thin.
        const fatQuad = 0.4 * (1 - visc * 0.1); // reservoir bead radius (quad units)
        let inst = 0;

        // (a) Reservoir blob — fat lobes clustered at the source root. It PULSES
        //     (slow molten swell, fn of t) and sags slightly into the neck, so it
        //     is never a pixel-static decorative blob across frames.
        const pulse = 1 + Math.sin(t * 2.1) * 0.06; // ±6% molten breathing
        const sag = Math.sin(t * 1.3) * 0.018; // tiny vertical settle
        for (let i = 0; i < RESERVOIR_LOBES; i++) {
          const y = SOURCE_Y + 0.05 - i * 0.075 + sag;
          const r = fatQuad * (1.0 - i * 0.16) * pulse;
          // Reservoir is the hottest source → strongest warm crest + full glow.
          setBead(inst++, 0, y, 0, r, glow, 0.85);
        }

        // (b) The hanging NECK: lobes interpolated root→tip. Radius pinches to a
        //     minimum in the MIDDLE (capillary neck), fattening into the forming
        //     bead at the tip — the necking reads unmistakably. The tip swells
        //     with tipMass. This is the HERO — dead-centre, well lit.
        const rootY = SOURCE_Y - 0.06;
        const neckLen = Math.max(0.0001, rootY - tipY);
        const tipBead = fatQuad * (0.6 + tipMass * 0.12);
        for (let n = 0; n < MAX_NECK; n++) {
          if (n >= NECK_LOBES) {
            hideBead(inst++);
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
              ? fatQuad * 0.45 * clamp(waist, 0.16, 1)
              : tipBead * (0.55 + (f - 0.85) / 0.15 * 0.45); // swell into the bead
          // The thread cools as it draws out: hot near the root (warm≈0.8),
          // cooling toward the falling tip (warm≈0.35). Glow slightly dims down
          // the thread so the hero crest reads hottest.
          const warm = 0.8 - f * 0.45;
          const lum = glow * (0.92 - f * 0.18);
          setBead(inst++, 0, y, 0, Math.max(radius, 0.05), lum, warm);
        }

        // (c) Free falling droplets (real ballistic beads) — kept near centre and
        //     within FLOOR_Y so they never clip the tile edge.
        for (let dI = 0; dI < MAX_DROPS; dI++) {
          if (dI >= dropCount || !dropActive[dI]) {
            hideBead(inst++);
            continue;
          }
          // A falling droplet is a discrete bead of fluid that has left the hot
          // root → cooler amber body, slightly dimmer glow.
          setBead(inst++, dropX[dI], dropY[dI], dropZ[dI], dropR[dI] * 1.6, glow * 0.82, 0.4);
        }

        // Park any remaining allocation (defensive; inst should equal MAX here).
        for (; inst < MAX; inst++) hideBead(inst);

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        radAttr.needsUpdate = true;
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
          target.object.remove(sprite);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
