// scroll-marquee — the card becomes an endless belt: ghost echoes of the
// subject trail it in a lateral marquee whose drift is steered by the scroll.
// (DESIGN-REFERENCES §6 Advanced Scroll Engines — the Awwwards
// velocity-reactive infinite-strip staple: Lenis/Locomotive scroll progress
// drives a wrapping horizontal strip, the lerp/inertia feel carried here as a
// persisted impulse envelope.)
//
// BELT MODEL: the subject itself is member 0 of an N-member belt
// (N = ghosts + 1); each ghost is a deep ECHO of the subject — its real
// meshes with geometry shared by reference and materials CLONED carrying the
// subject's FULL look (shared .map by reference + color/PBR scalars), dimmed
// via opacity, never invented flat fills. Members sit slotSpan apart
// (slotSpan = measured subject width × (1 + gap) — Box3-measured, SUBJECT-
// RELATIVE, never hardcoded world units); the belt offset advances with
// scroll position plus the persisted velocity impulse, and every member's x
// wraps modulo the belt length, centered on the subject's base x, so the
// strip reads infinite in BOTH directions — a member exiting one side of the
// tile re-enters the other. Vertically nothing moves (the belt stays inside
// the tile frame); the horizontal wrap is the point.
//
// SCROLL-RIG SEMANTICS:
//   • position-led: offset = ±(scroll·DRIFT_TURNS + boost·BOOST_TURNS)·L, so
//     the advocate's PINNED control sweeps (repeated seeks at one t, velocity
//     ≈ 0) hold an engaged mid-belt pose that EVERY control reshapes — gap
//     and ghosts change the belt geometry, dim re-grades the echoes, and
//     reverse flips the offset sign (DRIFT_TURNS is 0.75, not 1.0, precisely
//     so ±offset are DISTINCT poses at scroll=0.5 rather than the same point
//     half a belt apart).
//   • velocity impulse: the per-seek scroll delta (clamped — the tile's
//     sawtooth time-fallback wrap must not spike it) accumulates into a
//     persisted `boost` envelope that decays dt-normalized (dt from
//     consecutive seek times, clamped; dt = 0 on pinned repeated seeks ⇒ the
//     envelope freezes, no drain) — fast scrolling slings the belt ahead of
//     its position pose and it eases back when scroll rests: the Lenis
//     inertia feel, derived as blend(position, lastImpulse).
//   • idle t=0 / scroll=0 ⇒ offset 0 ⇒ the subject sits EXACTLY at its base
//     pose, fully legible, ghosts flanking at ±slotSpan; members are never
//     more than one gap (≤ 1 × subject width) apart edge-to-edge, so no
//     sampled frame is ever empty.
//
// IN-CONTEXT HARDENING (the P0/W1 lessons):
//   • async texture pour — every seek re-reads each source mesh's LIVE
//     material; when the instance OR its .map identity changed, that echo's
//     clones rebuild from the live look (a map-less mount upgrades the moment
//     its texture lands; material swaps re-bind). A subject whose mesh COUNT
//     changes (async-mounted glyphs) triggers a full echo rebuild.
//   • live pose sync — each seek re-bases the subject's x when a co-binding
//     moved it (the external delta folds into baseX so the whole belt
//     follows), copies the subject's live y/z/quaternion/scale onto every
//     echo root, mirrors visibility, re-reads source opacity (echoes co-fade
//     with the subject), and re-snapshots each echo mesh's subject-relative
//     matrix so internally co-animated chrome stays registered.
//   • restore — dispose() removes the echoes, disposes ONLY the clone
//     materials this primitive created (geometries and textures are the
//     subject's own, shared by reference, NEVER disposed) and hands the
//     subject back at its un-displaced base x. Nothing else on the subject is
//     ever written.
//
// Subject may be a Mesh OR a Group (MSDF text): echoes are built by
// traversing every material-bearing Mesh descendant and flattening each into
// the echo root with its subject-relative matrix.
//
// DISTINCT from every catalog neighbor: horizontal-scroll lerps the SINGLE
// card across a span (no copies, no wrap); scroll-skew shears in place;
// scroll-stagger-rise decomposes the card into vertically-arriving rows;
// scroll-fade-stack fades/lifts one subject. Nothing else in the catalog is a
// wrapping multi-copy belt. Scroll/card/hard; duration Infinity (stateful,
// scroll-driven). No new colors: the echoes ARE the subject's look.

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
import { bool, clamp, num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'gap', label: 'Gap', type: 'knob', min: 0.1, max: 1, step: 0.05, default: 0.3, unit: '×w' },
  { id: 'ghosts', label: 'Ghosts', type: 'knob', min: 1, max: 3, step: 1, default: 2 },
  { id: 'dim', label: 'Ghost Dim', type: 'fader', min: 0.15, max: 1, step: 0.05, default: 0.55 },
  { id: 'reverse', label: 'Reverse', type: 'toggle', default: false },
] as const;

