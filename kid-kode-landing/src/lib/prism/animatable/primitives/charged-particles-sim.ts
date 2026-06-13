// charged-particles-sim — charged motes drift through a crossed magnetic +
// electric field and follow REAL Lorentz-force paths: F = q(E + v×B). With B
// pointing along +z, v×B curves each mote in the xy-plane, so a moving charge
// spirals on a circular arc (cyclotron motion) whose handedness flips with the
// sign of q. Positive charges (brass/amber) and negative charges (ice) therefore
// peel off in OPPOSITE directions, and a small z-component on B/velocity gives
// the streams a gentle helical lean. The electric field E adds a steady drift
// that pushes + and − charges apart — so the two species visibly separate.
//
// CATALOG primitive (hard / particles, subject:'empty'). This is an INTEGRATED
// particle system, not a closed-form field-line drawing: each mote holds true
// velocity state (vx,vy,vz) that is advected by the force field every fixed step
// via semi-implicit (symplectic) Euler — v += (F/m)*dt; p += v*dt — with light
// drag so it stays bounded inside the tile. This is the distinction the audit
// flagged: magnetic-field draws closed-form field lines; THIS integrates the
// motion of charges THROUGH the field.
//
// Determinism: the only entropy is hash1/hash2/shash seeding of initial
// positions/velocities/charge-sign at reset; the integrator is otherwise pure.
// makeReplayStepper resets-and-replays on backward seek, so the frame at time t
// is a pure function of (params, t) and every control (field B, charge spread,
// count, speed) re-shapes any frozen frame the harness pins. The ~0.45 frozen
// phase lands mid-flight, where the two species have curved into two interleaving
// streams — positive arcs braiding through negative arcs.

