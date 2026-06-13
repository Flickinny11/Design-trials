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
// CHROME CO-TREATMENT (advocate must-fix, 2026-06-12 — the tile read as a
// FEATURELESS TAN/BROWN SLAB at every phase: the subject was declared a
// chrome-less 'plane', so the fold operated on a blank panel-colored quad with
// none of the catalog card's brass header / accent dot / grey rows / rounded
// silhouette visible. Same placeholder-plane defect root-caused for
// cylinder-unroll + genie-suck). The fix is twofold:
//   1. The declared subject is now the catalog CARD (subject:'card'), so the
//      primitive receives the dark RoundedBox panel WITH its chrome children.
//   2. The full composite look rides the fold. The PANEL is the slice overlays
//      (below); the CHROME children become per-leaf clones that fold WITH the
//      panel slice they sit over:
//      - WIDE CHROME (header bar + content rows) is CLIPPED per slice: for each
//        panel slice a child overlaps, a RoundedBox clip carries the child's
//        OWN color/emissive/PBR scalars (map shared by reference if any), sized
//        to the overlap and PARENTED TO THAT SLICE'S PANEL MESH at the child's
//        proud-of-face z. A header crossing the left crease therefore curls
//        away with the left leaf — the bar visibly hinges, never a flat slab.
//      - SMALL CHROME (the accent dot) becomes a RIGID CLONE: the child's real
//        geometry shared by reference + a material clone, parented to the panel
//        mesh of the slice it sits in. Tiny footprint → rigid placement on the
//        folding leaf is visually exact; clipping a sphere would distort it.
//      Clips/clones are children of their slice's panel mesh, so the hinge
//      rotation, stack lift, and LIVE TRANSFORM TRACKING all carry the chrome
//      for free. Chrome materials clone the child's own look (never an invented
//      fill); the subject's children are never mutated.
//
// OVERLAY DISCIPLINE (scroll-stagger-rise / P0 pattern, reused verbatim):
//   * Panels carry the subject's FULL look: when the live material has a .map
//     the texture is shared BY REFERENCE through per-panel clones with
//     UV-windowed slices; otherwise the clone carries color/emissive/PBR
//     scalars (the catalog card panel is map-less — the clone is its tone).
//   * LATE TEXTURE POUR: mounted artifacts receive .map ASYNCHRONOUSLY after
//     attach — every seek re-reads the live material and rebuilds the panels
//     when the material instance OR its map identity changed.
//   * LIVE TRANSFORM TRACKING: co-bindings keep animating the hidden subject;
//     every seek re-syncs the fold group to the subject's current local pose.
//   * The subject is hidden while the fold is active and restored on dispose;
//     dispose() removes + disposes every geometry/material we created and
//     never touches the subject's shared resources (chrome maps + the dot's
//     shared geometry survive untouched).
//
// CONTACT SHADING: folding leaves darken via a per-vertex grayscale MULTIPLIER
// (vertexColors on the cloned panel material — darkest at the crease, easing
// toward the free edge, deepened when ancestor hinges have folded the packet
// down). The SAME crease-shadow factor multiplies each chrome clip's color +
// emissive (clips snapshot their base look and re-tint each apply), so the
// brass header and grey rows visibly DARKEN along the fold at the engaged
// angle — the `shade` control reshapes the pinned frame on the chrome, not
// just on a near-invisible dark panel (advocate must-fix: shade was dead on a
// featureless slab). Multiplicative over the subject's own tone — no invented
// colors, no purple, and it clears to exactly 1.0 at scroll=0 (the idle frame
// is the pure subject look).
//
// SCROLL-RIG: position-scrubbed only (no velocity term), so the advocate's
// paused repeated seeks at scroll=0.5 hold a stable, ENGAGED mid-fold and all
// four controls visibly reshape that pinned frame (panels/direction rebuild +
// re-apply, stagger re-times the hinge windows, shade re-weights the crease
// darkening on panel AND chrome — onParamChange re-applies the pose at the last
// seek state). All travel is subject-relative (Box3-measured) and folds INWARD
// over the subject's own footprint, so the envelope stays inside the tile frame.
//
// DISTINCT from card-fold (time entrance, single-crease whole-card SCALE — no
// hinge geometry), origami-fold (time-driven per-vertex accordion pleats on
// the surface itself), and scroll-flip (whole-subject rotation): this is a
// scroll-SCRUBBED multi-panel sequential brochure fold of subject-look
// overlays, reversible by scroll, with crease contact shading. Scroll/card/
// hard.

