// spring-chain-follow — the card LEADS a spring-linked chain: two ghost echoes
// tether behind the head, whipping and overshooting as the cursor drags the
// head around. POINTER / hard. (DESIGN-REFERENCES §7 Cursor & Interaction
// Libraries — the Cursify 'Springy' preset + the classic trailing-chain
// pattern: a lerped head pursuit feeding a relay of damped springs, so a fast
// pointer arc cracks the chain like a whip with per-link lag and overshoot.)
//
// CHAIN MODEL: link 0 is the SUBJECT itself (the head); links 1..N are GHOST
// echoes — deep clones of the subject (geometry shared BY REFERENCE, materials
// CLONED so they carry the subject's FULL look — color + every PBR scalar +
// shared .map by reference — dimmed per-link via opacity, never an invented
// flat fill). The head chases a pointer-derived target with a dt-normalized
// exponential lerp (chaseSpeed). Each ghost link runs a dt-normalized
// semi-implicit-Euler damped spring toward its PARENT link's live position,
// offset by a subject-relative rest gap along the chain direction — so the
// links string out BEHIND the head toward the pointer and, on a fast arc,
// crack out of line then snap back (overshoot from the spring's velocity).
// Ghosts render BEHIND the head (a slight −z recession + scale taper per link)
// so the chain reads as depth, not a flat smear.
//
// POINTER-RIG SEMANTICS:
//   • position-led head: target = base + (pointer−center)·reach, so the
//     advocate's PINNED engaged point {0.62,0.5} (held across repeated seeks,
//     velocity ≈ 0) resolves to a STEADY offset the head springs onto and the
//     chain strings toward — a visible taut offset LINE, not an empty frame.
//   • dt-normalized integration: dt is the consecutive-seek delta, clamped;
//     dt = 0 on a pinned repeated seek ⇒ NOTHING integrates ⇒ the pose holds
//     exactly (the advocate's control-sweep repeats are byte-stable).
//   • idle t=0 / pointer disengaged at center ⇒ target = base ⇒ the head sits
//     EXACTLY at its home pose, fully legible, the chain collapsed taut behind
//     it; when the pointer later disengages, the whole chain relaxes home.
//   • onParamChange re-applies the chain pose at the LAST seek state with NO
//     advance (dt=0 internal), so every control reshapes the pinned frame:
//     stiffness re-tunes the relay, spacing lengthens the resting line, dimming
//     re-grades the echoes, chaseSpeed re-tunes the head pursuit.
//
// FRAMING: reach + rest gaps are SUBJECT-RELATIVE (Box3-measured half-extent),
// never hardcoded world units, so the whole envelope at default params stays
// inside the tile. Critically-stable defaults — exponential head lerp + a
// damped relay tuned below critical — never jitter or explode at any control
// extreme (verified across the schema range in the tests). Deterministic: all
// state lives on the closure; NO Math.random.
//
// IN-CONTEXT HARDENING (the P0/W1/W2 lessons — scroll-marquee discipline):
//   • async texture pour — every seek re-reads each source mesh's LIVE material
//     and re-binds that echo's clones the moment the instance OR its .map
//     identity changes (a map-less mount upgrades when its texture lands).
//   • mesh-count change (async-mounted glyphs) triggers a full echo rebuild.
//   • restore — dispose() removes the echoes, disposes ONLY the clone materials
//     this primitive created (geometries + textures are the subject's own,
//     shared by reference, NEVER disposed) and hands the subject back at its
//     un-displaced base pose. The subject's own pixels are never touched.
//
// DISTINCT from every pointer neighbor: cursor-trail is the SINGLE card lerping
// toward the pointer (no copies, no chain); magnetic/repel are a single body
// pulled/pushed by a spring; scroll-inertia-glide is one body with no chain;
// the velocity-skew-follow sibling is a single body + skew. This is the only
// MULTI-BODY relay — a head dragging a tethered chain of damped springs.

