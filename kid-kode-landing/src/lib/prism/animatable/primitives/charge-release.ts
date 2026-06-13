// charge-release — hold the cursor close and the card CHARGES: it compresses
// (y squash, x bulge), develops a fine deterministic tremble, and its edges
// heat to brass — break away and the stored energy RELEASES, springing the card
// tall with a crack of light (an expanding ring that fades). POINTER / medium.
//
// TECHNIQUE (DESIGN-REFERENCES §7 "Cursor & Interaction Libraries" — the
// press-and-release energy pattern: Cuberto mouse-follower's proximity-driven
// magnetic snap + Cursify's Springy preset, recast natively as a charge that
// accumulates with cursor proximity and discharges into an overshoot spring on
// break-away). Pointer proximity is the CHARGE RATE; the charge level (a closure
// scalar, 0..1) eases toward proximity dt-normalized while engaged, and releases
// when proximity drops below a threshold.
//
// PHYSICS (deterministic, dt-normalized, critically stable — no Math.random):
//   prox        = clamp(1 - dist(pointer, center)/radius, 0, 1)   engagement
//   charge     += (prox - charge) * (1 - exp(-rate * dt))         exp approach
//   squashY     = 1 - depth * charge        (compress: shorter)
//   bulgeX      = 1 + depth*BULGE * charge   (volume-ish: wider when squashed)
//   tremble     = hash(index, t) * amp,  amp ∝ tremble * charge   micro jitter
//   release fires when prox < threshold while charge > MIN_FIRE; it stores
//   releaseCharge, resets charge to 0, starts a decaying envelope:
//     env(age)  = exp(-age / TAU)        (age = tNow - tFire, age ≥ 0)
//   springY     = 1 + overshoot * releaseCharge * env             (pops TALL)
//   ringT       = age / RING_TIME        (the expanding light ring's progress)
//
// THE PINNED-ENGAGED INVARIANT (POINTER-RIG): the rig pins the pointer at an
// ENGAGED point {0.62,0.5} and re-seeks at the SAME t for control sweeps —
// velocity reads ~0, but charge is an EQUILIBRIUM (it eases toward proximity),
// so a steadily-held engaged cursor parks the card at a visibly CHARGED pose
// (compressed + trembling + edges glowing). onParamChange re-applies the pose at
// the last seek state so compression/tremble/rate sweeps re-shape the frozen
// frame. The idle frame (t=0, pointer disengaged) sits at full home pose.
//
// THE SUBJECT'S LOOK IS SACRED (pointer-shine discipline): the brass edge-heat
// and the release ring are ADDITIVE overlays — under additive blending black
// contributes nothing, so off-charge they are invisible and the subject's own
// pixels are NEVER altered. The subject material is never swapped/mutated; only
// the subject's transform (scale/position) is written, snapshotted + restored in
// dispose alongside removal/disposal of every overlay this primitive created.
//
// DISTINCT from its neighbors:
//  - pointer-press: an INSTANT geometric dent that tracks proximity 1:1 with no
//    energy accumulation and no release — charge-release stores energy over time
//    and discharges it into an overshoot spring + light ring on break-away.
//  - pulse: a time-driven breathing BEAT — charge-release is pointer-gated, has
//    no periodic clock, and only animates when charging or releasing.
//  - click-shockwave (W3 sibling): a detonation that races a TRAVELLING pressure
//    ring across the surface — charge-release has no travelling surface ring; it
//    charges-and-springs the whole card and emits one short fading halo at break.

import {
  AdditiveBlending,
  Box3,
  Color,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  float,
  abs,
  min,
  max,
  smoothstep,
  length,
  sub,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // How fast the charge eases toward the engaged equilibrium (per second).
  { id: 'chargeRate', label: 'Charge rate', type: 'knob', min: 0.2, max: 4, step: 0.05, default: 1.8 },
  // How far the card squashes at full charge (subject-relative scale fraction).
  { id: 'compressionDepth', label: 'Compression', type: 'fader', min: 0.05, max: 0.45, step: 0.01, default: 0.22 },
  // Amplitude of the fine deterministic tremble while charged.
  { id: 'tremble', label: 'Tremble', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.45 },
  // How tall the release spring overshoots past rest (scale fraction).
  { id: 'overshoot', label: 'Release pop', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.3 },
] as const;

