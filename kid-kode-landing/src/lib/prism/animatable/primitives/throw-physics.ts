// throw-physics — grab the card with the cursor and THROW it: it sails on real
// ballistics, bounces off the tile-frame walls, and glides home ashamed. POINTER
// / hard. Pure CPU transform (translate + rotation.z spin + a faint held tilt) —
// never mutates the subject's own materials/look.
//
// DESIGN-REFERENCES §7 (Cuberto mouse-follower / magnetic-elements proximity
// snap / Cursify springy presets) — the §7 libraries spring a DOM element toward
// the cursor and skew it on movement. This takes that *grab-and-fling* gesture
// and runs it as a real drag/throw INTERACTION STATE MACHINE on our three/webgpu
// stack: pick the card up, whip it, and let go — release momentum becomes a
// genuine ballistic toss with gravity, air drag, and wall rebounds.
//
// THE STATE MACHINE (closure) — HELD → THROWN → RETURN → HELD:
//   • HELD: the pointer is engaged near the card (prox < gripRadius). The card
//     spring-follows the pointer offset with a slight lag and a held tilt
//     (rotation.z toward the throw direction). A small gravity SAG droops it
//     while held so the gravity control reshapes the held frame too.
//   • THROWN: on disengage (pointer leaves the grip zone) WITH stored release
//     velocity, the card launches with that velocity (scaled by `power`) and
//     integrates gravity + quadratic-ish air drag via semi-implicit Euler,
//     BOUNCING off the subject-relative tile-frame walls — restitution < 1
//     (`bounciness`) bleeds energy each hit and a SPIN KICK is added to
//     rotation.z proportional to the impact speed (the §7 "skewing on movement"
//     made physical). When it settles (speed below a floor) it enters RETURN.
//   • RETURN: ease home with a smooth tween (expo-like) plus a small landing
//     DIP (scale squash) — the "glides home ashamed" beat — then back to HELD/
//     idle once the pointer re-engages.
//
// POINTER-RIG CONTRACT:
//   • Pointer signal: userData.pointer {x,y} in 0..1, finite-guarded. Velocity =
//     per-seek pointer delta, dt-normalized from consecutive seek times, smoothed
//     into a DECAYING `lastImpulse` envelope. The harness pins the pointer at the
//     ENGAGED point {0.62,0.5} with REPEATED seeks at the same t: velocity reads
//     ~0 there, but proximity stays inside gripRadius → the HELD pose persists,
//     so the frozen engaged frame is visibly engaged and every control sweep
//     reshapes it. onParamChange re-applies the pose at the last seek state.
//   • Idle t=0 with a DISENGAGED pointer: home pose, fully legible (zero offset,
//     zero tilt). No sampled play frame is empty.
//   • All travel is SUBJECT-RELATIVE: the flight bounds and grip reach are scaled
//     by the subject's measured half-extent (Box3.setFromObject), so the whole
//     motion envelope at default params stays INSIDE the tile frame. No hardcoded
//     world units.
//
// Determinism: integration depends ONLY on seek-time deltas + stored closure
// state (no Math.random, no wall-clock). dt is clamped against huge frame gaps so
// the integrator is stable at every control extreme (no jitter, no explosion).
//
// DISTINCT FROM NEIGHBORS:
//   • `bounce` / `drop-bounce`: TIME-domain entrances (a one-shot eased drop with
//     bounceOut) — no pointer, no release velocity, no wall rebounds, no spin.
//   • `magnetic` / `repel`: CONTINUOUS proportional spring pull/push toward/away
//     from the cursor — the card NEVER leaves the cursor's influence and there is
//     no flight phase at all.
//   • `magnetic-stick`: stick/release with hysteresis, but the release is a spring
//     snap-BACK HOME — there is no ballistic toss, no gravity, no wall bounce, no
//     spin kick. This one GRABS, FLINGS, and lets the card fly free under physics.

import { Box3, Vector3, type Mesh, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Release-velocity gain AND grip reach: a stronger throw whips the card
  // farther toward the cursor while held and launches it harder on release.
  { id: 'power', label: 'Throw power', type: 'knob', min: 0.3, max: 2.5, step: 0.01, default: 1.2, unit: 'x' },
  // Downward pull (subject-relative /s²). Sags the held card and curves the
  // flight arc down. 0 = floaty zero-g toss.
  { id: 'gravity', label: 'Gravity', type: 'fader', min: 0, max: 5, step: 0.05, default: 2.2, unit: 'g' },
  // Wall restitution: fraction of speed kept per bounce (always < 1 so flight
  // decays). 0 = dead thud, ~0.85 = lively rubber-ball rebounds.
  { id: 'bounciness', label: 'Bounciness', type: 'knob', min: 0, max: 0.92, step: 0.01, default: 0.62, unit: 'e' },
  // Air drag: exponential velocity bleed per second. Higher = the toss runs out
  // of steam sooner and floats down.
  { id: 'drag', label: 'Air drag', type: 'knob', min: 0, max: 3, step: 0.01, default: 0.8, unit: '/s' },
] as const;

