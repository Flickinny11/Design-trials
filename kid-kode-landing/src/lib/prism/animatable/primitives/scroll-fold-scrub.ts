// scroll-fold-scrub — scroll folds the panel up like a brochure: side leaves
// hinge over the center in sequence as scroll advances, and the whole motion
// is a pure SCRUB (DESIGN-REFERENCES §6 — ScrollTrigger scrub choreography,
// implemented natively): scrolling back unfolds it flat again, frame-exact.
//
// STRUCTURE: the subject is decomposed into N (2/3/4) panel-slice OVERLAYS
// hung on a nested hinge-pivot chain anchored at the center slice:
//
//   foldGroup ── centerPanel (anchor, never moves)
//            ├── pivot(left boundary)  ── leftPanel
//            └── pivot(right boundary) ── rightPanel ── pivot ── outerPanel…
//
// Hinges fold OUTERMOST-FIRST (a roll fold: the outer leaf folds onto its
// neighbor, then the packet folds over the center), each across its own
// staggered scroll window — `stagger` 0 folds everything together, 1 is fully
// sequential, and the LAST hinge always completes exactly at scroll=1. Each
// hinge with fold order o stops at PI − (4° + 7°·o) and rides a small stack
// lift (0.08·panelSpan·o, scaled by its own fold fraction so the rest pose is
// exactly coplanar): later leaves drape OVER earlier ones at a visibly wider
// wedge instead of slicing through them, so the fully-folded state reads as a
// legible stacked card — never empty (center anchor always flat + lit).
//
// OVERLAY DISCIPLINE (scroll-stagger-rise / P0 pattern, reused verbatim):
//   * Panels carry the subject's FULL look: when the live material has a .map
//     the texture is shared BY REFERENCE through per-panel clones with
//     UV-windowed slices; otherwise the clone carries color/emissive/PBR
//     scalars. Never an invented fill.
//   * LATE TEXTURE POUR: mounted artifacts receive .map ASYNCHRONOUSLY after
//     attach — every seek re-reads the live material and rebuilds the panels
//     when the material instance OR its map identity changed.
//   * LIVE TRANSFORM TRACKING: co-bindings keep animating the hidden subject;
//     every seek re-syncs the fold group to the subject's current local pose.
//   * The subject is hidden while the fold is active and restored on dispose;
//     dispose() removes + disposes every geometry/material we created and
//     never touches the subject's shared resources.
//
// CONTACT SHADING: folding leaves darken via a per-vertex grayscale MULTIPLIER
// (vertexColors on the cloned material — darkest at the crease, easing toward
// the free edge, deepened when ancestor hinges have folded the packet down).
// Multiplicative over the subject's own map/color, so the shade always derives
// from the subject tone — no invented colors, no purple, and it clears to
// exactly 1.0 at scroll=0 (the idle frame is the pure subject look).
//
// SCROLL-RIG: position-scrubbed only (no velocity term), so the advocate's
// paused repeated seeks at scroll=0.5 hold a stable, ENGAGED mid-fold and all
// four controls visibly reshape that pinned frame (panels/direction rebuild +
// re-apply, stagger re-times the hinge windows, shade re-weights the crease
// darkening — onParamChange re-applies the pose at the last seek state). All
// travel is subject-relative (Box3-measured) and folds INWARD over the
// subject's own footprint, so the envelope stays inside the tile frame.
//
// DISTINCT from card-fold (time entrance, single-crease whole-card SCALE — no
// hinge geometry), origami-fold (time-driven per-vertex accordion pleats on
// the surface itself), and scroll-flip (whole-subject rotation): this is a
// scroll-SCRUBBED multi-panel sequential brochure fold of subject-look
// overlays, reversible by scroll, with crease contact shading. Scroll/plane/
// hard.