import {
  Box3,
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  PlaneGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
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
// Chrome clips take a single crease-shadow factor (no per-vertex gradient on a
// small bar): the slice's own fold drive at the bar's mid-shade depth.
const CHROME_SHADE_MID = 1 - SHADE_EDGE * 0.5;
// BOOK-GUTTER CONTACT SHADOW (advocate MF1 — shade was dead at the pinned
// engaged frame). A folded book casts a soft contact shadow down BOTH sides of
// every active crease — onto the STATIONARY center anchor too, not just the
// folding leaf. This is the dominant visible effect: the center band is the
// largest contiguous lit surface near the gutter, and the bright chrome
// (header / rows / dot) that crosses it is the only place darkening reads on a
// near-black card. Reach is a fraction of the panel span from the crease; the
// shadow is deepest AT the crease and eases to nothing past the reach.
// Gutter depth multiplies `shade` (kept < 1 so the band darkens hard but the
// card stays legible at shade=high — it's a contact shadow, not a global
// dimmer).
const GUTTER_DEPTH = 0.95;
// How far the gutter shadow reaches from a crease, as a fraction of the panel
// span. Reaches across MORE than a full slice so the whole anchor band and a
// slab of the adjacent leaf fall inside it at the engaged angle — a large
// contiguous shaded region (the gutter must read on a near-black card, so it
// covers real area, not a hairline).
const GUTTER_REACH = 1.6;
// Falloff exponent: ~1 spreads the darkening across the whole band (a broad
// soft gutter, not a hairline pinch) while still being deepest at the crease.
const GUTTER_FALLOFF = 1.0;
// Chrome inside the gutter takes a deeper hit than the panel: bright brass/grey
// near a fold crease loses more light than the matte panel beside it.
const GUTTER_CHROME_BOOST = 1.25;
// A folding leaf falls bodily into shadow as it tilts away from the light —
// the WHOLE leaf dims (uniform), on top of its per-vertex crease gradient and
// the gutter band. Scales with the leaf's own fold fraction × shade.
const LEAF_BODY_SHADE = 0.72;
// The STATIONARY anchor (the facing page) also dims broadly as an adjacent
// leaf folds over it — the folded leaf looms and occludes the ambient light.
// This is the largest single lit surface, so its uniform dim is the dominant
// area the `shade` control reshapes at the pinned engaged frame. Scales with
// the MAX adjacent fold drive × shade; the gutter band deepens it at the seam.
const ANCHOR_BODY_SHADE = 0.78;
// On a near-black emissive card the visible pixel is emissive-dominated, so the
// panel self-glow dims HARDER than its diffuse to make the contact shadow read
// (capped < 1 so the card never blacks out — it stays legible at shade=high).
const EMISSIVE_DIM_BOOST = 2.1;
const EMISSIVE_DIM_CAP = 0.94;
// SPINE AMBIENT: the whole open spread sits in the fold's ambient shadow once
// ANY leaf has folded — mild and uniform across every panel (so the still-flat
// far page is no longer at full brightness while its neighbour is folded shut),
// deepening toward each panel's seam-facing edge. Kept small: it is a wash, not
// a dimmer — the far page stays clearly the BRIGHT page.
const SPINE_AMBIENT = 0.26;
const SPINE_AMBIENT_EDGE = 0.34; // extra dim at the seam-facing edge
// A chrome child whose footprint is below this fraction of the panel span in
// the fold axis is treated as rigid (the dot) — cloned whole, not clipped.
const RIGID_FRAC = 0.18;
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

type MappedMaterial = Material & {
  map?: Texture | null;
  color?: Color;
  emissive?: Color;
};

/** Read a material's emissiveIntensity scalar (MeshStandardMaterial), or null
 *  when absent — used to snapshot the base so the gutter shadow can dim the
 *  bright chrome's self-glow multiplicatively and restore it exactly. */
function chromeEmissiveIntensity(mat: Material): number | null {
  const m = mat as unknown as { emissiveIntensity?: number };
  return typeof m.emissiveIntensity === 'number' ? m.emissiveIntensity : null;
}

/** A chrome child captured in the subject's local frame at create — its
 *  footprint and proud-of-face offset, plus the source material. Geometry is
 *  rebuilt per panel rebuild (panel count/direction changes re-slice it). */
interface ChromeSrc {
  child: Mesh;
  srcMat: MappedMaterial;
  geometry: BufferGeometry; // shared by reference for rigid clones (the dot)
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  rigid: boolean; // tiny footprint → clone whole instead of clipping
}

/** One chrome clone riding a panel slice: its cloned material + the base
 *  color/emissive so the crease shade can re-tint it multiplicatively. */
interface ChromeRec {
  material: MappedMaterial;
  baseColor: Color | null;
  baseEmissive: Color | null;
  baseEmissiveIntensity: number | null; // self-glow base (dimmed in the gutter)
  panelIndex: number; // which PanelRec drives this clip's crease shade
  // The clip's center fold-axis offset from its slice center (subject units):
  // negative = toward the slice's low edge, positive = toward the high edge.
  // Drives gutter proximity on BOTH the folding leaves and the center anchor.
  axisOffset: number;
  // Half the clip's footprint along the fold axis — a wide bar (header/rows)
  // that straddles the slice still reads as "near the crease" at its inner end.
  halfAxis: number;
}

export const scrollFoldScrubPrimitive: PrimitiveDefinition = {
  name: 'scroll-fold-scrub',
  label: 'Scroll Fold Scrub',
  category: 'scroll',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll folds the card up like a brochure — side leaves hinging over the center in sequence — and unfolds it flat again.',
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
      /** The representative mesh's OWN front-face z in the subject's local
       *  frame (geometry bbox mapped mesh-local → subject-local, the genie-suck
       *  measure — a world-AABB double-inflates under tilt). This is the PANEL
       *  face; proud chrome sits in front of it. Null when unmeasurable. */
      const measureRepFaceZ = (): number | null => {
        if (!repMesh || !repMesh.geometry) return null;
        if (!repMesh.geometry.boundingBox) repMesh.geometry.computeBoundingBox();
        const bb = repMesh.geometry.boundingBox;
        if (!bb || bb.isEmpty()) return null;
        subject.updateWorldMatrix(true, true);
        const rel = new Matrix4()
          .copy(subject.matrixWorld)
          .invert()
          .multiply(repMesh.matrixWorld);
        return new Box3().copy(bb).applyMatrix4(rel).max.z;
      };
      /** The representative mesh's CURRENT first material — read live, never
       *  cached: the mounted plane factory pours `.map` asynchronously and
       *  applyImageSpec may swap the material after this primitive attaches. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };

      // ── Collect the subject's CHROME children (everything but the panel) ──
      // Each child's footprint is measured in the subject's local frame so its
      // per-slice clips bake straight into the slice panels. Captured ONCE
      // (catalog card chrome is static).
      const chromeSrcs: ChromeSrc[] = [];
      if (repMesh && subject) {
        subject.updateWorldMatrix(true, true);
        const invSubject = new Matrix4().copy(subject.matrixWorld).invert();
        const rel = new Matrix4();
        const cb = new Box3();
        subject.traverse((o) => {
          const child = o as Mesh;
          if (!child.isMesh || child === repMesh || !child.material || !child.geometry) return;
          if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
          const bb = child.geometry.boundingBox;
          if (!bb || bb.isEmpty()) return;
          rel.multiplyMatrices(invSubject, child.matrixWorld);
          cb.copy(bb).applyMatrix4(rel);
          const srcMat = (
            Array.isArray(child.material) ? child.material[0] : child.material
          ) as MappedMaterial;
          chromeSrcs.push({
            child,
            srcMat,
            geometry: child.geometry,
            minX: cb.min.x,
            maxX: cb.max.x,
            minY: cb.min.y,
            maxY: cb.max.y,
            minZ: cb.min.z,
            maxZ: cb.max.z,
            // rigidity decided per rebuild against the live panel span.
            rigid: false,
          });
        });
      }

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
        baseEmissiveIntensity: number | null; // self-glow base (dimmed by shade)
        hFrac: Float32Array; // 0 at the hinge crease → 1 at the free edge
        own: HingeRec | null; // null for the center anchor
        ancestors: HingeRec[]; // inboard hinges of the same chain
        sliceMinA: number; // slice fold-axis span (subject-local)
        sliceMaxA: number;
        chrome: ChromeRec[]; // chrome clips riding THIS slice's panel mesh
        // CENTER ANCHOR gutter (null on folding leaves): the crease hinges on
        // each side of the anchor and a per-vertex fold-axis coordinate in
        // [-0.5, 0.5] (−0.5 = the low-side crease, +0.5 = the high-side
        // crease), so the gutter shadow can darken the anchor band down BOTH
        // sides of each active fold.
        gutterAxis: Float32Array | null; // per-vertex, normalized to the span
        leftHinge: HingeRec | null; // crease on the anchor's low edge
        rightHinge: HingeRec | null; // crease on the anchor's high edge
        panelSpan: number; // fold-axis span of this slice (subject units)
        // For a FOLDING leaf: +1 if its crease sits at the slice's high local
        // edge (+span/2), −1 if at the low edge (−span/2); 0 for the anchor.
        // Lets the gutter shadow weight leaf chrome by proximity to the crease.
        creaseSign: -1 | 0 | 1;
      }

      let hinges: HingeRec[] = [];
      let panels: PanelRec[] = [];
      let roots: Object3D[] = []; // direct foldGroup children (chains + center)

      const disposePanels = () => {
        for (const p of panels) {
          // Chrome clips/clones (children of the panel mesh) are ours: their
          // material is a clone (dispose), their geometry is ours ONLY when
          // clipped (Plane/RoundedBox) — rigid clones share the subject's
          // geometry by reference and must NOT be disposed.
          for (const ch of p.chrome) ch.material.dispose();
          for (let i = p.mesh.children.length - 1; i >= 0; i--) {
            const clip = p.mesh.children[i] as Mesh;
            const isRigid = clip.name.startsWith('fold-scrub-chrome-rigid');
            if (!isRigid && clip.geometry) clip.geometry.dispose();
            p.mesh.remove(clip);
          }
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
        // The PANEL face is the representative mesh's OWN front face — NOT the
        // whole-subject max.z (which is the proud chrome's front: using it puts
        // the panel slices IN FRONT of the chrome, so flat-on the panel
        // occludes the header/dot/rows entirely → a featureless slab at idle,
        // the exact MF0 defect). The genie-suck/cylinder-unroll measure: read
        // the rep mesh's geometry bbox mapped subject-local, take its max.z, so
        // chrome (proud of THAT) renders in front of the panel face. Falls back
        // to localBox.max.z when the rep box is unavailable.
        const faceZ = measureRepFaceZ() ?? localBox.max.z;
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
          // Snapshot the panel's base self-emission. On a near-black EMISSIVE
          // card the lit pixel is dominated by emissive, so vertex-color (which
          // multiplies DIFFUSE only) barely moves it — the contact shadow must
          // also dim the self-glow to read. Multiplicative over this base, so
          // it clears exactly when the shade clears. May be absent (Basic mat).
          const emi = material as unknown as { emissiveIntensity?: number };
          const baseEmissiveIntensity =
            typeof emi.emissiveIntensity === 'number' ? emi.emissiveIntensity : null;
          return { mesh, material, colorAttr, hFrac, baseEmissiveIntensity };
        };

        /** Bake this slice's CHROME clones as children of its panel mesh. The
         *  panel mesh sits at the slice's center in its pivot/anchor frame, so
         *  a child at (childCenter − sliceCenter) lands correctly and folds
         *  with the leaf. Wide chrome is CLIPPED to the slice overlap; small
         *  chrome (the dot) is cloned whole when it falls in this slice. */
        const bakeChrome = (
          panelMesh: Mesh,
          slice: number,
          sliceA0: number,
          sliceA1: number,
          sliceCenterA: number,
        ): ChromeRec[] => {
          const recs: ChromeRec[] = [];
          for (const cs of chromeSrcs) {
            const cMinA = horizontal ? cs.minX : cs.minY;
            const cMaxA = horizontal ? cs.maxX : cs.maxY;
            const cMinC = horizontal ? cs.minY : cs.minX;
            const cMaxC = horizontal ? cs.maxY : cs.maxX;
            const childCenterC = (cMinC + cMaxC) / 2;
            const childZ = (cs.minZ + cs.maxZ) / 2; // proud of the face
            const crossW = cMaxC - cMinC;
            const rigid = cMaxA - cMinA < RIGID_FRAC * ps && crossW < RIGID_FRAC * crossExt;

            if (rigid) {
              // Small chrome (the dot): only clone it onto the slice it sits
              // in (by its center), so it does not duplicate across leaves.
              const ca = (cMinA + cMaxA) / 2;
              if (ca < sliceA0 || ca >= sliceA1) continue;
              const cloneMat = cs.srcMat.clone();
              cloneMat.needsUpdate = true;
              // REAL geometry by reference (never disposed by us).
              const m = new Mesh(cs.geometry, cloneMat);
              m.name = `fold-scrub-chrome-rigid-${slice}`;
              const offA = ca - sliceCenterA;
              const offC = childCenterC - crossMid;
              if (horizontal) m.position.set(offA, offC, childZ - faceZ);
              else m.position.set(offC, offA, childZ - faceZ);
              panelMesh.add(m);
              recs.push({
                material: cloneMat,
                baseColor: cloneMat.color ? cloneMat.color.clone() : null,
                baseEmissive: cloneMat.emissive ? cloneMat.emissive.clone() : null,
                baseEmissiveIntensity: chromeEmissiveIntensity(cloneMat),
                panelIndex: -1, // filled by the caller (this slice's index)
                axisOffset: offA,
                halfAxis: (cMaxA - cMinA) / 2,
              });
              continue;
            }

            // Wide chrome: intersect the bar with this slice's fold-axis span.
            const lo = Math.max(cMinA, sliceA0);
            const hi = Math.min(cMaxA, sliceA1);
            if (hi - lo <= 1e-4) continue;
            const clipW = hi - lo; // along the fold axis
            const clipCenterA = (lo + hi) / 2;
            const depth = Math.max(cs.maxZ - cs.minZ, 0.01);
            // A thin rounded bar matching the chrome look (the card chrome IS
            // a RoundedBox). Corner radius scaled small so clipping at a crease
            // does not round the cut edge oddly.
            const r = Math.min(0.014, Math.min(clipW, crossW) * 0.3);
            const geo = horizontal
              ? new RoundedBoxGeometry(clipW, crossW, depth, 2, r)
              : new RoundedBoxGeometry(crossW, clipW, depth, 2, r);
            const cloneMat = cs.srcMat.clone();
            cloneMat.side = DoubleSide;
            cloneMat.needsUpdate = true;
            const m = new Mesh(geo, cloneMat);
            m.name = `fold-scrub-chrome-clip-${slice}`;
            const offA = clipCenterA - sliceCenterA;
            const offC = childCenterC - crossMid;
            if (horizontal) m.position.set(offA, offC, childZ - faceZ);
            else m.position.set(offC, offA, childZ - faceZ);
            panelMesh.add(m);
            recs.push({
              material: cloneMat,
              baseColor: cloneMat.color ? cloneMat.color.clone() : null,
              baseEmissive: cloneMat.emissive ? cloneMat.emissive.clone() : null,
              baseEmissiveIntensity: chromeEmissiveIntensity(cloneMat),
              panelIndex: -1,
              axisOffset: offA,
              halfAxis: clipW / 2,
            });
          }
          return recs;
        };

        // Center anchor: parked at its slice, directly in the fold group.
        const centerMade = makePanel(c, 0);
        const centerA = minA + (c + 0.5) * ps;
        if (horizontal) centerMade.mesh.position.set(centerA, crossMid, faceZ);
        else centerMade.mesh.position.set(crossMid, centerA, faceZ);
        foldGroup.add(centerMade.mesh);
        roots.push(centerMade.mesh);
        const centerSliceA0 = minA + c * ps;
        const centerSliceA1 = minA + (c + 1) * ps;
        const centerChrome = bakeChrome(
          centerMade.mesh,
          c,
          centerSliceA0,
          centerSliceA1,
          centerA,
        );
        const centerPanelIndex = panels.length;
        for (const ch of centerChrome) ch.panelIndex = centerPanelIndex;
        // Per-vertex normalized fold-axis coord in [-0.5, 0.5] (-0.5 = the
        // anchor's low-side crease, +0.5 = its high-side crease) — the gutter
        // shadow reads this to darken the band down BOTH creases of the anchor.
        const centerPos = centerMade.mesh.geometry.attributes.position;
        const centerGutterAxis = new Float32Array(centerPos.count);
        for (let i = 0; i < centerPos.count; i++) {
          const a = horizontal ? centerPos.getX(i) : centerPos.getY(i);
          centerGutterAxis[i] = a / ps; // [-0.5, 0.5]
        }
        // leftHinge/rightHinge are wired after the chains build (the adjacent
        // k=0 hinge of each chain). Recorded by index here, resolved below.
        panels.push({
          ...centerMade,
          own: null,
          ancestors: [],
          sliceMinA: centerSliceA0,
          sliceMaxA: centerSliceA1,
          chrome: centerChrome,
          gutterAxis: centerGutterAxis,
          leftHinge: null,
          rightHinge: null,
          panelSpan: ps,
          creaseSign: 0,
        });

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
        const chainMade: {
          made: ReturnType<typeof makePanel>;
          chainIdx: number;
          k: number;
          slice: number;
          sliceA0: number;
          sliceA1: number;
          sliceCenterA: number;
        }[] = [];

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
            const sliceA0 = minA + slice * ps;
            const sliceA1 = minA + (slice + 1) * ps;
            chainMade.push({
              made,
              chainIdx,
              k,
              slice,
              sliceA0,
              sliceA1,
              sliceCenterA: minA + (slice + 0.5) * ps,
            });
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
          const chrome = bakeChrome(
            cm.made.mesh,
            cm.slice,
            cm.sliceA0,
            cm.sliceA1,
            cm.sliceCenterA,
          );
          const panelIndex = panels.length;
          for (const ch of chrome) ch.panelIndex = panelIndex;
          // Chain 0 (low side) folds with hSide=−1 → crease at the slice's HIGH
          // local edge (creaseSign +1); chain 1 (high side) the inverse.
          const creaseSign: -1 | 1 = cm.chainIdx === 0 ? 1 : -1;
          panels.push({
            ...cm.made,
            own,
            ancestors,
            sliceMinA: cm.sliceA0,
            sliceMaxA: cm.sliceA1,
            chrome,
            gutterAxis: null,
            leftHinge: null,
            rightHinge: null,
            panelSpan: ps,
            creaseSign,
          });
        }

        // Wire the center anchor's adjacent crease hinges: the k=0 hinge of the
        // low chain (chain 0) casts the gutter onto the anchor's low edge, the
        // k=0 hinge of the high chain (chain 1) onto its high edge. Either may
        // be absent (bi-fold has only one chain) — the gutter side that has no
        // hinge simply stays lit.
        const anchorRec = panels[centerPanelIndex];
        anchorRec.leftHinge = byChainK.get('0:0') ?? null;
        anchorRec.rightHinge = byChainK.get('1:0') ?? null;
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

        // ── CONTACT SHADING ──────────────────────────────────────────────
        // Two cooperating effects, both multiplicative over each element's
        // snapshotted BASE look (never an invented tint), both clearing to
        // exactly base when flat (shade=0 OR no adjacent fold):
        //   1. CREASE shade on the folding leaf itself — per-vertex, darkest at
        //      the hinge, deepened by folded ancestors (unchanged math).
        //   2. BOOK-GUTTER contact shadow cast down BOTH sides of every active
        //      crease — onto the STATIONARY center anchor too. This is the
        //      dominant visible effect at the pinned engaged frame: the anchor
        //      band is the largest lit surface near the gutter, and the bright
        //      chrome (header/rows/dot) crossing it is the only place darkening
        //      reads on a near-black card.
        const shade = clamp(num(params.shade, 0.4), 0, 0.8);

        // Global fold engagement (max over hinges) — once ANY leaf folds the
        // whole spread sits in the fold's ambient shadow (the spine wash).
        let globalMaxDrive = 0;
        for (const h of hinges) globalMaxDrive = Math.max(globalMaxDrive, h.w);
        const spineAmbient = SPINE_AMBIENT * shade * globalMaxDrive;
        const spineAmbientEdge = SPINE_AMBIENT_EDGE * shade * globalMaxDrive;

        // Gutter strength at a crease, given normalized distance from it
        // (`distFrac`, 0 = AT the crease, in panel-span units) and the crease's
        // fold drive. A tight band: deepest at the crease, eased to 0 past the
        // reach. Folded into `shade` so it clears exactly when shade=0.
        const gutter = (distFrac: number, drive: number): number => {
          if (drive <= 0) return 0;
          const prox = clamp(1 - distFrac / GUTTER_REACH, 0, 1);
          if (prox <= 0) return 0;
          return shade * GUTTER_DEPTH * drive * Math.pow(prox, GUTTER_FALLOFF);
        };

        // Dim a panel's SELF-EMISSION by a broad shade factor (0 = no dim). On a
        // near-black emissive card the lit pixel is emissive-dominated, so this
        // is what makes the contact shadow read on the panel body. Multiplicative
        // over the snapshotted base — clears to base when dim = 0.
        const dimEmissive = (p: PanelRec, dim: number) => {
          if (p.baseEmissiveIntensity === null) return;
          const mat = p.material as unknown as { emissiveIntensity: number };
          const d = clamp(dim * EMISSIVE_DIM_BOOST, 0, EMISSIVE_DIM_CAP);
          mat.emissiveIntensity = p.baseEmissiveIntensity * (1 - d);
        };
        // Tint a chrome clip multiplicatively over its snapshotted base look —
        // color, emissive color, AND self-glow intensity (the bright header/
        // rows are emissive, so dimming intensity is what makes them read).
        const tintChrome = (ch: ChromeRec, mul: number) => {
          if (ch.baseColor && ch.material.color) {
            ch.material.color.copy(ch.baseColor).multiplyScalar(mul);
          }
          if (ch.baseEmissive && ch.material.emissive) {
            ch.material.emissive.copy(ch.baseEmissive).multiplyScalar(mul);
          }
          if (ch.baseEmissiveIntensity !== null) {
            (ch.material as unknown as { emissiveIntensity: number }).emissiveIntensity =
              ch.baseEmissiveIntensity * mul;
          }
        };

        for (const p of panels) {
          const span = p.panelSpan;

          if (p.own) {
            // ─ Folding leaf ─ per-vertex crease shade, PLUS a uniform body dim
            // (the whole leaf falls into shadow as it tilts away), plus the
            // gutter cast from its OWN crease onto its chrome near that crease.
            let anc = 0;
            for (const a of p.ancestors) anc = Math.max(anc, a.w);
            const drive = clamp(p.own.w + ANCESTOR_SHADE * anc, 0, 1);
            const k = shade * drive;
            // Whole-leaf dim: deepest the more it has folded — broad area, the
            // bulk of what makes shade visibly reshape the engaged frame.
            const bodyDim = LEAF_BODY_SHADE * shade * p.own.w;
            const attr = p.colorAttr;
            for (let i = 0; i < p.hFrac.length; i++) {
              const crease = k * (1 - SHADE_EDGE * p.hFrac[i]);
              // Spine wash: uniform, plus extra toward the seam-facing crease
              // (hFrac 0 = crease). Driven by the GLOBAL fold, so the far page
              // dims while its neighbour is folded shut.
              const spine = spineAmbient + spineAmbientEdge * (1 - p.hFrac[i]);
              const m = 1 - Math.max(crease, bodyDim, spine);
              attr.setXYZ(i, m, m, m);
            }
            attr.needsUpdate = true;
            // Dim the leaf's self-glow by the deepest broad shade it carries —
            // the panel body visibly falls into shadow, not just its diffuse.
            dimEmissive(p, Math.max(bodyDim, k * (1 - SHADE_EDGE), spineAmbient));

            // Leaf crease local coord: +span/2 (creaseSign +1) or −span/2.
            const creaseA = (p.creaseSign * span) / 2;
            const baseChromeMul = 1 - k * CHROME_SHADE_MID;
            for (const ch of p.chrome) {
              // Distance from the clip's NEAREST edge to the leaf's crease →
              // gutter on the bright chrome near the fold (boosted over the
              // matte panel), combined with the uniform leaf-shade factor.
              const dist =
                Math.max(Math.abs(ch.axisOffset - creaseA) - ch.halfAxis, 0) /
                Math.max(span, 1e-4);
              const g = Math.min(gutter(dist, p.own.w) * GUTTER_CHROME_BOOST, 0.92);
              const mul = Math.min(baseChromeMul, 1 - g, 1 - bodyDim, 1 - spineAmbient);
              tintChrome(ch, mul);
            }
            continue;
          }

          // ─ Center anchor ─ the gutter shadow's MAIN canvas. A broad uniform
          // BODY dim (the facing page falls into the folded leaf's ambient
          // occlusion — the largest area the shade control reshapes) PLUS the
          // gutter band down each active crease (low edge → leftHinge, high
          // edge → rightHinge), deeper at the seam. Per-vertex on the panel,
          // per-clip on the chrome.
          const leftDrive = p.leftHinge ? p.leftHinge.w : 0;
          const rightDrive = p.rightHinge ? p.rightHinge.w : 0;
          const anchorBody = ANCHOR_BODY_SHADE * shade * Math.max(leftDrive, rightDrive);
          const axis = p.gutterAxis;
          const attr = p.colorAttr;
          if (axis) {
            for (let i = 0; i < axis.length; i++) {
              const a = axis[i]; // [-0.5, 0.5]
              const gL = gutter(a + 0.5, leftDrive); // dist to low crease
              const gR = gutter(0.5 - a, rightDrive); // dist to high crease
              // Spine wash: uniform + extra toward EITHER crease (both edges
              // face the spine on the anchor).
              const spine = spineAmbient + spineAmbientEdge * clamp(1 - 2 * Math.abs(a), 0, 1);
              const m = 1 - Math.max(gL, gR, anchorBody, spine);
              attr.setXYZ(i, m, m, m);
            }
            attr.needsUpdate = true;
          }
          // Dim the anchor's self-glow by its broad body shade (the facing page
          // loses ambient light under the looming folded leaf).
          dimEmissive(p, Math.max(anchorBody, spineAmbient));
          // Anchor chrome (header/rows that cross into the gutter, the dot if
          // it sits here): darken by the body dim plus proximity of the clip's
          // nearest edge to each crease, boosted — this is where the brass/grey
          // visibly dims.
          for (const ch of p.chrome) {
            const half = ch.halfAxis;
            // Nearest edge toward each crease, normalized to the span.
            const loEdge = (ch.axisOffset - half + span / 2) / Math.max(span, 1e-4);
            const hiEdge = (span / 2 - (ch.axisOffset + half)) / Math.max(span, 1e-4);
            const gL = gutter(Math.max(loEdge, 0), leftDrive);
            const gR = gutter(Math.max(hiEdge, 0), rightDrive);
            const g = Math.min(
              Math.max(Math.max(gL, gR) * GUTTER_CHROME_BOOST, anchorBody, spineAmbient),
              0.92,
            );
            tintChrome(ch, 1 - g);
          }
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