// Max per-seek dt (s) for integration — guards a huge gap between seeks (scrub,
// tab-away) from blowing the integrator up.
const MAX_DT = 1 / 30;
// Reference frame time the per-frame lerp factors are tuned against.
const REF_DT = 1 / 60;
// Grip proximity radius (in subject half-extents): pointer closer than this to
// the card center = HELD. The pinned engaged point {0.62,0.5} is ~0.12 from
// center (well inside) → the rig's frozen frame shows the HELD pose.
const GRIP_RADIUS = 0.55;
// Fraction of the half-extent the HELD card reaches toward the cursor (×power).
// Modest so the card sits well INSIDE the flight bounds while held — leaving
// headroom for the throw to actually sail before it reaches a wall.
const GRIP_REACH = 0.22;
// Flight bounds as a fraction of the half-extent: the card center may travel
// out to ±BOUND·half before it hits a wall. Chosen so the panel's far edge
// still lands at/inside the tile boundary at the rebound (matches the
// magnetic-stick TRAVEL_FRAC envelope that framed cleanly in the catalog).
const BOUND_FRAC = 0.42;
// Spin imparted per unit of impact speed at a bounce (rad per (units/s)).
const SPIN_PER_IMPACT = 0.16;
// Spin angular-velocity damping (per second), INDEPENDENT of air drag so a
// zero-drag toss still bleeds its bounce spin and can settle (no perpetual
// spinner). Tuned so the spin reads as a lively tumble that calms with the card.
const SPIN_DAMP = 3.5;
// Max held tilt (rad) toward the throw/cursor direction while gripped.
const HELD_TILT_MAX = 0.12;
// Speed (units/s) below which a THROWN card is "settled" → enters RETURN.
const SETTLE_SPEED = 0.08;
// RETURN tween rate (per second, exponential ease toward home).
const RETURN_RATE = 4.5;
// Landing-dip depth (scale squash) at the start of the RETURN glide.
const LAND_DIP = 0.08;
// Landing-dip decay (per second).
const LAND_DECAY = 6;
// HELD spring tracking rate (per second) — a slight lag, not instant.
const HELD_RATE = 12;
// Impulse envelope smoothing rate (per second) — how fast stored release
// velocity charges/decays. Persists at dt=0 (pinned) so a fast move then a pin
// keeps throw energy ready.
const IMPULSE_RATE = 14;
// Held-tilt smoothing rate (per second).
const TILT_RATE = 10;

interface PointerXY {
  x: number;
  y: number;
}

/** Read userData.pointer in 0..1, finite-guarded, defaulting to a DISENGAGED
 *  corner so a missing/garbage pointer reads as "no cursor near" (card at home). */
function readPointer(userData: Record<string, unknown>): PointerXY {
  const p = userData.pointer as Partial<PointerXY> | undefined;
  const x = p && typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0.02;
  const y = p && typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0.98;
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
}

type Phase = 'held' | 'thrown' | 'return';