const EDGE_OVERLAY = 'charge-release-edge';
const RING_OVERLAY = 'charge-release-ring';

// Brass edge-heat tint (Observatory-Brass / warm graphite world — no purple).
const EDGE_COLOR = '#f1c878';
const RING_COLOR = '#ffe6b0';

// Engagement falloff radius in normalized pointer space (diagonal max ~0.707).
const ENGAGE_RADIUS = 0.42;
// Drop below this proximity while charged -> RELEASE.
const RELEASE_THRESHOLD = 0.18;
// Minimum stored charge worth releasing (avoids spurious tiny pops).
const MIN_FIRE = 0.12;
// Release-envelope time constant + visible ring lifetime (seconds).
const RELEASE_TAU = 0.13; // exp decay τ → ~0.4s to fall to <5%
const RING_TIME = 0.4;
// Bulge gain: how much the card widens (x) per unit of y-squash (sub-volume).
const BULGE = 0.55;
// Tremble base amplitude in subject-relative units at tremble=1, charge=1.
const TREMBLE_BASE = 0.02;
// Tremble temporal frequency (rad/s) — fast, fine shiver.
const TREMBLE_FREQ = 47;

interface PointerXY {
  x: number;
  y: number;
}

/** Read the host pointer in 0..1 space; non-finite-guarded, defaults to a
 *  DISENGAGED corner so the idle frame rests at home pose. */
function readPointer(userData: Record<string, unknown>): PointerXY {
  const p = userData.pointer as Partial<PointerXY> | undefined;
  const x = p && typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 1;
  const y = p && typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 1;
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
}

/** Deterministic [-1,1] hash from an integer seed + continuous phase. Used for
 *  the tremble micro-offsets — index/time-hashed, never Math.random. */
function hash11(seed: number, phase: number): number {
  // Two incommensurate sines keyed off the seed give a non-repeating wobble
  // that is fully reproducible for a given (seed, phase).
  const a = Math.sin(seed * 12.9898 + phase * TREMBLE_FREQ);
  const b = Math.sin(seed * 78.233 + phase * TREMBLE_FREQ * 0.61);
  return clamp((a + b) * 0.5, -1, 1);
}