// Belt tuning (fixed constants — the controls shape layout and echo look):
const DRIFT_TURNS = 0.75; // belt-lengths traveled across a full scroll sweep
//   deliberately ≠ 1.0 AND ≠ k·2 so the reverse toggle yields a distinct pose
//   at the advocate's pinned scroll=0.5 (±0.375·L are different wrap points).
const BOOST_TURNS = 0.45; // extra belt-lengths per unit of accumulated impulse
const BOOST_DECAY = 2.0; //  1/s — impulse envelope relaxation when time advances
const BOOST_MAX = 0.6; //    impulse clamp (scroll units) — the belt never runs away
const VEL_MAX = 0.2; //      per-seek scroll-delta clamp (sawtooth fallback wrap)
const DT_MAX = 0.25; //      dt clamp for decay normalization (scrubs, long stalls)

type EchoMat = Material & { opacity: number; map?: Texture | null };

/** A source mesh ↔ echo mesh pair plus the look identity the clones were
 *  built from (material instance + map), compared live each seek. */
interface EchoPair {
  src: Mesh;
  dst: Mesh;
  clones: EchoMat[];
  builtMat: Material | null;
  builtMap: Texture | null;
}

interface Echo {
  root: Group;
  pairs: EchoPair[];
}

/** Wrap a belt coordinate into [-L/2, L/2) — members stay centered on the
 *  subject's base x and re-enter the far side seamlessly. */
const wrapCentered = (x: number, beltLength: number): number => {
  const m = ((x % beltLength) + beltLength) % beltLength;
  return m >= beltLength / 2 ? m - beltLength : m;
};

/** The subject's live materials as a flat list (array materials supported). */
const matsOf = (mesh: Mesh): EchoMat[] => {
  const m = mesh.material;
  return (Array.isArray(m) ? m : m ? [m] : []) as EchoMat[];
};

