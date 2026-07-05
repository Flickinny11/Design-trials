// smoky-fire — a fire with heavy smoke: bright orange flames at the base feed a
// churning grey smoke PLUME rising above. HARD / GPU primitive. Swaps the host
// plane's material for a MeshBasicNodeMaterial.
//
// ROUND-2 FIX (user-advocate gate): the round-1 build shaped the smoke with a
// bare vertical ramp (smoothstep over u.y) and NO horizontal envelope, so the
// smoke filled the full quad width and clipped flat at the left/top/right quad
// edges — a hard grey RECTANGLE of low-frequency value-noise static floating
// disconnected above the fire. The fix:
//   1. ALL noise now comes from the shared `_volume-fbm` helper (rotated-octave
//      + quintic + domain-warped value noise) — no inline cubic value-noise, so
//      no axis-aligned lattice / TV-static at any frequency.
//   2. The smoke is a PLUME, not a band: a meandering centreline (1-D warped
//      field over height+time), a half-width that starts narrow at the fire
//      mouth and widens with height, an edge modulated by a low-frequency
//      WARPED field (organic silhouette), and vertical envelopes that ramp the
//      plume in just above the flame and fade it fully out BEFORE the top edge.
//      The width/sway budget keeps the plume inside the quad on every side, so
//      alpha is exactly 0 around the plume — the silhouette is the smoke's own
//      organic shape, never a quad edge or a uniform vignette.
//   3. The fire→smoke transition is blended: ember/warm glow tints and lifts
//      the smoke base where it meets the flame, so the plume visibly rises OUT
//      of the fire instead of floating above it.
//
// The lower region renders flame (upward-advected warped fbm through a
// blackbody-ish ramp, bright); the smoke plume rises from the flame mouth,
// widening and thinning as it goes. opacityNode combines both. seek() advances
// the time uniform; onParamChange() updates the live uniforms. Uniform handles
// are published on target.userData so a headless CPU test can observe the
// animation without a real GPU.
//
// DISTINCT from fire-flame (which is flame-only, additive, no smoke): this is a
// flame BASE plus a churning grey SMOKE PLUME above it, normal-blended.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  mix,
  max,
  smoothstep,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';
import { fbmRot, fbmWarped } from './_volume-fbm';

const SCHEMA = [
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.2, max: 4, step: 0.1, default: 1.4 },
  {
    id: 'smokeAmount',
    label: 'Smoke',
    type: 'fader',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.6,
  },
  { id: 'turbulence', label: 'Turbulence', type: 'knob', min: 0.2, max: 3, step: 0.1, default: 1.3 },
] as const;

// TSL node types are intentionally loose here (cast through a generic vec node)
// so strict typing of vec2()/vec3() join-nodes does not pin helper params —
// mirrors caustics.ts / fire-flame.ts / _volume-fbm.ts casting discipline. The
// built node graph is identical to the strict free-function form.
type TVec = ReturnType<typeof vec2>;
type TF = ReturnType<typeof float>;
const v2 = (a: unknown, b: unknown) =>
  (vec2 as unknown as (x: unknown, y: unknown) => unknown)(a, b) as TVec;
const v3 = (a: unknown, b: unknown, c: unknown) =>
  (vec3 as unknown as (x: unknown, y: unknown, z: unknown) => unknown)(a, b, c) as TVec;
// fbmRot/fbmWarped build scalar fields but carry the helper's loose vec2 node
// type; re-type them as float nodes so the free-function smoothstep/clamp/mix
// gate overloads accept them (identical runtime graph).
const warpedF = (p: TVec, warp: number, octaves: number) =>
  fbmWarped(p, warp, octaves) as unknown as TF;
const rotF = (p: TVec, octaves: number) => fbmRot(p, octaves) as unknown as TF;