export const chargeReleasePrimitive: PrimitiveDefinition = {
  name: 'charge-release',
  label: 'Charge & Release',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'Hold the cursor close and the card charges — compressing, trembling, edges heating brass — break away and it releases, springing tall with a crack of light.',
  create: defineAnimatable(
    { name: 'charge-release', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D | null = target.subject ?? null;
      const xform: Object3D = subject ?? target.object;

      // ── Home-pose snapshot (restored verbatim in dispose) ──────────────
      const home = {
        sx: xform.scale.x,
        sy: xform.scale.y,
        sz: xform.scale.z,
        px: xform.position.x,
        py: xform.position.y,
      };

      // Subject-relative half-span: the tremble travel scales by it so the whole
      // envelope stays inside the tile regardless of mounted-artifact size.
      let halfSpan = 0.9;
      if (subject) {
        subject.updateWorldMatrix(true, true);
        const box = new Box3().setFromObject(subject);
        if (!box.isEmpty()) {
          const size = box.getSize(new Vector3());
          halfSpan = Math.max(size.x, size.y) * 0.5 || 0.9;
        }
      }

      // ── State (closure) ────────────────────────────────────────────────
      let charge = 0; // 0..1 accumulated energy while engaged
      let lastT = 0; // last seek time (for dt + onParamChange re-apply)
      let initialized = false; // first seek pins dt to 0
      let releaseCharge = 0; // energy snapshot at the last break-away
      let fireT = -1; // seek time of the last release (-1 = none live)

      // ── Additive overlays — the subject's own pixels are never touched ──
      // (1) brass edge-heat: a rim that brightens with charge.
      const uCharge = uniform(0);
      const uEdgeColor = uniform(new Color(EDGE_COLOR));
      const u = uv();
      // Distance to the nearest border, 0..0.5; rim mask brightens toward edges.
      const edgeDist = min(u.x, min(float(1).sub(u.x), min(u.y, float(1).sub(u.y))));
      const rim = sub(float(1), smoothstep(float(0), float(0.16), edgeDist)) as unknown as {
        mul: (a: unknown) => unknown;
      };
      // Edge-heat color: black (invisible) at charge 0, brass rim at full charge.
      const edgeColorNode = (uEdgeColor as unknown as { mul: (a: unknown) => unknown }).mul(
        rim.mul(uCharge),
      );

      const edgeMat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      (edgeMat as unknown as { colorNode: unknown }).colorNode = edgeColorNode;

      // (2) release ring: an expanding annulus that fades over RING_TIME.
      const uRingT = uniform(0); // 0..1 progress; >1 = dead (invisible)
      const uRingColor = uniform(new Color(RING_COLOR));
      const ur = uv();
      const ringDist = length(vec2(ur.x.sub(0.5), ur.y.sub(0.5))).mul(2); // 0 center → ~1 edge
      // The ring radius marches outward with uRingT; a thin gaussian-ish band.
      const ringRadius = uRingT.mul(0.95);
      const band = sub(float(1), smoothstep(float(0), float(0.16), abs(ringDist.sub(ringRadius))));
      // Fade the whole ring out as it travels (1 at birth → 0 at the rim).
      const ringFade = max(float(0), sub(float(1), uRingT));
      const ringColorNode = (uRingColor as unknown as { mul: (a: unknown) => unknown }).mul(
        (band as unknown as { mul: (a: unknown) => unknown }).mul(ringFade),
      );

      const ringMat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      (ringMat as unknown as { colorNode: unknown }).colorNode = ringColorNode;

      // ── Overlay meshes: fit to the subject (Mesh: reuse geom; Group: quad) ─
      let edgeMesh: Mesh | null = null;
      let ringMesh: Mesh | null = null;
      let ownedGeometry: BufferGeometry | null = null;

      if (subject && (subject as Mesh).isMesh) {
        const sm = subject as Mesh;
        edgeMesh = new Mesh(sm.geometry, edgeMat);
        ringMesh = new Mesh(sm.geometry, ringMat);
        edgeMesh.renderOrder = (sm.renderOrder ?? 0) + 1;
        ringMesh.renderOrder = (sm.renderOrder ?? 0) + 2;
      } else if (subject) {
        // Group subject (e.g. MSDF text-object): a quad fitted to the measured
        // bbox in the subject's LOCAL frame so it co-moves with no double xform.
        subject.updateWorldMatrix(true, true);
        const worldBox = new Box3().setFromObject(subject);
        if (!worldBox.isEmpty()) {
          const inv = new Matrix4().copy(subject.matrixWorld).invert();
          const localBox = worldBox.clone().applyMatrix4(inv);
          const size = localBox.getSize(new Vector3());
          const center = localBox.getCenter(new Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const w = Math.max(size.x, maxDim * 1e-3);
          const h = Math.max(size.y, maxDim * 1e-3);
          ownedGeometry = new PlaneGeometry(w, h);
          edgeMesh = new Mesh(ownedGeometry, edgeMat);
          ringMesh = new Mesh(ownedGeometry, ringMat);
          for (const m of [edgeMesh, ringMesh]) {
            m.position.copy(center);
            m.position.z = localBox.max.z + maxDim * 0.02;
          }
          edgeMesh.renderOrder = (subject.renderOrder ?? 0) + 1;
          ringMesh.renderOrder = (subject.renderOrder ?? 0) + 2;
        }
      }

      if (subject && edgeMesh) edgeMesh.name = EDGE_OVERLAY;
      if (subject && ringMesh) ringMesh.name = RING_OVERLAY;
      if (subject && edgeMesh) subject.add(edgeMesh);
      // The ring is born invisible (uRingT high) and only mounts on release —
      // but we add it upfront and gate visibility via the dead-progress fade so
      // there is exactly one owned resource lifecycle to manage.
      if (subject && ringMesh) {
        ringMesh.visible = false;
        subject.add(ringMesh);
      }

      // Expose live handles for the host/driver + CPU tests (no GPU needed).
      const trembleAmp = uniform(0);
      target.userData.chargeReleaseUniforms = {
        uCharge,
        uEdgeColor,
        uRingT,
        trembleAmp,
      };

      /** Apply the full pose at seek time `t` for the live pointer + params. */
      const apply = (t: number) => {
        // dt-normalized integration; first seek pins dt to 0 (no jump), and a
        // backwards/huge dt is clamped so the spring can never explode.
        const rawDt = initialized ? t - lastT : 0;
        const dt = clamp(rawDt, 0, 0.1);
        lastT = t;
        initialized = true;

        const p = readPointer(target.userData);
        const dist = Math.hypot(p.x - 0.5, p.y - 0.5);
        const prox = clamp(1 - dist / ENGAGE_RADIUS, 0, 1);

        const rate = clamp(num(params.chargeRate, 1.8), 0.2, 4);
        const depth = clamp(num(params.compressionDepth, 0.22), 0.05, 0.45);
        const trembleK = clamp(num(params.tremble, 0.45), 0, 1);
        const overshoot = clamp(num(params.overshoot, 0.3), 0, 0.6);

        // ── Charge integration: ease toward the engaged equilibrium `prox`.
        // Exponential approach is critically stable for any dt ≥ 0 and any rate
        // (the factor lives in [0,1]) — no jitter, no overshoot in the charge.
        const k = 1 - Math.exp(-rate * dt);
        if (prox >= RELEASE_THRESHOLD) {
          charge += (prox - charge) * k;
        } else {
          // Below threshold: RELEASE meaningful stored charge — the energy
          // transfers fully into the spring, so charge snaps to 0 (the squash
          // releases at once and the overshoot pop is unopposed).
          if (charge > MIN_FIRE && (fireT < 0 || t - fireT > RING_TIME)) {
            releaseCharge = charge;
            fireT = t;
            charge = 0;
          } else {
            charge += (0 - charge) * k; // bleed sub-fire residual to 0
          }
        }
        charge = clamp(charge, 0, 1);

        // ── Release envelope (decaying; 0 when no release is live) ─────────
        let env = 0;
        let ringProg = 2; // ≥1 = dead/invisible
        if (fireT >= 0) {
          const age = t - fireT;
          if (age >= 0 && age <= RING_TIME * 1.5) {
            env = Math.exp(-age / RELEASE_TAU);
            ringProg = age / RING_TIME;
          } else {
            fireT = -1;
            releaseCharge = 0;
          }
        }

        // ── Compose the transform ──────────────────────────────────────────
        // Compression while charged: y squashes, x bulges to conserve a little
        // visual volume. Release spring pops y TALL above rest, riding env.
        const squashY = 1 - depth * charge;
        const bulgeX = 1 + depth * BULGE * charge;
        const springY = 1 + overshoot * releaseCharge * env;
        const springX = 1 - overshoot * 0.4 * releaseCharge * env; // thin as it leaps

        // Deterministic tremble: fine micro-offset, amplitude ∝ charge. Indexed
        // by two fixed seeds (x/y lanes) so it shivers without translating away.
        const amp = TREMBLE_BASE * halfSpan * trembleK * charge;
        trembleAmp.value = amp;
        const tx = hash11(1, t) * amp;
        const ty = hash11(7, t) * amp;

        xform.scale.set(home.sx * bulgeX * springX, home.sy * squashY * springY, home.sz);
        xform.position.set(home.px + tx, home.py + ty, xform.position.z);

        // ── Drive the overlays ──────────────────────────────────────────────
        uCharge.value = charge;
        uRingT.value = ringProg;
        if (ringMesh) ringMesh.visible = ringProg < 1;
      };

      return {
        // Stateful / pointer-driven: charges + releases off the live pointer.
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the last seek state so a control tweak re-shapes the
        // (possibly pinned-engaged) frozen frame with no rebuild.
        onParamChange: (_id: string, _value: ControlValue) => apply(lastT),
        dispose: () => {
          // Restore the subject's transform verbatim.
          xform.scale.set(home.sx, home.sy, home.sz);
          xform.position.x = home.px;
          xform.position.y = home.py;
          // Remove + dispose ONLY what this primitive created. The subject's own
          // material/geometry are never touched (Mesh overlays share the
          // subject geometry BY REFERENCE — never disposed here).
          edgeMesh?.parent?.remove(edgeMesh);
          ringMesh?.parent?.remove(ringMesh);
          edgeMesh = null;
          ringMesh = null;
          ownedGeometry?.dispose();
          ownedGeometry = null;
          edgeMat.dispose();
          ringMat.dispose();
        },
      };
    },
  ),
};