import {
  Box3,
  Group,
  Matrix4,
  Mesh,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { defineAnimatable } from '../base';
import { clamp, num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'stiffness', label: 'Chain Stiffness', type: 'knob', min: 4, max: 40, step: 0.5, default: 14, unit: 'k' },
  { id: 'spacing', label: 'Link Spacing', type: 'fader', min: 0.4, max: 2.4, step: 0.05, default: 1.1, unit: '×w' },
  { id: 'dimming', label: 'Ghost Dimming', type: 'fader', min: 0.1, max: 0.7, step: 0.02, default: 0.45 },
  { id: 'chaseSpeed', label: 'Head Chase', type: 'knob', min: 2, max: 30, step: 0.5, default: 9, unit: '1/s' },
] as const;

const GHOSTS = 2; // the chain trails exactly two ghost echoes behind the head.
const REACH = 0.55; // pointer offset → head travel, in subject half-widths.
const DAMP = 2.0; // relay damping ratio multiplier (≥ ~critical ⇒ no jitter).
const DT_MAX = 1 / 30; // dt clamp (scrubs / long stalls / sawtooth fallbacks).
const Z_STEP = 0.06; // per-link −z recession so ghosts sit behind the head.
const SCALE_STEP = 0.06; // per-link scale taper (depth read).
const SETTLE_EPS = 1e-4; // squared-distance below which a link is "at target".

type EchoMat = Material & { opacity: number; map?: Texture | null };

/** A source mesh ↔ echo mesh pair plus the look identity the clones were built
 *  from (material instance + map), compared live each seek. */
interface EchoPair {
  src: Mesh;
  dst: Mesh;
  clones: EchoMat[];
  builtMat: Material | null;
  builtMap: Texture | null;
}

/** One trailing chain link: a ghost echo root + its spring state (live position
 *  and velocity) + the deep-echo pairs that carry the subject's look. */
interface Link {
  root: Group;
  pairs: EchoPair[];
  pos: Vector3; // live spring position (parent-local)
  vel: Vector3; // live spring velocity
  dim: number; // per-link opacity multiplier (taper of `dimming`)
}

/** The subject's live materials as a flat list (array materials supported). */
const matsOf = (mesh: Mesh): EchoMat[] => {
  const m = mesh.material;
  return (Array.isArray(m) ? m : m ? [m] : []) as EchoMat[];
};