export const scrollMarqueePrimitive: PrimitiveDefinition = {
  name: 'scroll-marquee',
  label: 'Scroll Marquee',
  category: 'scroll',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'The card becomes an endless belt — ghost copies trailing it in a lateral marquee whose drift is steered by the scroll.',
  create: defineAnimatable(
    { name: 'scroll-marquee', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      // Echo roots are SIBLINGS of the subject so belt slots are written in
      // the same parent-local frame as subject.position.x.
      const ghostParent: Object3D = subject.parent ?? target.scene;

      // ── Subject-relative belt width (Box3-measured, parent-local) ────────
      // Translation never changes (max.x - min.x); a degenerate (not-yet-
      // mounted) subject gets unit width and is re-measured each seek until
      // real geometry lands.
      const tmpScale = new Vector3();
      const measureWidth = (): number => {
        subject.updateWorldMatrix(true, true);
        const wb = new Box3().setFromObject(subject);
        if (wb.isEmpty()) return 0;
        const sx = Math.abs(ghostParent.getWorldScale(tmpScale).x);
        return (wb.max.x - wb.min.x) / (sx > 1e-6 ? sx : 1);
      };
      let beltW = measureWidth();

      // ── Belt state (persisted across seeks on the closure) ───────────────
      let baseX = subject.position.x; // the subject's un-displaced slot-0 pose
      let lastWrittenX: number | null = null; // our last write → external-delta detection
      let prevScroll: number | null = null;
      let prevT: number | null = null;
      let boost = 0; // the persisted velocity-impulse envelope (scroll units)
      let lastScroll = 0; // last resolved scroll — onParamChange re-applies here

      // ── Echo construction ────────────────────────────────────────────────
      let echoes: Echo[] = [];
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
          c.depthWrite = false; // echo discipline: dimmed copies never fight the z-buffer
          return c;
        });
        pair.builtMat = live[0] ?? null;
        pair.builtMap = (pair.builtMat as EchoMat | null)?.map ?? null;
        if (pair.clones.length > 0) {
          pair.dst.material = Array.isArray(pair.src.material)
            ? pair.clones
            : pair.clones[0];
        }
      };

      const invSubject = new Matrix4();

      const buildEcho = (index: number): Echo => {
        const root = new Group();
        root.name = `marquee-ghost-${index}`;
        subject.updateWorldMatrix(true, true);
        invSubject.copy(subject.matrixWorld).invert();
        const pairs: EchoPair[] = [];
        subject.traverse((o) => {
          const src = o as Mesh;
          if (!src.isMesh || !src.material) return;
          // Geometry shared BY REFERENCE — the echo is the subject's own
          // shape, flattened into the root with its subject-relative matrix.
          const dst = new Mesh(src.geometry);
          dst.name = `marquee-echo-${index}-${pairs.length}`;
          dst.matrixAutoUpdate = false;
          dst.matrix.multiplyMatrices(invSubject, src.matrixWorld);
          const pair: EchoPair = { src, dst, clones: [], builtMat: null, builtMap: null };
          rebindPair(pair);
          root.add(dst);
          pairs.push(pair);
        });
        // Park at the subject's pose until the first apply lays out the belt.
        root.position.copy(subject.position);
        root.quaternion.copy(subject.quaternion);
        root.scale.copy(subject.scale);
        ghostParent.add(root);
        return { root, pairs };
      };

      const disposeEchoes = (): void => {
        for (const e of echoes) {
          if (e.root.parent) e.root.parent.remove(e.root);
          // Clone materials only. Geometries + textures are the subject's
          // shared resources — material.dispose() never touches a texture.
          for (const p of e.pairs) for (const c of p.clones) c.dispose();
        }
        echoes = [];
      };

      const buildEchoes = (count: number): void => {
        disposeEchoes();
        const w = measureWidth(); // pose may have settled / meshes mounted
        if (w > 1e-6) beltW = w;
        builtMeshCount = countMeshes();
        const n = Math.max(1, Math.min(3, Math.round(count)));
        for (let i = 0; i < n; i++) echoes.push(buildEcho(i));
      };

      // ── The pose: belt layout + live look/pose sync ──────────────────────
      const applyPose = (scroll: number): void => {
        // External co-binding moved the subject's x since our last write →
        // fold that delta into the base so the WHOLE belt follows.
        if (lastWrittenX !== null && subject.position.x !== lastWrittenX) {
          baseX += subject.position.x - lastWrittenX;
        }
        // Async-mounted subjects: keep retrying the measure until real
        // geometry lands; a mesh-count change rebuilds the echoes outright.
        if (beltW <= 1e-6) {
          const w = measureWidth();
          if (w > 1e-6) beltW = w;
        }
        if (countMeshes() !== builtMeshCount) buildEchoes(num(params.ghosts, 2));

        const widthRef = beltW > 1e-6 ? beltW : 1; // degenerate ⇒ unit travel
        const gap = clamp(num(params.gap, 0.3), 0.05, 4);
        const slotSpan = widthRef * (1 + gap);
        const members = echoes.length + 1;
        const beltLength = slotSpan * members;
        const dir = bool(params.reverse, false) ? -1 : 1;
        const offset =
          dir * (clamp(scroll, 0, 1) * DRIFT_TURNS + boost * BOOST_TURNS) * beltLength;
        const dim = clamp(num(params.dim, 0.55), 0, 1);

        // One consistent world snapshot for the subject-relative matrices —
        // taken BEFORE we write the subject's own x this frame.
        subject.updateWorldMatrix(true, true);
        invSubject.copy(subject.matrixWorld).invert();

        for (let gi = 0; gi < echoes.length; gi++) {
          const echo = echoes[gi];
          const root = echo.root;
          // Live base-pose sync: y/z/rotation/scale ride the subject's
          // co-binding-driven pose; x is this member's wrapped belt slot.
          root.position.copy(subject.position);
          root.position.x = baseX + wrapCentered((gi + 1) * slotSpan - offset, beltLength);
          root.quaternion.copy(subject.quaternion);
          root.scale.copy(subject.scale);
          root.visible = subject.visible;

          for (const pair of echo.pairs) {
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
            // Echo opacity co-fades with the LIVE source opacity × dim.
            for (let k = 0; k < pair.clones.length; k++) {
              const srcMat = live[k] ?? liveFirst;
              pair.clones[k].opacity = (srcMat ? srcMat.opacity : 1) * dim;
            }
          }
        }

        // The subject is belt member 0 — drive its slot and remember the
        // write so the next frame can tell external motion from our own.
        subject.position.x = baseX + wrapCentered(-offset, beltLength);
        lastWrittenX = subject.position.x;
      };

      buildEchoes(num(params.ghosts, 2));
      applyPose(lastScroll); // lay the belt out at rest (subject at base pose)

      return {
        // Purely stateful: driven by scroll input, no fixed timeline.
        duration: () => Infinity,
        seek: (t) => {
          const ud = target.userData;
          const hasScroll =
            typeof ud.scroll === 'number' && Number.isFinite(ud.scroll as number);
          // Time-fallback sweep keeps the picker tile alive without a host
          // scroll; VEL_MAX swallows the sawtooth's wrap spike.
          const scroll = hasScroll
            ? clamp(ud.scroll as number, 0, 1)
            : clamp((t % 4) / 4, 0, 1);
          const dt = prevT === null ? 0 : clamp(t - prevT, 0, DT_MAX);
          const vel =
            prevScroll === null ? 0 : clamp(scroll - prevScroll, -VEL_MAX, VEL_MAX);
          prevT = t;
          prevScroll = scroll;
          // Decay (dt-normalized; dt=0 on pinned repeats ⇒ frozen) then
          // accumulate — the persisted impulse envelope.
          boost = clamp(boost * Math.exp(-BOOST_DECAY * dt) + vel, -BOOST_MAX, BOOST_MAX);
          lastScroll = scroll;
          applyPose(scroll);
        },
        onParamChange: (id: string, value: ControlValue) => {
          // 'ghosts' is structural (member count + belt length); everything
          // re-applies the pose at the LAST seek state so the advocate's
          // pinned sweeps see every control reshape the engaged frame.
          if (id === 'ghosts') buildEchoes(num(value, 2));
          applyPose(lastScroll);
        },
        dispose: () => {
          disposeEchoes();
          // Hand the subject back at its un-displaced base (x is the ONLY
          // thing this primitive ever writes on the subject).
          subject.position.x = baseX;
          lastWrittenX = null;
        },
      };
    },
  ),
};