export const smokyFirePrimitive: PrimitiveDefinition = {
  name: 'smoky-fire',
  label: 'Smoky Fire',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A fire with heavy smoke — orange flames at the base feeding a churning grey smoke column rising above.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'smoky-fire', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRise = uniform(num(params.rise, 1.4));
      const uSmoke = uniform(num(params.smokeAmount, 0.6));
      const uTurb = uniform(num(params.turbulence, 1.3));

      // Publish handles so the CPU test (and host) can observe state.
      target.userData.smokyFire = { uTime, uRise, uSmoke, uTurb };

      const u = uv();
      const t = uTime;

      // ── FLAME (lower region): warped fbm advected upward fast, blackbody ramp.
      // Shape-masked field, so a lower base frequency WARPED field is fine; the
      // helper's rotation + quintic interp + warp mean no lattice at any octave.
      const flameRise = t.mul(uRise).mul(2.2);
      const flameDomain = v2(
        u.x.mul(uTurb).mul(3.4),
        u.y.mul(uTurb).mul(4.6).sub(flameRise),
      );
      const flameNoise = warpedF(flameDomain, 0.7, 5);
      // Vertical flame envelope: bright/wide at the base, narrowing & fading up.
      const flameBase = smoothstep(float(0.95), float(0.0), u.y); // 1 at base → 0 mid/top
      // Smooth SQUARED centre distance for the side mask — no abs() fold (an
      // abs crease is a derivative seam down the middle; x² is C∞).
      const dx = u.x.sub(0.5);
      const d2 = dx.mul(dx);
      const flameWidth = mix(float(0.5), float(0.16), tslClamp(u.y.mul(1.6), float(0), float(1)));
      const fw2 = flameWidth.mul(flameWidth);
      const flameSide = smoothstep(fw2, fw2.mul(0.16), d2);
      const flameThresh = u.y.mul(0.6).add(0.1);
      const flameRaw = max(flameNoise.mul(flameBase).mul(flameSide).sub(flameThresh), float(0)).mul(3.4);
      const flame = tslClamp(flameRaw, float(0), float(1));
      // Blackbody ramp: red → orange → yellow → white-hot core (brighter low).
      const fRed = vec3(0.85, 0.07, 0.02);
      const fOrange = vec3(1.0, 0.4, 0.05);
      const fYellow = vec3(1.0, 0.84, 0.26);
      const fWhite = vec3(1.0, 0.97, 0.82);
      const fr1 = mix(fRed, fOrange, smoothstep(float(0.0), float(0.4), flame));
      const fr2 = mix(fr1, fYellow, smoothstep(float(0.35), float(0.72), flame));
      const flameColor = mix(fr2, fWhite, smoothstep(float(0.7), float(1.0), flame));

      // ── SMOKE PLUME: rises from the fire mouth, widens & thins with height ──
      const smokeRise = t.mul(uRise).mul(0.9);

      // Meandering centreline: a 1-D warped field over (height, time). Sway grows
      // with height so the plume base stays anchored over the fire. Budgeted so
      // |cx − 0.5| ≤ ~0.125 — combined with the max half-width the plume can
      // never reach the side edges of the quad.
      const sway = warpedF(v2(u.y.mul(2.3).sub(smokeRise.mul(0.45)), float(7.31)), 1.0, 3).sub(0.5);
      const swayAmt = u.y.mul(0.22).add(0.03);
      const cx = float(0.5).add(sway.mul(swayAmt));
      const sx = u.x.sub(cx);
      const s2 = sx.mul(sx);

      // Half-width: narrow at the fire mouth, widening with height; the edge is
      // modulated by a low-frequency WARPED field so the silhouette billows
      // organically instead of being a clean cone. Max reach ≈ 0.95 < 1.0.
      const widen = smoothstep(float(0.18), float(0.95), u.y);
      const edgeMod = warpedF(
        v2(u.x.mul(3.1).add(11.7), u.y.mul(3.1).sub(smokeRise.mul(0.7))),
        1.0,
        3,
      );
      const plumeWidth = mix(float(0.12), float(0.28), widen).mul(edgeMod.mul(0.6).add(0.55));
      const pw2 = plumeWidth.mul(plumeWidth);
      const plumeSide = smoothstep(pw2, pw2.mul(0.18), s2);

      // Vertical envelope: ramps in just above the flame mouth (overlapping the
      // flame so the plume is CONNECTED to the fire), fades fully out by
      // y ≈ 0.97 — well inside the quad, so the top edge never clips it.
      const plumeUp = smoothstep(float(0.14), float(0.40), u.y);
      const plumeTop = smoothstep(float(0.97), float(0.58), u.y);
      const plumeEnv = plumeSide.mul(plumeUp).mul(plumeTop);

      // Billowing internal structure: a warped body field (base freq ≈ 7.3 at
      // the default turbulence) plus finer rotated-fbm curls advected faster.
      const bodyDomain = v2(
        u.x.mul(uTurb).mul(5.6),
        u.y.mul(uTurb).mul(5.6).sub(smokeRise),
      );
      const body = warpedF(bodyDomain, 0.9, 5);
      const curlDomain = v2(
        u.x.mul(uTurb).mul(9.2).add(17.3),
        u.y.mul(uTurb).mul(9.2).sub(smokeRise.mul(1.45)).add(4.7),
      );
      const curl = rotF(curlDomain, 5);
      const smokeField = tslClamp(body.mul(0.7).add(curl.mul(0.45)), float(0), float(1));

      // Thinning with height: the plume widens but gets more diffuse as it rises.
      const thinning = mix(float(1.0), float(0.55), smoothstep(float(0.35), float(0.95), u.y));
      const smokeDensity = smokeField.mul(plumeEnv).mul(thinning).mul(uSmoke).mul(1.8);
      // Alpha gate: the noise carves the silhouette, so the plume's edge is the
      // smoke's own organic shape; density 0 outside the envelope → alpha 0.
      const smokeAlpha = smoothstep(float(0.1), float(0.6), smokeDensity).mul(0.85);

      // Smoke colour: internal lit contrast (curl crests catch light, body
      // troughs recede), grey deepening with height, and an EMBER GLOW that
      // warms + brightens the plume base where it meets the flame.
      const smokeShade = curl.sub(body.mul(0.55)).mul(0.6); // ~[-0.35 .. +0.4]
      const greyBase = mix(float(0.46), float(0.18), smoothstep(float(0.15), float(0.95), u.y));
      const grey = tslClamp(greyBase.mul(smokeShade.add(1)), float(0), float(1));
      const greyCol = v3(grey, grey.mul(0.99), grey.mul(0.97));
      const emberGlow = smoothstep(float(0.6), float(0.16), u.y); // 1 at the fire mouth → 0 above
      const emberCol = vec3(1.0, 0.42, 0.1);
      const smokeColor = tslClamp(
        mix(greyCol, emberCol, emberGlow.mul(0.6)).mul(emberGlow.mul(0.5).add(1)),
        float(0),
        float(1),
      );

      // ── Vertical transition: flame dominates low, smoke dominates high. ─────
      // smokeAmount pulls the transition lower (more smoke = earlier). The bands
      // overlap, and the ember-tinted smoke base blends the handoff.
      const transLow = mix(float(0.5), float(0.3), uSmoke);
      const toSmoke = smoothstep(transLow, transLow.add(0.28), u.y);

      const colorNode = mix(flameColor, smokeColor, toSmoke);

      // Combined opacity: flame alpha where flame dominates, smoke alpha where
      // smoke dominates. Flame fades out as we transition up; smoke fades in.
      const flameAlpha = flame.mul(float(1).sub(toSmoke));
      const opacityNode = tslClamp(max(flameAlpha.mul(1.3), smokeAlpha), float(0), float(1));

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Looping, time-driven effect — purely stateful.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uRise.value = num(params.rise, 1.4);
          uSmoke.value = num(params.smokeAmount, 0.6);
          uTurb.value = num(params.turbulence, 1.3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rise') uRise.value = num(value, 1.4);
          else if (id === 'smokeAmount') uSmoke.value = num(value, 0.6);
          else if (id === 'turbulence') uTurb.value = num(value, 1.3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.smokyFire;
        },
      };
    },
  ),
};