export const throwPhysicsPrimitive: PrimitiveDefinition = {
  name: 'throw-physics',
  label: 'Throw Physics',
  category: 'pointer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'Grab the card with the cursor and throw it — it sails on real ballistics, bounces off the frame walls, and glides home ashamed.',
  create: defineAnimatable(
    { name: 'throw-physics', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = (target.subject as Mesh) ?? target.object;

      // Home pose snapshot — restored exactly on dispose.
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseZ = subject.position.z;
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;
      const baseRotZ = subject.rotation.z;

      // Subject half-extent (subject-relative framing). Measured once at home,
      // before anything moves — Box3 over the whole subtree so chrome counts.
      const box = new Box3().setFromObject(subject);
      const size = new Vector3();
      box.getSize(size);
      const halfW = Number.isFinite(size.x) && size.x > 1e-3 ? size.x * 0.5 : 0.87;
      const halfH = Number.isFinite(size.y) && size.y > 1e-3 ? size.y * 0.5 : 0.56;
      const halfRef = Math.max(halfW, halfH);
      // Wall positions (offset-from-home), per axis. Center may roam this far.
      const boundX = halfW * BOUND_FRAC;
      const boundY = halfH * BOUND_FRAC;

      // ── Closure state (persists across seeks; dt-normalized) ──
      let phase: Phase = 'held';
      let offX = 0; // offset from home
      let offY = 0;
      let velX = 0; // velocity (units/s) — meaningful in THROWN
      let velY = 0;
      let spin = 0; // rotation.z offset from base
      let spinVel = 0; // spin angular velocity (rad/s), bled in flight
      let tilt = 0; // smoothed held tilt
      let landDip = 0; // landing-squash envelope (RETURN)

      // Pointer tracking for release velocity.
      let prevPX: number | null = null;
      let prevPY: number | null = null;
      let impX = 0; // smoothed pointer velocity envelope (per second, 0..1 space)
      let impY = 0;
      let wasGripped = false; // was the pointer engaged on the previous frame

      let lastSeekT = 0;
      let initialized = false;
      let lastT = 0;

      const apply = (t: number) => {
        // Deterministic dt from consecutive seeks (clamped). dt=0 on the rig's
        // repeated-seek-at-held-t control sweeps — physics holds, but the pose
        // is recomputed from current params so a control tweak reshapes it.
        const dtRaw = initialized ? t - lastSeekT : 0;
        const dt = clamp(Number.isFinite(dtRaw) ? dtRaw : 0, 0, MAX_DT);
        lastSeekT = t;
        lastT = t;
        initialized = true;

        const power = clamp(num(params.power, 1.2), 0.1, 4);
        const grav = clamp(num(params.gravity, 2.2), 0, 12) * halfRef; // subject-relative
        const rest = clamp(num(params.bounciness, 0.62), 0, 0.95);
        const drag = clamp(num(params.drag, 0.8), 0, 6);

        const p = readPointer(target.userData);

        // Pointer velocity (0..1 space) → smoothed, decaying impulse envelope.
        if (dt > 1e-6 && prevPX !== null && prevPY !== null) {
          const vx = (p.x - prevPX) / dt;
          const vy = (p.y - prevPY) / dt;
          const k = 1 - Math.exp(-dt * IMPULSE_RATE);
          impX += (vx - impX) * k;
          impY += (vy - impY) * k;
        }
        // (dt === 0: persist impX/impY untouched so a fast move then a pinned
        //  hold keeps stored throw energy ready.)
        prevPX = p.x;
        prevPY = p.y;

        // Proximity to card center, normalized by half-extent (scale-free).
        const pdx = (p.x - 0.5) * 2 * halfW;
        const pdy = (0.5 - p.y) * 2 * halfH; // screen→world y flip
        const prox = Math.hypot(pdx, pdy) / Math.max(halfRef, 1e-4);
        const gripped = prox < GRIP_RADIUS;

        // ── State transitions ────────────────────────────────────────────────
        if (gripped) {
          // Re-grab from any state: the cursor caught the card again.
          phase = 'held';
        } else if (wasGripped && !gripped && phase === 'held') {
          // RELEASE: the cursor just left the grip zone → THROW with the stored
          // release velocity (the smoothed pointer-velocity envelope, pointer-
          // space → subject-relative world units, y-flipped), scaled by power.
          // The throw momentum comes from the FLICK (impulse envelope), not the
          // held-follow lerp — so the toss direction tracks the cursor's motion.
          phase = 'thrown';
          const launchScale = halfRef * 2.2 * power;
          velX = impX * launchScale;
          velY = -impY * launchScale; // screen→world y flip
        }
        wasGripped = gripped;

        // ── Per-phase integration ────────────────────────────────────────────
        if (phase === 'held') {
          // Spring-follow the cursor offset with a slight lag (HELD_RATE), plus a
          // gravity SAG so the gravity control droops the held pose. Reach scales
          // with power and is clamped to the grip envelope (stays in frame).
          const reach = GRIP_REACH * power;
          const tgtX = clamp(pdx, -halfW, halfW) * reach;
          // sag is a fraction of the held reach proportional to gravity.
          const sag = -(grav / Math.max(halfRef, 1e-4)) * 0.012 * halfH;
          const tgtY = clamp(pdy, -halfH, halfH) * reach + sag;

          // On a dt=0 frame (construction-time apply(0) AND the rig's repeated
          // pinned seeks) snap to the held target ONLY when the cursor is
          // actually gripping — so the engaged pin reads HELD immediately while
          // a DISENGAGED idle pin (prox ≥ grip) leaves the card at home (offset
          // 0). With dt>0 we lerp toward target at HELD_RATE.
          const lerp = dt > 0 ? 1 - Math.exp(-dt * HELD_RATE) : gripped ? 1 : 0;
          const nvx = (tgtX - offX);
          const nvy = (tgtY - offY);
          offX += nvx * lerp;
          offY += nvy * lerp;
          // Track follow velocity (units/s) so a release carries continuous momentum.
          velX = dt > 0 ? (nvx * lerp) / dt : 0;
          velY = dt > 0 ? (nvy * lerp) / dt : 0;

          // Held tilt toward the throw direction (the cursor side), eased. Only
          // a GRIPPED card tilts; a disengaged idle pin holds zero tilt (home).
          const tiltTarget = gripped
            ? clamp(-pdx / Math.max(halfW, 1e-4), -1, 1) * HELD_TILT_MAX
            : 0;
          const tk = dt > 0 ? 1 - Math.exp(-dt * TILT_RATE) : gripped ? 1 : 0;
          tilt += (tiltTarget - tilt) * tk;
          spin = tilt;
          spinVel = 0;
          landDip *= dt > 0 ? Math.exp(-dt * LAND_DECAY) : 1;
        } else if (phase === 'thrown') {
          // Semi-implicit Euler ballistics: gravity + exponential air drag.
          velY -= grav * dt;
          const dragK = Math.exp(-drag * dt);
          velX *= dragK;
          velY *= dragK;
          offX += velX * dt;
          offY += velY * dt;

          // Wall bounces (subject-relative). Reflect velocity, bleed by
          // restitution, clamp back inside, and kick spin by the impact speed.
          if (offX > boundX) {
            offX = boundX;
            const impact = Math.abs(velX);
            velX = -velX * rest;
            spinVel += -SPIN_PER_IMPACT * impact;
          } else if (offX < -boundX) {
            offX = -boundX;
            const impact = Math.abs(velX);
            velX = -velX * rest;
            spinVel += SPIN_PER_IMPACT * impact;
          }
          if (offY > boundY) {
            offY = boundY;
            const impact = Math.abs(velY);
            velY = -velY * rest;
            spinVel += SPIN_PER_IMPACT * impact;
          } else if (offY < -boundY) {
            offY = -boundY;
            const impact = Math.abs(velY);
            velY = -velY * rest;
            spinVel += -SPIN_PER_IMPACT * impact;
          }

          // Spin integrates and bleeds on its OWN damping (so a zero-air-drag
          // toss still calms its bounce spin and can settle — no perpetual spin).
          spin += spinVel * dt;
          spinVel *= Math.exp(-SPIN_DAMP * dt);

          // Settle test: once the toss runs out of LINEAR speed (the card has
          // come to rest against a wall or floated to a stop), glide home. Spin
          // is bleeding on its own and is carried into the RETURN ease, so it
          // does not gate the settle — otherwise a dead-wall hit (velX→0, residual
          // spin) would hang here forever.
          const speed = Math.hypot(velX, velY);
          if (speed < SETTLE_SPEED) {
            phase = 'return';
            landDip = LAND_DIP;
          }
        } else {
          // RETURN: ease offset, spin, and tilt back to home with a landing dip.
          const rk = dt > 0 ? 1 - Math.exp(-dt * RETURN_RATE) : 0;
          offX += (0 - offX) * rk;
          offY += (0 - offY) * rk;
          spin += (0 - spin) * rk;
          velX = 0;
          velY = 0;
          spinVel = 0;
          tilt = spin;
          landDip *= dt > 0 ? Math.exp(-dt * LAND_DECAY) : 1;
          // Snap tiny residuals so the home idle frame is exactly home.
          if (Math.hypot(offX, offY, spin) < 1e-4) {
            offX = 0; offY = 0; spin = 0; landDip = 0;
          }
        }

        // ── Compose the pose (all finite-guarded) ─────────────────────────────
        const fx = Number.isFinite(offX) ? offX : 0;
        const fy = Number.isFinite(offY) ? offY : 0;
        const fr = Number.isFinite(spin) ? spin : 0;
        const dip = Number.isFinite(landDip) ? landDip : 0;
        subject.position.x = baseX + fx;
        subject.position.y = baseY + fy;
        // A whisper of lift while gripped/airborne so the engaged card reads as
        // "off the table"; rests flat at home (disengaged idle → lift 0).
        const lift = (gripped || phase === 'thrown') ? 0.05 * halfH : 0;
        subject.position.z = baseZ + lift * clamp((Math.abs(fx) + Math.abs(fy)) / Math.max(halfRef, 1e-4) + (gripped ? 0.3 : 0), 0, 1);
        subject.rotation.z = baseRotZ + fr;
        // Landing squash: a brief vertical pinch as it touches home.
        const sy = 1 - dip;
        const sx = 1 + dip * 0.5;
        subject.scale.set(
          baseSX * (Number.isFinite(sx) ? sx : 1),
          baseSY * (Number.isFinite(sy) ? sy : 1),
          baseSZ,
        );
      };

      // Deterministic initial state — the rig pins idle at t=0, disengaged, so
      // the card must read fully legible at home on the first frame.
      apply(0);

      return {
        // Stateful pointer effect: tracks the live cursor, never "ends".
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the live time so a paused control tweak (the rig drives one
        // control at a held t) reshapes the frame with no new seek.
        onParamChange: () => apply(lastT),
        dispose: () => {
          subject.position.set(baseX, baseY, baseZ);
          subject.scale.set(baseSX, baseSY, baseSZ);
          subject.rotation.z = baseRotZ;
        },
      };
    },
  ),
};