import {
  InstancedMesh,
  BufferGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  Color,
  Matrix4,
  Quaternion,
  Vector3,
  AdditiveBlending,
  DynamicDrawUsage,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { instancedBufferAttribute, uv, vec3, vec4, float, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import {
  hash1,
  hash2,
  shash,
  makeReplayStepper,
  resolveSimTier,
  tierPick,
} from './_sim-core';

const DT = 1 / 90; // tight step → smooth cyclotron arcs at high B
const MAX_COUNT = 480; // build-time max; live `count` clamps to this
const SPAN = 1.35; // working half-extent in x/y (camera-safe envelope)
const WRAP = 1.95; // recycle a mote once it flies past this radius

// RENDER PATH (P0 particle lesson — bubble-rise/smoke-plume/hyperspace-warp):
// THREE.Points + PointsMaterial render 1px specks on near-black under
// three/webgpu (the advocate's whole complaint). So each mote is instead an
// instanced oriented STREAK — a short segment quad stretched ALONG the mote's
// velocity (so its curved Lorentz arc reads as a trail) with a BRIGHT ROUND
// HEAD (the mote reads as an object with mass, luma >> 120) tapering to a soft
// tail. A per-mote instanced tint carries (species warmth × brightness)
// premultiplied, so additive blending reads it as a glowing filament. Warm
// brass for + charges, cool ice for − charges — the two species are plainly
// distinguishable. No 1px squares, no purple, DOM-free, TSL only.
const HEAD_W = 0.052; // streak cross-thickness at the head (world units) — gives mass
const MIN_LEN = 0.07; // a near-still mote still shows a round head, never a speck
const MAX_LEN = 0.34; // cap so a fast mote's trail never overruns the tile edge
const LEN_GAIN = 0.13; // how hard speed stretches the trail

// Two species: + (brass/amber, charge +1) and − (ice, charge −1). Bright base
// colours, lifted hard in the per-mote luminance below so motes read well over
// 120 luma (no purple anywhere).
const COL_POS = new Color('#ffcf73'); // warm brass/amber — positive (saturated, bright)
const COL_NEG = new Color('#8fe2ff'); // cool ice — negative (bright cyan-ice)

const SCHEMA = [
  // B field strength along z → cyclotron radius. Higher = tighter curl.
  { id: 'field', label: 'Field (B)', type: 'knob', min: 0.5, max: 9, step: 0.1, default: 4.5 },
  // Charge magnitude spread: scatters |q| across motes so radii vary → richer braid.
  { id: 'charge', label: 'Charge Spread', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.55 },
  { id: 'count', label: 'Count', type: 'knob', min: 60, max: 480, step: 1, default: 320 },
  // Injection speed of the two streams.
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.3, max: 3, step: 0.05, default: 1.4 },
] as const;

export const chargedParticlesSimPrimitive: PrimitiveDefinition = {
  name: 'charged-particles-sim',
  label: 'Charged Particles',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Charged motes drift through a crossed magnetic + electric field and follow real Lorentz-force curved/helical paths (F = q(E + v×B)); positive (brass) and negative (ice) charges curl opposite ways and drift apart — integrated velocity, not field-line drawing.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'charged-particles-sim', category: 'particles', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Heavy O(n) integrator — degrade count hard on T0 so a tile stays smooth.
      const tierCap = tierPick(tier, { T0: 140, T1: 300, T2: MAX_COUNT });

      // ── Deterministic per-mote seeds ──────────────────────────────────────
      // Two interleaving streams: even-index motes are the + stream injected
      // from the left moving right; odd-index are the − stream injected from the
      // right moving left. A hashed |q| magnitude and a small z give variety and
      // a helical lean. Charge SIGN is parity-locked so the two species are
      // genuinely distinct populations (not a random mix).
      const seedX = new Float32Array(MAX_COUNT);
      const seedY = new Float32Array(MAX_COUNT);
      const seedZ = new Float32Array(MAX_COUNT);
      const seedVX = new Float32Array(MAX_COUNT);
      const seedVY = new Float32Array(MAX_COUNT);
      const seedVZ = new Float32Array(MAX_COUNT);
      const qSign = new Float32Array(MAX_COUNT); // +1 / −1 (species, parity-locked)

      const seed = () => {
        for (let i = 0; i < MAX_COUNT; i++) {
          const pos = (i & 1) === 0; // even → positive species
          qSign[i] = pos ? 1 : -1;
          // Stagger entry along the stream axis so motes don't all arrive at once.
          const along = hash2(i, 1.7); // 0..1 position along the injection line
          const lane = shash(i * 1.3 + 4.1); // −1..1 transverse lane offset
          // Stage each stream INSIDE the wrap envelope (so a mote integrates
          // before it can recycle) on the inflow side, then let it curl across
          // and fly out the far side where it recycles back to launch.
          if (pos) {
            seedX[i] = -0.55 - along * 0.75; // left inflow, x ∈ [−1.30, −0.55]
            seedY[i] = lane * 0.55 + 0.12;
            seedVX[i] = 1; // moving right (speed applied live)
            seedVY[i] = shash(i * 2.7 + 0.5) * 0.18;
          } else {
            seedX[i] = 0.55 + along * 0.75; // right inflow, x ∈ [0.55, 1.30]
            seedY[i] = lane * 0.55 - 0.12;
            seedVX[i] = -1; // moving left
            seedVY[i] = shash(i * 2.7 + 9.5) * 0.18;
          }
          seedZ[i] = shash(i * 3.9 + 2.2) * 0.3;
          seedVZ[i] = shash(i * 5.1 + 6.4) * 0.12; // small → helical lean
        }
      };
      seed();

      // ── Live integrated state (closure-held flat arrays) ──────────────────
      const px = new Float32Array(MAX_COUNT);
      const py = new Float32Array(MAX_COUNT);
      const pz = new Float32Array(MAX_COUNT);
      const vx = new Float32Array(MAX_COUNT);
      const vy = new Float32Array(MAX_COUNT);
      const vz = new Float32Array(MAX_COUNT);
      // `age` lets a recycled mote re-enter with its seeded launch state.
      const recycleSeed = (i: number, sp: number) => {
        px[i] = seedX[i];
        py[i] = seedY[i];
        pz[i] = seedZ[i];
        vx[i] = seedVX[i] * sp;
        vy[i] = seedVY[i] * sp;
        vz[i] = seedVZ[i] * sp;
      };

      const reset = () => {
        const sp = num(params.speed, 1.4);
        for (let i = 0; i < MAX_COUNT; i++) recycleSeed(i, sp);
      };

      // One fixed integration step: apply the Lorentz force F = q(E + v×B) to
      // every active mote and advance it with semi-implicit Euler. B = (0,0,Bz)
      // so v×B = (vy*Bz, −vx*Bz, 0) — the in-plane rotation that makes the
      // cyclotron arc. E is a small +x drift that pushes + and − apart. Light
      // drag keeps speeds bounded so the braid stays inside the tile.
      const step = (dt: number) => {
        const count = Math.max(1, Math.min(tierCap, Math.round(num(params.count, 320))));
        const Bz = num(params.field, 4.5);
        const spread = clamp(num(params.charge, 0.55), 0, 1);
        const sp = num(params.speed, 1.4);
        const Ex = 0.55; // electric drift magnitude (× q below)
        const drag = 0.013; // per-step velocity bleed
        const wrap2 = WRAP * WRAP;

        for (let i = 0; i < count; i++) {
          // Effective charge: sign × (live-spread magnitude). hash1 gives a
          // stable per-mote 0..1; spread fans |q| around 1 so radii vary.
          const q = qSign[i] * (1 + (hash1(i * 0.911 + 0.3) - 0.5) * 2 * spread * 0.8);

          // Lorentz acceleration (unit mass). With B = (0,0,Bz), the cross
          // product v×B = (vy·Bz, −vx·Bz, 0) — the in-plane rotation that bends
          // the path into a cyclotron arc; sign(q) flips the handedness. E is a
          // small +x drift (× q) that pushes + and − species apart. The z axis
          // has no magnetic term (B is purely +z), so vz is carried ballistically
          // and the seeded vz gives each stream its gentle helical lean.
          const ax = q * (Ex + vy[i] * Bz);
          const ay = q * (-vx[i] * Bz);

          // Semi-implicit Euler: integrate velocity first, then position.
          vx[i] += ax * dt;
          vy[i] += ay * dt;
          // Drag — bounded orbits, no runaway energy.
          vx[i] -= vx[i] * drag;
          vy[i] -= vy[i] * drag;
          vz[i] -= vz[i] * drag;
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
          pz[i] += vz[i] * dt;

          // Recycle a mote that has spiralled out of the working envelope so the
          // two streams keep flowing (continuous, looping injection).
          if (px[i] * px[i] + py[i] * py[i] > wrap2) recycleSeed(i, sp);
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Render: one instanced oriented-streak field (brass / ice trails) ──
      // Base segment quad whose ORIGIN (x=0) is the streak HEAD and whose body
      // trails back to x=−1 (the TAIL), with y∈[−0.5,0.5] for thickness. Each
      // mote's matrix puts the quad origin (head) at the mote position and
      // rotates +X onto the mote's velocity — so the quad sweeps BACK along the
      // path the mote just travelled, drawing the curved Lorentz arc as a
      // visible comet streak. uv.x runs 0 (tail, faded) → 1 (head, bright).
      const geometry = new BufferGeometry();
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.setAttribute(
        'position',
        new BufferAttribute(
          new Float32Array([-1, -0.5, 0, 0, -0.5, 0, 0, 0.5, 0, -1, 0.5, 0]),
          3,
        ),
      );
      geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));

      // Per-mote tint (species warmth × brightness), premultiplied so additive
      // blending reads it as a glowing filament. Attached by name so tools can
      // discover the live buffer.
      const tint = new Float32Array(MAX_COUNT * 3);
      const tintAttr = new InstancedBufferAttribute(tint, 3);
      tintAttr.setUsage(DynamicDrawUsage);
      geometry.setAttribute('instanceTint', tintAttr);

      // ── Look layer: TSL streak profile — bright round head, tapered tail ──
      // uv.x: 0 at the tail → 1 at the head (where the mote IS). The head is a
      // bright dense disc; the body tapers toward the tail so the trail fades out
      // like a motion streak. A soft cross-falloff (smoothstepped to EXACT zero
      // at the quad edge) keeps the filament round, never a hard rectangle.
      const headTail = uv().x; // 0 tail → 1 head
      // Head bloom: bright dense knob near uv.x=1 (the mote body → reads as mass).
      const head = smoothstep(float(0.55), float(1.0), headTail);
      // Body: a soft ramp the length of the trail so the arc is visible, not just
      // a dot — fades from ~0.18 at the tail to full at the head.
      const body = smoothstep(float(0.0), float(0.85), headTail).mul(0.55).add(0.12);
      // Cross-falloff: round at the head (full thickness), pinching toward the
      // tail so the streak reads as a comet, not a bar.
      const crossR = float(0.5).sub(headTail.oneMinus().mul(0.18)); // wider at head
      const cross = smoothstep(crossR, float(0.0), uv().y.sub(0.5).abs());
      // Profile: a strong head accent on top of the tapered body, all clipped by
      // the round cross-falloff. Head dominates → each mote reads as an object.
      const profile = cross.mul(body.add(head.mul(1.6)));
      // TSL d.ts types instancedBufferAttribute() as a bare Node; the runtime is a
      // full chainable ShaderNodeObject (house casting discipline, cf. embers.ts).
      const moteTint = instancedBufferAttribute(tintAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };
      const lookColor = moteTint.mul(profile);

      const material = new MeshBasicNodeMaterial({
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.colorNode = vec4(lookColor as unknown as ReturnType<typeof vec3>, float(1));

      const mesh = new InstancedMesh(geometry, material, MAX_COUNT);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false; // instances extend beyond the unit quad
      mesh.count = MAX_COUNT; // live count narrows this in write()
      mesh.name = 'charged-particles-sim';
      target.object.add(mesh);

      // ── Reusable scratch + the degenerate (dark) park pose ────────────────
      const mat4 = new Matrix4();
      const quat = new Quaternion();
      const posV = new Vector3();
      const sclV = new Vector3();
      const dirV = new Vector3();
      const X_AXIS = new Vector3(1, 0, 0);
      const ZERO_MAT = new Matrix4().makeScale(0, 0, 0); // parked → invisible

      const write = () => {
        const count = Math.max(1, Math.min(tierCap, Math.round(num(params.count, 320))));
        mesh.count = count;

        for (let i = 0; i < count; i++) {
          // Velocity direction (projected to the xy-plane the arc curves in) →
          // the streak points back along the path. Length ∝ in-plane speed so a
          // fast curling mote draws a longer arc; a near-still one keeps a round
          // head (MIN_LEN floor).
          let dx = vx[i];
          let dy = vy[i];
          let sp2 = dx * dx + dy * dy;
          if (sp2 < 1e-8) {
            // Degenerate velocity → give the head a stable horizontal axis so it
            // still renders as a round dot (never zero-scale → never invisible).
            dx = 1;
            dy = 0;
            sp2 = 0;
          }
          const speed = Math.sqrt(sp2);
          const inv = speed > 1e-5 ? 1 / speed : 1;
          let length = MIN_LEN + speed * LEN_GAIN;
          if (length > MAX_LEN) length = MAX_LEN;

          // Orient +X onto the mote's +velocity direction; the quad origin (its
          // bright HEAD at x=0) is anchored at the mote position, and the body
          // (x∈[−1,0], the faded TAIL) trails BACKWARD along −velocity — exactly
          // the curved path the mote just travelled. The matrix translation thus
          // equals the mote position (what the harness/test samples).
          dirV.set(dx * inv, dy * inv, 0);
          quat.setFromUnitVectors(X_AXIS, dirV);
          posV.set(px[i], py[i], pz[i]);
          sclV.set(length, HEAD_W, 1);
          mat4.compose(posV, quat, sclV);
          mesh.setMatrixAt(i, mat4);

          // ── Per-mote tint (species warmth × brightness premultiply) ───────
          const c = (i & 1) === 0 ? COL_POS : COL_NEG;
          // Slight per-mote brightness jitter for a luminous, non-flat field;
          // faster motes blaze a little brighter (the arc is hot). The 2.1 lift
          // is HDR-ish so additive heads clip toward white core → luma >> 120.
          const jitter = 0.82 + hash2(i, 11.3) * 0.18;
          const speedGlow = 1.0 + Math.min(1, speed * 0.5) * 0.6;
          const lum = jitter * speedGlow * 2.1;
          tint[i * 3] = c.r * lum;
          tint[i * 3 + 1] = c.g * lum;
          tint[i * 3 + 2] = c.b * lum;
        }
        // Park motes above the live count at a degenerate (zero-scale, dark)
        // pose → cost-free, never a stray streak, buffers stay deterministic.
        for (let i = count; i < MAX_COUNT; i++) {
          mesh.setMatrixAt(i, ZERO_MAT);
          tint[i * 3] = 0;
          tint[i * 3 + 1] = 0;
          tint[i * 3 + 2] = 0;
        }
        mesh.instanceMatrix.needsUpdate = true;
        tintAttr.needsUpdate = true;
      };

      reset();
      write();

      return {
        // Continuous injected field — loops cleanly; rig pins ~0.45 mid-flight.
        duration: () => Infinity,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Trajectory controls (field B, charge spread) only re-shape the path,
        // so they MUST re-run the sim to the same pinned t to change the frozen
        // frame. markDirty makes every control a standing function of the pose.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(mesh);
          mesh.dispose();
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