import {
  Box3,
  BufferAttribute,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  PlaneGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { clamp, num, str, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  {
    id: 'panels',
    label: 'Panels',
    type: 'dropdown',
    options: [
      { value: '2', label: 'Bi-fold (2)' },
      { value: '3', label: 'Tri-fold (3)' },
      { value: '4', label: 'Roll fold (4)' },
    ],
    default: '3',
  },
  {
    id: 'direction',
    label: 'Fold Direction',
    type: 'dropdown',
    options: [
      { value: 'horizontal', label: 'Horizontal (side leaves)' },
      { value: 'vertical', label: 'Vertical (top & bottom)' },
    ],
    default: 'horizontal',
  },
  { id: 'stagger', label: 'Stagger', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.55 },
  { id: 'shade', label: 'Contact Shade', type: 'knob', min: 0, max: 0.8, step: 0.01, default: 0.4 },
] as const;

// Hinge-angle ladder: fold order o stops at PI − (WEDGE_BASE + WEDGE_STEP·o).
// Later leaves keep a wider wedge (plus the stack lift below) so they drape
// OVER earlier leaves instead of intersecting them — the folded stack reads
// as real layered paper, not crossing planes.
const WEDGE_BASE = (4 * Math.PI) / 180;
const WEDGE_STEP = (7 * Math.PI) / 180;
// Stack lift per fold order, in multiples of the panel span (subject-relative).
const STACK_GAP = 0.08;
// Crease shadow shaping: full `shade` depth at the hinge (h=0) easing to 30%
// of it at the free edge (h=1) — m(h) = 1 − shade·drive·(1 − SHADE_EDGE·h).
const SHADE_EDGE = 0.7;
// How much folded ANCESTOR hinges deepen a packet member's shade.
const ANCESTOR_SHADE = 0.35;
// Fallback (nothing to decompose): whole-subject lean-fold amplitude (rad).
const LEAN_RAD = 0.35;

/** Read the host-supplied scroll value (0..1), tolerant of shape. */
function readScroll(userData: Record<string, unknown>): number {
  const s = userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return 0.5;
}

/** The appearance source: the first Mesh descendant (or the subject itself
 *  when it is a Mesh). The subject may be a Group — traverse, never assume. */
function findRepresentativeMesh(subject: Object3D): Mesh | null {
  let found: Mesh | null = null;
  subject.traverse((o) => {
    if (found) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.material) found = mesh;
  });
  return found;
}