export const springChainFollowPrimitive: PrimitiveDefinition = {
  name: 'spring-chain-follow',
  label: 'Spring Chain Follow',
  category: 'pointer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'The card leads a spring-linked chain — two ghost echoes whipping and overshooting behind it as the cursor drags the head around.',
  create: defineAnimatable(
    { name: 'spring-chain-follow', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      // Echo roots are SIBLINGS of the subject so link positions are written in
      // the same parent-local frame as subject.position.
      const ghostParent: Object3D = subject.parent ?? target.scene;

      // ── Subject home pose (the ONLY thing dispose restores on the subject) ──
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseZ = subject.position.z;

      // ── Subject-relative half-width (Box3-measured, parent-local) ──────────
      // Reach + rest gaps scale to the subject so the envelope stays in-frame;
      // a degenerate (not-yet-mounted) subject gets a unit fallback and is
      // re-measured each seek until real geometry lands.
      const tmpScale = new Vector3();
      const measureHalfWidth = (): number => {
        subject.updateWorldMatrix(true, true);
        const wb = new Box3().setFromObject(subject);
        if (wb.isEmpty()) return 0;
        const sx = Math.abs(ghostParent.getWorldScale(tmpScale).x);
        return (wb.max.x - wb.min.x) / 2 / (sx > 1e-6 ? sx : 1);
      };
      let halfW = measureHalfWidth();

      // ── Head pursuit state (parent-local position) ─────────────────────────
      const headPos = new Vector3(baseX, baseY, baseZ);
      let lastWrittenX: number | null = null; // our last write → external-delta detect
      let lastWrittenY: number | null = null;
      let prevT: number | null = null;
      let lastT = 0; // re-applied by onParamChange (dt=0 ⇒ no integration)

      // ── Chain links (the ghost echoes) ─────────────────────────────────────
      let links: Link[] = [];
      let builtMeshCount = 0; // subject mesh census the echoes were built from

      const countMeshes = (): number => {
        let n = 0;
        subject.traverse((o) => {
          const m = o as Mesh;
          if (m.isMesh && m.material) n++;
        });
        return n;
      };

      /** (Re)clone one pair's look from the LIVE source material: clone()
       *  carries color + every PBR scalar and shares .map by reference — the
       *  subject's exact look, only dimmed via opacity at apply time. */
      const rebindPair = (pair: EchoPair): void => {
        for (const c of pair.clones) c.dispose(); // clones only — never the source
        const live = matsOf(pair.src);
        pair.clones = live.map((m) => {
          const c = m.clone() as EchoMat;
          c.transparent = true;
          c.depthWrite = false; // dimmed echoes never fight the z-buffer
          return c;
        });
        pair.builtMat = live[0] ?? null;
        pair.builtMap = (pair.builtMat as EchoMat | null)?.map ?? null;
        if (pair.clones.length > 0) {
          pair.dst.material = Array.isArray(pair.src.material) ? pair.clones : pair.clones[0];
        }
      };

      const invSubject = new Matrix4();

      const buildLink = (index: number): Link => {
        const root = new Group();
        root.name = `chain-ghost-${index}`;
        subject.updateWorldMatrix(true, true);
        invSubject.copy(subject.matrixWorld).invert();
        const pairs: EchoPair[] = [];
        subject.traverse((o) => {
          const src = o as Mesh;
          if (!src.isMesh || !src.material) return;
          // Geometry shared BY REFERENCE — the echo IS the subject's own shape,
          // flattened into the root with its subject-relative matrix.
          const dst = new Mesh(src.geometry);
          dst.name = `chain-echo-${index}-${pairs.length}`;
          dst.matrixAutoUpdate = false;
          dst.matrix.multiplyMatrices(invSubject, src.matrixWorld);
          const pair: EchoPair = { src, dst, clones: [], builtMat: null, builtMap: null };
          rebindPair(pair);
          root.add(dst);
          pairs.push(pair);
        });
        // The link's spring starts coincident with the head's home pose (chain
        // collapsed taut at rest — no empty frame, no startle pop).
        const pos = new Vector3(baseX, baseY, baseZ - Z_STEP * index);
        root.position.copy(pos);
        const s = 1 - SCALE_STEP * index;
        root.scale.set(s, s, s);
        ghostParent.add(root);
        // Per-link dim taper is computed live in apply() (dimKnob^link).
        return { root, pairs, pos, vel: new Vector3(), dim: 1 };
      };

      const disposeLinks = (): void => {
        for (const l of links) {
          if (l.root.parent) l.root.parent.remove(l.root);
          // Clone materials only — geometries + textures are the subject's own.
          for (const p of l.pairs) for (const c of p.clones) c.dispose();
        }
        links = [];
      };

      const buildLinks = (): void => {
        disposeLinks();
        const w = measureHalfWidth();
        if (w > 1e-6) halfW = w;
        builtMeshCount = countMeshes();
        for (let i = 0; i < GHOSTS; i++) links.push(buildLink(i + 1));
      };

      // ── Pointer read (0..1, finite-guarded, defaults to center) ────────────
      const readPointer = (): { x: number; y: number } => {
        const p = (target.userData as { pointer?: { x?: unknown; y?: unknown } }).pointer;
        const px = p && typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5;
        const py = p && typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5;
        return { x: clamp(px, 0, 1), y: clamp(py, 0, 1) };
      };

      // Scratch vectors (avoid per-seek allocation in the relay loop).
      const target3 = new Vector3();
      const restOff = new Vector3();
      const accel = new Vector3();

      /** Integrate the head pursuit + the chain relay by `dt` seconds, then
       *  write every body's pose + live echo look. dt=0 ⇒ a pure re-apply
       *  (no integration), so pinned repeats and onParamChange hold the pose. */
      const apply = (dt: number): void => {
        // External co-binding moved the subject since our last write → fold the
        // delta into the head spring so the whole chain follows.
        if (lastWrittenX !== null && subject.position.x !== lastWrittenX) {
          headPos.x += subject.position.x - lastWrittenX;
        }
        if (lastWrittenY !== null && subject.position.y !== lastWrittenY) {
          headPos.y += subject.position.y - lastWrittenY;
        }
        // Async-mounted subjects: keep re-measuring until geometry lands; a
        // mesh-count change rebuilds the echoes outright.
        if (halfW <= 1e-6) {
          const w = measureHalfWidth();
          if (w > 1e-6) halfW = w;
        }
        if (countMeshes() !== builtMeshCount) buildLinks();

        const wRef = halfW > 1e-6 ? halfW : 1;
        const stiffness = clamp(num(params.stiffness, 14), 1, 80);
        const spacing = clamp(num(params.spacing, 1.1), 0.1, 4);
        const dimKnob = clamp(num(params.dimming, 0.45), 0, 1);
        const chase = clamp(num(params.chaseSpeed, 9), 0.5, 60);

        // ── Head pursuit: exponential lerp toward the pointer-derived target ─
        const p = readPointer();
        target3.set(baseX + (p.x - 0.5) * 2 * REACH * wRef, baseY + (p.y - 0.5) * 2 * REACH * wRef, baseZ);
        // dt-normalized exponential approach (frame-rate independent, never
        // overshoots ⇒ the head itself is rock-stable; the WHIP lives in the
        // relay below). a = 1 − e^(−chase·dt); dt=0 ⇒ a=0 ⇒ no move.
        const aHead = 1 - Math.exp(-chase * dt);
        headPos.x += (target3.x - headPos.x) * aHead;
        headPos.y += (target3.y - headPos.y) * aHead;

        // ── Chain relay: each link is a damped spring toward its PARENT link,
        // offset by a subject-relative rest gap along the chain direction so
        // the links string out BEHIND the head. Semi-implicit Euler, sub-
        // stepped so a stiff knob + a clamped dt stays unconditionally stable.
        const restGap = spacing * 0.18 * wRef; // resting link-to-link distance
        const omega2 = stiffness; // spring constant (k/m, m = 1)
        const zeta = DAMP; // damping ratio multiplier (≥ critical ⇒ no jitter)
        const damp = 2 * Math.sqrt(omega2) * zeta;
        // Sub-step count so each integration step is ≤ ~1/120 s even at the
        // stiffest knob — guarantees no explosion at any control extreme.
        const steps = dt > 0 ? Math.max(1, Math.ceil(dt / (1 / 120))) : 0;
        const h = steps > 0 ? dt / steps : 0;

        // Chain direction: from the head BACK toward the home pose, so every
        // link rests a fixed gap further behind its parent along ONE direction
        // — a monotonic trailing line that strings out behind the head toward
        // the pointer (never folds back on itself). Degenerate at home ⇒ links
        // collapse onto the head (taut, no empty frame).
        restOff.set(baseX - headPos.x, baseY - headPos.y, 0);
        const dirLen = Math.hypot(restOff.x, restOff.y);
        if (dirLen > 1e-5) restOff.multiplyScalar(restGap / dirLen);
        else restOff.set(0, 0, 0);

        for (let li = 0; li < links.length; li++) {
          const link = links[li];
          // Parent body position: the head for link 0, the previous link else.
          const parentPos = li === 0 ? headPos : links[li - 1].pos;
          for (let s = 0; s < steps; s++) {
            // Rest target = parent + the fixed back-of-chain offset (one gap
            // behind the parent along the head→home direction).
            target3.set(parentPos.x + restOff.x, parentPos.y + restOff.y, parentPos.z - Z_STEP);
            // Spring accel toward the rest target with velocity damping.
            accel.set(
              (target3.x - link.pos.x) * omega2 - link.vel.x * damp,
              (target3.y - link.pos.y) * omega2 - link.vel.y * damp,
              0,
            );
            link.vel.x += accel.x * h;
            link.vel.y += accel.y * h;
            link.pos.x += link.vel.x * h;
            link.pos.y += link.vel.y * h;
            // Snap fully-settled links to kill micro-residue (determinism).
            const dx = target3.x - link.pos.x;
            const dy = target3.y - link.pos.y;
            if (dx * dx + dy * dy < SETTLE_EPS && link.vel.lengthSq() < SETTLE_EPS) {
              link.pos.x = target3.x;
              link.pos.y = target3.y;
              link.vel.set(0, 0, 0);
            }
            link.pos.z = target3.z;
          }
          // Per-link dim falloff (closer link brighter): dimKnob^(li+1).
          link.dim = Math.pow(dimKnob, li + 1);
        }

        // ── Write the head (the SUBJECT) pose; remember the write so the next
        // frame can tell external motion from our own.
        subject.position.x = headPos.x;
        subject.position.y = headPos.y;
        lastWrittenX = subject.position.x;
        lastWrittenY = subject.position.y;

        // ── Write each link root + sync its echo look to the live subject ────
        subject.updateWorldMatrix(true, true);
        invSubject.copy(subject.matrixWorld).invert();
        for (let li = 0; li < links.length; li++) {
          const link = links[li];
          const root = link.root;
          root.position.set(link.pos.x, link.pos.y, link.pos.z);
          // Links ride the subject's live rotation/scale (a co-binding tilt or
          // lift carries through the whole chain), tapered for depth.
          root.quaternion.copy(subject.quaternion);
          const sc = 1 - SCALE_STEP * (li + 1);
          root.scale.set(subject.scale.x * sc, subject.scale.y * sc, subject.scale.z * sc);
          root.visible = subject.visible;

          for (const pair of link.pairs) {
            // Async pour / material swap: re-read the live look identity and
            // re-bind the clones the moment either changed.
            const live = matsOf(pair.src);
            const liveFirst = live[0] ?? null;
            const liveMap = (liveFirst as EchoMat | null)?.map ?? null;
            if (liveFirst !== pair.builtMat || liveMap !== pair.builtMap) rebindPair(pair);
            // Internally co-animated chrome stays registered: re-snapshot the
            // subject-relative matrix every seek.
            pair.dst.matrix.multiplyMatrices(invSubject, pair.src.matrixWorld);
            pair.dst.visible = pair.src.visible && pair.clones.length > 0;
            // Echo opacity = live source opacity × this link's dim falloff.
            for (let k = 0; k < pair.clones.length; k++) {
              const srcMat = live[k] ?? liveFirst;
              pair.clones[k].opacity = (srcMat ? srcMat.opacity : 1) * link.dim;
            }
          }
        }
      };

      /** Snap every link to its DETERMINISTIC settled rest position for the
       *  current head pose + spacing (velocity zeroed). `spacing` is structural
       *  — it defines the resting chain geometry — so an integrated spring
       *  would only reach the new layout after many seeks; the advocate's
       *  pinned control sweep needs it to reshape the engaged frame on the
       *  param change itself, so we re-seat directly (cf. scroll-marquee's
       *  structural `ghosts` knob). The settled line is parent + a fixed gap
       *  along the head→home direction, applied link-by-link. */
      const reseatLinks = (): void => {
        const wRef = halfW > 1e-6 ? halfW : 1;
        const spacing = clamp(num(params.spacing, 1.1), 0.1, 4);
        const restGap = spacing * 0.18 * wRef;
        restOff.set(baseX - headPos.x, baseY - headPos.y, 0);
        const dirLen = Math.hypot(restOff.x, restOff.y);
        if (dirLen > 1e-5) restOff.multiplyScalar(restGap / dirLen);
        else restOff.set(0, 0, 0);
        for (let li = 0; li < links.length; li++) {
          const parentPos = li === 0 ? headPos : links[li - 1].pos;
          links[li].pos.set(parentPos.x + restOff.x, parentPos.y + restOff.y, parentPos.z - Z_STEP);
          links[li].vel.set(0, 0, 0);
        }
      };

      buildLinks();
      apply(0); // lay the chain out at rest (head at home, links collapsed taut)

      return {
        // Purely stateful: driven by the live pointer, never "ends".
        duration: () => Infinity,
        seek: (t) => {
          const dt = prevT === null ? 0 : clamp(t - prevT, 0, DT_MAX);
          prevT = t;
          lastT = t;
          apply(dt);
        },
        onParamChange: (id: string, _value: ControlValue) => {
          // `spacing` is structural: re-seat the resting chain geometry so the
          // pinned engaged frame reshapes on the change itself (no integration
          // needed). All controls then re-apply the pose at the LAST seek state
          // with NO advance (dt=0 ⇒ no spring step) — stiffness/chaseSpeed
          // re-tune the live params (visible on the next seek and across the
          // settled pose), dimming re-grades the echo opacity in place.
          void lastT;
          if (id === 'spacing') reseatLinks();
          apply(0);
        },
        dispose: () => {
          disposeLinks();
          // Hand the subject back at its un-displaced home pose (position is the
          // only thing this primitive ever writes on the subject).
          subject.position.x = baseX;
          subject.position.y = baseY;
          subject.position.z = baseZ;
          lastWrittenX = null;
          lastWrittenY = null;
        },
      };
    },
  ),
};