export const scrollFoldScrubPrimitive: PrimitiveDefinition = {
  name: 'scroll-fold-scrub',
  label: 'Scroll Fold Scrub',
  category: 'scroll',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll folds the panel up like a brochure — side leaves hinging over the center in sequence — and unfolds it flat again.',
  create: defineAnimatable(
    { name: 'scroll-fold-scrub', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      // ── Measure the subject in ITS OWN local frame ──────────────────────
      // Panel slicing, hinge placement, and the stack lift all derive from
      // this box — NEVER hardcoded world units (mounted artifacts vary wildly
      // in size). Re-measured on every rebuild: a create that ran mid-pose
      // (page-turn conductor) inflates the AABB round-trip, and by rebuild
      // time (async texture pour) the pose has settled.
      const measureLocalBox = (): Box3 | null => {
        subject.updateWorldMatrix(true, true);
        const wb = new Box3().setFromObject(subject);
        if (wb.isEmpty()) return null;
        return wb.applyMatrix4(new Matrix4().copy(subject.matrixWorld).invert());
      };
      const spanOk = (b: Box3): boolean =>
        b.max.x - b.min.x > 1e-4 && b.max.y - b.min.y > 1e-4;
      let localBox = measureLocalBox();

      const repMesh = findRepresentativeMesh(subject);
      type MappedMaterial = Material & { map?: Texture | null };
      /** The representative mesh's CURRENT first material — read live, never
       *  cached: the mounted plane factory pours `.map` asynchronously and
       *  applyImageSpec may swap the material after this primitive attaches. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };

      // ── Mode: panel overlays, or a whole-subject lean fallback ──────────
      const overlay = Boolean(
        localBox && spanOk(localBox) && liveSourceMaterial() && subject.parent,
      );

      const foldGroup = new Group();
      foldGroup.name = 'fold-scrub-group';
      const prevVisible = subject.visible;
      const baseRotX = subject.rotation.x; // lean-fallback restore point

      if (overlay) {
        // Sibling of the subject carrying its exact local transform — the
        // panels occupy the subject's spot and co-move under outer transforms
        // (a hidden parent hides its children, so they cannot live UNDER it).
        foldGroup.position.copy(subject.position);
        foldGroup.quaternion.copy(subject.quaternion);
        foldGroup.scale.copy(subject.scale);
        subject.parent!.add(foldGroup);
        // The panels ARE the subject now — hide the original until dispose().
        subject.visible = false;
      }

      interface HingeRec {
        pivot: Group;
        order: number; // fold order: 0 folds first
        sign: number; // rotation sign (folds over the FRONT face)
        axis: 'x' | 'y'; // rotation axis (y = horizontal dir, x = vertical)
        baseZ: number; // pivot rest z in its parent frame (coplanar at rest)
        lift: number; // stack lift at full fold (subject-relative)
        maxAngle: number; // PI − wedge(order)
        w: number; // current eased fold fraction (updated each apply)
      }
      interface PanelRec {
        mesh: Mesh;
        material: Material;
        colorAttr: BufferAttribute;
        hFrac: Float32Array; // 0 at the hinge crease → 1 at the free edge
        own: HingeRec | null; // null for the center anchor
        ancestors: HingeRec[]; // inboard hinges of the same chain
      }

      let hinges: HingeRec[] = [];
      let panels: PanelRec[] = [];
      let roots: Object3D[] = []; // direct foldGroup children (chains + center)

      const disposePanels = () => {
        for (const p of panels) {
          p.mesh.geometry.dispose();
          // Clones only — material.dispose() does NOT dispose the shared
          // texture, so the subject's own map survives untouched.
          p.material.dispose();
        }
        for (const r of roots) foldGroup.remove(r);
        panels = [];
        hinges = [];
        roots = [];
      };

      // What the current panel set was built FROM — material instance + map
      // identity. apply() compares these against the live source each seek and
      // rebuilds when the async texture pour (or a material swap) lands AFTER
      // create.
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      const buildPanels = () => {
        disposePanels();
        if (!overlay) return;
        const remeasured = measureLocalBox();
        if (remeasured && spanOk(remeasured)) localBox = remeasured;
        const src = liveSourceMaterial();
        builtSrcMat = src;
        builtSrcMap = (src?.map as Texture | null | undefined) ?? null;
        if (!src || !localBox) return;
        const map = builtSrcMap;

        const horizontal = str(params.direction, 'horizontal') !== 'vertical';
        const n = clamp(Math.round(Number(str(params.panels, '3'))) || 3, 2, 4);

        // Fold-axis extent + cross extent, all from the measured box.
        const minA = horizontal ? localBox.min.x : localBox.min.y;
        const maxA = horizontal ? localBox.max.x : localBox.max.y;
        const minC = horizontal ? localBox.min.y : localBox.min.x;
        const maxC = horizontal ? localBox.max.y : localBox.max.x;
        const ps = (maxA - minA) / n; // panel span along the fold axis
        const crossExt = maxC - minC;
        const crossMid = (minC + maxC) / 2;
        const faceZ = localBox.max.z; // the artifact's front face
        const c = Math.floor((n - 1) / 2); // center (anchor) slice index
        const stackGap = STACK_GAP * ps;

        /** One panel-slice overlay carrying the subject's full look.
         *  hSide: −1 hinge at the slice's high edge (low chain), +1 hinge at
         *  the low edge (high chain), 0 center anchor (no crease). */
        const makePanel = (slice: number, hSide: -1 | 0 | 1) => {
          // Subdivided along the fold axis so the crease gradient interpolates.
          const geo = horizontal
            ? new PlaneGeometry(ps, crossExt, 6, 1)
            : new PlaneGeometry(crossExt, ps, 1, 6);
          if (map) {
            // Window this slice of the SHARED texture: u (or v) remapped into
            // [slice/n, (slice+1)/n] so the panels reassemble the artifact's
            // real appearance exactly.
            const uv = geo.attributes.uv;
            for (let k = 0; k < uv.count; k++) {
              if (horizontal) uv.setX(k, (slice + uv.getX(k)) / n);
              else uv.setY(k, (slice + uv.getY(k)) / n);
            }
            uv.needsUpdate = true;
          }
          // Per-vertex hinge fraction (0 at the crease, 1 at the free edge)
          // drives the contact shade; vertex colors start at exactly 1 so the
          // rest pose is the pure subject look.
          const pos = geo.attributes.position;
          const count = pos.count;
          const hFrac = new Float32Array(count);
          for (let i = 0; i < count; i++) {
            const a = horizontal ? pos.getX(i) : pos.getY(i);
            hFrac[i] = hSide === 0 ? 0 : hSide > 0 ? (a + ps / 2) / ps : (ps / 2 - a) / ps;
          }
          const colorAttr = new BufferAttribute(new Float32Array(count * 3).fill(1), 3);
          geo.setAttribute('color', colorAttr);

          // Clone the subject's OWN material: color/emissive/PBR scalars/map
          // all carried over (the texture by reference); the original is never
          // mutated. DoubleSide: a leaf folded past 90° shows its back face.
          const material = src.clone();
          material.vertexColors = true;
          material.side = DoubleSide;
          material.needsUpdate = true;

          const mesh = new Mesh(geo, material);
          mesh.name = `fold-scrub-panel-${slice}`;
          return { mesh, material, colorAttr, hFrac };
        };

        // Center anchor: parked at its slice, directly in the fold group.
        const centerMade = makePanel(c, 0);
        const centerA = minA + (c + 0.5) * ps;
        if (horizontal) centerMade.mesh.position.set(centerA, crossMid, faceZ);
        else centerMade.mesh.position.set(crossMid, centerA, faceZ);
        foldGroup.add(centerMade.mesh);
        roots.push(centerMade.mesh);
        panels.push({ ...centerMade, own: null, ancestors: [] });

        // Hinge chains out from the center: nested pivots, each panel hung
        // with its crease edge at the pivot origin.
        interface RawHinge {
          pivot: Group;
          rank: number; // depth from the chain's OUTER end (0 folds first)
          chainIdx: number;
          k: number; // chain position (0 = adjacent to center)
          sign: number;
          baseZ: number;
        }
        const raw: RawHinge[] = [];
        const chainMade: { made: ReturnType<typeof makePanel>; chainIdx: number; k: number }[] =
          [];

        const buildChain = (chainIdx: 0 | 1) => {
          const dir = chainIdx === 0 ? -1 : 1; // low side / high side
          const count = chainIdx === 0 ? c : n - 1 - c;
          if (count <= 0) return;
          // Fold over the FRONT (+z): rotY(−a) swings +x toward +z (right
          // leaf), rotY(+a) swings −x toward +z (left); rotX(+a) swings +y
          // toward +z (top), rotX(−a) swings −y toward +z (bottom).
          const sign = horizontal ? (dir < 0 ? 1 : -1) : dir < 0 ? -1 : 1;
          const boundary = minA + (dir < 0 ? c : c + 1) * ps;
          let parent: Object3D = foldGroup;
          for (let k = 0; k < count; k++) {
            const slice = c + dir * (k + 1);
            const pivot = new Group();
            if (k === 0) {
              if (horizontal) pivot.position.set(boundary, crossMid, faceZ);
              else pivot.position.set(crossMid, boundary, faceZ);
              roots.push(pivot);
            } else if (horizontal) {
              pivot.position.set(dir * ps, 0, 0);
            } else {
              pivot.position.set(0, dir * ps, 0);
            }
            parent.add(pivot);
            const made = makePanel(slice, dir > 0 ? 1 : -1);
            if (horizontal) made.mesh.position.set((dir * ps) / 2, 0, 0);
            else made.mesh.position.set(0, (dir * ps) / 2, 0);
            pivot.add(made.mesh);
            raw.push({ pivot, rank: count - 1 - k, chainIdx, k, sign, baseZ: pivot.position.z });
            chainMade.push({ made, chainIdx, k });
            parent = pivot;
          }
        };
        buildChain(0);
        buildChain(1);

        // Fold order: outermost hinges first (rank asc), low chain breaking
        // ties — deterministic, so a tri-fold always closes left then right.
        raw.sort((a, b) => a.rank - b.rank || a.chainIdx - b.chainIdx || a.k - b.k);
        const byChainK = new Map<string, HingeRec>();
        hinges = raw.map((r, o) => {
          r.pivot.name = `fold-scrub-hinge-${o}`;
          const rec: HingeRec = {
            pivot: r.pivot,
            order: o,
            sign: r.sign,
            axis: horizontal ? 'y' : 'x',
            baseZ: r.baseZ,
            lift: stackGap * o,
            maxAngle: Math.PI - (WEDGE_BASE + WEDGE_STEP * o),
            w: 0,
          };
          byChainK.set(`${r.chainIdx}:${r.k}`, rec);
          return rec;
        });
        for (const cm of chainMade) {
          const own = byChainK.get(`${cm.chainIdx}:${cm.k}`)!;
          const ancestors: HingeRec[] = [];
          for (let j = 0; j < cm.k; j++) ancestors.push(byChainK.get(`${cm.chainIdx}:${j}`)!);
          panels.push({ ...cm.made, own, ancestors });
        }
      };

      buildPanels();

      const apply = (scroll: number) => {
        if (!overlay) {
          // Fallback: nothing to decompose — lean-fold the WHOLE subject
          // (never spawn placeholder quads, never an empty frame; scroll=0 is
          // the exact rest pose). Restored in dispose.
          subject.rotation.x = baseRotX - LEAN_RAD * ease('easeInOut', clamp(scroll, 0, 1));
          return;
        }

        // LIVE TRANSFORM TRACKING — re-register the fold group on the hidden
        // subject's CURRENT local pose every call (co-bindings keep moving it).
        foldGroup.position.copy(subject.position);
        foldGroup.quaternion.copy(subject.quaternion);
        foldGroup.scale.copy(subject.scale);

        // LATE TEXTURE POUR — rebuild from the live source the moment the
        // material instance or its map identity changes (clones taken at
        // create would stay map-less white forever).
        const src = liveSourceMaterial();
        const liveMap = (src?.map as Texture | null | undefined) ?? null;
        if (src !== builtSrcMat || liveMap !== builtSrcMap) buildPanels();

        const Hn = hinges.length;
        if (Hn === 0) return;

        // Staggered hinge windows (same layout math as scroll-stagger-rise):
        // hinge o starts at o·offset and completes over `window`; with
        // offset = stagger·window the LAST hinge finishes exactly at scroll=1.
        const stagger = clamp(num(params.stagger, 0.55), 0, 1);
        const window = 1 / (1 + (Hn - 1) * stagger);
        const offset = stagger * window;

        for (const h of hinges) {
          const w = ease(
            'easeInOut',
            clamp((scroll - h.order * offset) / Math.max(1e-4, window), 0, 1),
          );
          h.w = w;
          h.pivot.rotation[h.axis] = h.sign * w * h.maxAngle;
          // Stack lift scales with the hinge's OWN fold fraction: exactly
          // coplanar at rest, draped over the earlier leaves when folded.
          h.pivot.position.z = h.baseZ + h.lift * w;
        }

        // Contact shading: multiplicative crease darkening on folding leaves,
        // deepened when ancestor hinges have folded the packet down. Clears to
        // exactly 1.0 when flat.
        const shade = clamp(num(params.shade, 0.4), 0, 0.8);
        for (const p of panels) {
          if (!p.own) continue; // the center anchor never folds, never darkens
          let anc = 0;
          for (const a of p.ancestors) anc = Math.max(anc, a.w);
          const drive = clamp(p.own.w + ANCESTOR_SHADE * anc, 0, 1);
          const k = shade * drive;
          const attr = p.colorAttr;
          for (let i = 0; i < p.hFrac.length; i++) {
            const m = 1 - k * (1 - SHADE_EDGE * p.hFrac[i]);
            attr.setXYZ(i, m, m, m);
          }
          attr.needsUpdate = true;
        }
      };

      // onParamChange re-applies the pose at the LAST seek state (the
      // advocate's pinned frame must re-shape under every control sweep).
      let lastScroll = 0;

      return {
        // Stateful, scroll-driven: animate continuously. Map the master clock
        // to a scroll sweep when no live host scroll is present so the tile
        // plays.
        duration: () => Infinity,
        seek: (t) => {
          const ud = target.userData;
          const hasScroll = typeof ud.scroll === 'number' && Number.isFinite(ud.scroll as number);
          const scroll = hasScroll ? readScroll(ud) : clamp((t % 4) / 4, 0, 1);
          lastScroll = scroll;
          apply(scroll);
        },
        onParamChange: (id: string) => {
          if (overlay && (id === 'panels' || id === 'direction')) buildPanels();
          apply(lastScroll);
        },
        dispose: () => {
          disposePanels();
          if (foldGroup.parent) foldGroup.parent.remove(foldGroup);
          if (overlay) subject.visible = prevVisible;
          else subject.rotation.x = baseRotX;
        },
      };
    },
  ),
};
