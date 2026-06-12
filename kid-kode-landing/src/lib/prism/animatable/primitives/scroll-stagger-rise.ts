// scroll-stagger-rise — THE SUBJECT ITSELF arrives in N staggered units as
// scroll advances, like list rows arriving. The units are built FROM the
// subject, never from placeholder quads, via a smartness-ordered fallback
// chain:
//
//   1. TEXTURE BANDS — the representative Mesh's material carries a texture
//      (.map): the subject is decomposed into N horizontal band planes whose
//      UVs window each band's horizontal slice of that texture (texture shared
//      by reference, one cloned material per band) so the settled rows visibly
//      reassemble the artifact's real appearance. The original subject is
//      hidden while the bands are active and restored by dispose(). The bands
//      live in a SIBLING group carrying the subject's exact local transform (a
//      hidden parent hides its children in three.js, so the bands cannot live
//      under the subject itself).
//
//      IN-CONTEXT HARDENING (P0 ORRERY, both probed live on orr-materia-brass):
//      (a) LATE TEXTURE POUR — mounted plane artifacts receive `.map`
//          ASYNCHRONOUSLY (default-factory pours it in a loadTexture().then(),
//          and applyImageSpec may re-clone the texture or swap the material
//          afterwards), while bindings attach synchronously at mount. Clones
//          taken at create are therefore permanently map-less → solid WHITE
//          bands (probed: subject map ready/version 2, bands map:null/white).
//          Fix: every seek re-reads the representative mesh's LIVE material;
//          when the material instance OR its map identity differs from what
//          the bands were built from, the bands rebuild from the live source
//          (UVs re-windowed, opacity re-based). A map-less artifact upgrades
//          to textured rows the moment its texture lands.
//      (b) LIVE TRANSFORM TRACKING — co-bindings (magnetic, scroll-rotate-3d,
//          pointer tilt …) keep animating the HIDDEN subject after create
//          (probed: band group froze mid page-turn ~35° off the subject's
//          live pose). Fix: every seek syncs the band group's
//          position/quaternion/scale to the subject's current local
//          transform, so the rows stay registered with a live-tilting
//          artifact.
//   2. CHILDREN AS ROWS — no map, but the subject has >= 2 child meshes (e.g.
//      the catalog card's header bar / accent dot / content rows): NOTHING is
//      spawned. The subject's OWN children are grouped into N arrival units
//      ordered top-to-bottom by their subject-local y (the `bands` knob
//      caps/merges units) and each unit rises (lift × subject height, from
//      below its settled pose) and fades 0→base opacity using the same
//      stagger/window reveal math. The subject's face mesh stays visible and
//      fades in across the first window — the card's real chrome arrives row
//      by row. Every touched transform/opacity/.transparent flag is
//      snapshotted at create and restored exactly on dispose (the same
//      snapshot/restore pattern scroll-depth-dolly uses).
//   3. COLOR BANDS — no map, no child chrome, but a plain colored mesh: band
//      planes clone the subject's own material (color/emissive/roughness
//      carried over — never an invented color). A flat colored thing
//      decomposing into flat colored rows is honest.
//   4. WHOLE-SUBJECT RISE — no measurable geometry or no material at all:
//      rise the whole subject group. Never placeholder quads.
//
// The subject's bounding box is measured (Box3, pulled back into the
// subject's own local frame) — band width/height/placement and the `lift`
// travel all derive from it, so the effect scales to ANY mounted artifact
// (no hardcoded world units; artifacts vary wildly in size).
//
// Scroll semantics (unchanged): each unit u reveals when scroll crosses its
// reveal point, then completes its arrival across a window; `stagger` widens
// the gap between successive units' reveal points so rows arrive one by one,
// `bands` chooses how many rows (structural rebuild/regroup via
// onParamChange), and `lift` sets how far each row travels — in MULTIPLES OF
// THE SUBJECT'S OWN HEIGHT. Reads userData.scroll live each seek; CPU-driven,
// deterministic, and observable (a unit's opacity & position.y change across
// scroll). Scroll/card/medium.
//
// DISTINCT from scroll-fade-stack (which fades/lifts the WHOLE card through
// one band): here the card is decomposed into independent rows that arrive in
// sequence.

import {
  Box3,
  Group,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { defineAnimatable } from '../base';
import { clamp, num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'bands', label: 'Bands', type: 'knob', min: 3, max: 8, step: 1, default: 5 },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.5, step: 0.01, default: 0.18 },
  { id: 'lift', label: 'Lift', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2 },
] as const;

/** Read the host-supplied scroll value (0..1), tolerant of shape. */
function readScroll(userData: Record<string, unknown>): number {
  const s = userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return 0.5;
}

/** The appearance source: the first Mesh descendant (or the subject itself
 *  when it is a Mesh). The subject may be a Group — traverse rather than
 *  assume Mesh. */
function findRepresentativeMesh(subject: Object3D): Mesh | null {
  let found: Mesh | null = null;
  subject.traverse((o) => {
    if (found) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.material) found = mesh;
  });
  return found;
}

interface MatSnap {
  mat: Material & { opacity: number };
  opacity: number;
  transparent: boolean;
}

/** Snapshot a mesh's material(s): opacity AND .transparent, so dispose can
 *  hand the artifact back exactly as it arrived. */
function snapshotMats(mesh: Mesh): MatSnap[] {
  const m = mesh.material;
  const list = Array.isArray(m) ? m : m ? [m] : [];
  return list.map((mat) => ({
    mat: mat as Material & { opacity: number },
    opacity: (mat as Material & { opacity: number }).opacity,
    transparent: mat.transparent,
  }));
}

/** Ease-out cubic — each row's arrival decelerates (deterministic). */
const easeOut = (w: number): number => 1 - (1 - w) ** 3;

export const scrollStaggerRisePrimitive: PrimitiveDefinition = {
  name: 'scroll-stagger-rise',
  label: 'Scroll Stagger Rise',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Bands of the card rise and fade in staggered as scroll advances, like list rows arriving one by one.',
  create: defineAnimatable(
    { name: 'scroll-stagger-rise', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      // ── Measure the subject in ITS OWN local frame ──────────────────────
      // Band geometry is positioned in that frame (the band group replicates
      // the subject's local transform under the same parent), so the world
      // bbox is pulled back through the inverse world matrix. NEVER hardcoded
      // world units — mounted artifacts vary wildly in size.
      subject.updateWorldMatrix(true, true);
      const worldBox = new Box3().setFromObject(subject);
      const invSubjectWorld = new Matrix4().copy(subject.matrixWorld).invert();
      /** World-AABB pulled back into the subject's local frame. NOTE: when the
       *  subject sits mid-rotation (page-turn conductor at mount), the AABB
       *  round-trip inflates the local Z extent — banded modes therefore
       *  RE-MEASURE inside buildBands (settled pose by the time the texture
       *  pour triggers a rebuild) so bands sit on the real face, not ~0.9
       *  units in front of it. */
      const measureLocalBox = (): Box3 | null => {
        subject.updateWorldMatrix(true, true);
        const wb = new Box3().setFromObject(subject);
        if (wb.isEmpty()) return null;
        return wb.applyMatrix4(new Matrix4().copy(subject.matrixWorld).invert());
      };
      let localBox = worldBox.isEmpty() ? null : worldBox.clone().applyMatrix4(invSubjectWorld);

      const repMesh = findRepresentativeMesh(subject);
      type MappedMaterial = Material & { map?: Texture | null };
      /** The representative mesh's CURRENT first material — read live, never
       *  cached: the mounted plane factory pours `.map` asynchronously and
       *  applyImageSpec may re-clone the texture or swap the material after
       *  this primitive attaches. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };
      const sourceMaterial: MappedMaterial | null = liveSourceMaterial();
      const srcMap = (sourceMaterial?.map as Texture | null | undefined) ?? null;

      // ── Collect the subject's child meshes (mode 2 candidates) ──────────
      // Every Mesh descendant EXCEPT the representative face mesh, with its
      // settled pose + material state snapshotted for exact restore. sortY is
      // the mesh's y in the SUBJECT's local frame (top-to-bottom ordering).
      interface ChildRec {
        mesh: Mesh;
        basePosition: Vector3;
        liftScale: number; // subject-local Y units → mesh-parent-local Y units
        mats: MatSnap[];
        sortY: number;
      }
      const childRecs: ChildRec[] = [];
      if (repMesh) {
        const subjectScaleY = Math.abs(subject.getWorldScale(new Vector3()).y) || 1;
        subject.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh || mesh === repMesh || !mesh.material) return;
          const sortY = mesh.getWorldPosition(new Vector3()).applyMatrix4(invSubjectWorld).y;
          const parentScaleY = mesh.parent
            ? Math.abs(mesh.parent.getWorldScale(new Vector3()).y)
            : 1;
          const liftScale =
            Number.isFinite(parentScaleY) && parentScaleY > 1e-6
              ? subjectScaleY / parentScaleY
              : 1;
          childRecs.push({
            mesh,
            basePosition: mesh.position.clone(),
            liftScale,
            mats: snapshotMats(mesh),
            sortY,
          });
        });
      }

      // ── Mode selection (fallback chain, smartest first) ──────────────────
      type Mode = 'texture-bands' | 'children' | 'color-bands' | 'rise';
      const canBand = Boolean(localBox && sourceMaterial && subject.parent);
      const mode: Mode =
        canBand && srcMap
          ? 'texture-bands'
          : localBox && repMesh && childRecs.length >= 2
            ? 'children'
            : canBand
              ? 'color-bands'
              : 'rise';
      const banded = mode === 'texture-bands' || mode === 'color-bands';

      const bandGroup = new Group();
      bandGroup.name = 'stagger-rise-bands';

      const prevVisible = subject.visible;
      const baseY = subject.position.y; // rise-mode restore point

      if (banded) {
        // Sibling of the subject, carrying its exact local transform, so the
        // bands occupy the subject's spot and co-move under outer transforms.
        bandGroup.position.copy(subject.position);
        bandGroup.quaternion.copy(subject.quaternion);
        bandGroup.scale.copy(subject.scale);
        subject.parent!.add(bandGroup);
        // The bands ARE the subject now — hide the original until dispose().
        subject.visible = false;
      }

      interface BandRec {
        mesh: Mesh;
        material: Material;
        baseOpacity: number;
        settledY: number;
      }
      let bands: BandRec[] = [];

      const disposeBands = () => {
        for (const b of bands) {
          bandGroup.remove(b.mesh);
          b.mesh.geometry.dispose();
          // Clones only — material.dispose() does NOT dispose the shared
          // texture, so the subject's own map survives untouched.
          b.material.dispose();
        }
        bands = [];
      };

      // What the current band set was built FROM — material instance + map
      // identity. apply() compares these against the live source each seek and
      // rebuilds when the async texture pour (or an imageSpec material swap /
      // texture re-clone) lands AFTER create.
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      const buildBands = (count: number) => {
        disposeBands();
        if (!banded || !localBox) return;
        // Re-measure: a create that ran mid page-turn inflated the local box's
        // Z extent (see measureLocalBox note); by rebuild time the pose has
        // settled and the bands land on the artifact's real face.
        const remeasured = measureLocalBox();
        if (remeasured) localBox = remeasured;
        const src = liveSourceMaterial();
        builtSrcMat = src;
        builtSrcMap = (src?.map as Texture | null | undefined) ?? null;
        if (!src) return;
        const map = builtSrcMap;

        const n = Math.max(1, Math.round(count));
        const width = localBox.max.x - localBox.min.x;
        const height = localBox.max.y - localBox.min.y;
        const cx = (localBox.min.x + localBox.max.x) / 2;
        const faceZ = localBox.max.z; // the artifact's front face
        const bandH = height / n; // contiguous rows reassemble the subject exactly
        const srcOpacity = src.opacity;
        const baseOpacity = srcOpacity > 0.01 ? srcOpacity : 1;

        for (let i = 0; i < n; i++) {
          // Clone the subject's OWN material: color/emissive/roughness/map all
          // carried over (the texture by reference); the original is never
          // mutated. No invented colors.
          const material = src.clone();
          material.transparent = true;
          material.opacity = 0;
          material.depthWrite = false;

          const geometry = new PlaneGeometry(width, bandH);
          if (map) {
            // Window this band's horizontal slice of the SHARED texture: band
            // i is the i-th row from the top; PlaneGeometry's v runs 0
            // (bottom) → 1 (top), so remap it into [1-(i+1)/n, 1-i/n].
            const v0 = 1 - (i + 1) / n;
            const v1 = 1 - i / n;
            const uv = geometry.attributes.uv;
            for (let k = 0; k < uv.count; k++) {
              uv.setY(k, v0 + uv.getY(k) * (v1 - v0));
            }
            uv.needsUpdate = true;
          }

          const mesh = new Mesh(geometry, material);
          // Top row first (i=0 highest), stacked contiguously down the bbox.
          const settledY = localBox.max.y - bandH / 2 - i * bandH;
          mesh.position.set(cx, settledY, faceZ);
          mesh.name = `stagger-band-${i}`;
          bandGroup.add(mesh);
          bands.push({ mesh, material, baseOpacity, settledY });
        }
      };

      // ── Mode 2 wiring: the subject's own children grouped into units ─────
      // Units are ordered top-to-bottom by subject-local y (stable sort —
      // collection order breaks ties deterministically); the `bands` knob
      // caps the unit count at the child count and merges adjacent children
      // into shared units when fewer units than children are requested.
      const sortedChildren =
        mode === 'children' ? [...childRecs].sort((a, b) => b.sortY - a.sortY) : [];
      // The face mesh anchors the rows: it stays visible and fades in across
      // the first window (opacity driven directly, snapshot/restore — the
      // scroll-depth-dolly pattern).
      const faceMats: MatSnap[] = mode === 'children' && repMesh ? snapshotMats(repMesh) : [];

      let units: ChildRec[][] = [];
      const groupUnits = (count: number) => {
        units = [];
        if (mode !== 'children') return;
        const total = sortedChildren.length;
        const n = Math.max(1, Math.min(Math.round(count), total));
        const base = Math.floor(total / n);
        const extra = total % n;
        let idx = 0;
        for (let i = 0; i < n; i++) {
          const size = base + (i < extra ? 1 : 0);
          units.push(sortedChildren.slice(idx, idx + size));
          idx += size;
        }
      };

      buildBands(num(params.bands, 5));
      groupUnits(num(params.bands, 5));

      const apply = (scroll: number) => {
        const stagger = clamp(num(params.stagger, 0.18), 0, 0.5);
        const lift = num(params.lift, 1.2);
        const height = localBox ? localBox.max.y - localBox.min.y : 0;

        if (banded) {
          // (b) LIVE TRANSFORM TRACKING — co-bindings keep animating the
          // hidden subject; re-register the band group on its CURRENT local
          // pose every call so the rows ride a live-tilting artifact instead
          // of freezing at the create-time pose.
          bandGroup.position.copy(subject.position);
          bandGroup.quaternion.copy(subject.quaternion);
          bandGroup.scale.copy(subject.scale);
          // (a) LATE TEXTURE POUR — the mounted artifact's material/map land
          // asynchronously; rebuild from the live source the moment either
          // identity changes (clones taken at create would stay map-less
          // white forever).
          const src = liveSourceMaterial();
          const liveMap = (src?.map as Texture | null | undefined) ?? null;
          if (src !== builtSrcMat || liveMap !== builtSrcMap) {
            buildBands(num(params.bands, 5));
          }
        }

        if (mode === 'rise') {
          // Fallback: nothing to decompose — rise the WHOLE subject instead
          // of spawning placeholder quads. Travel scales with the measured
          // height; a degenerate (unmeasurable) subject gets unit travel, the
          // only reference left.
          const ref = height > 1e-6 ? height : 1;
          subject.position.y = baseY - lift * ref * (1 - easeOut(clamp(scroll, 0, 1)));
          return;
        }

        if (mode === 'children') {
          const n = units.length;
          if (n === 0) return;
          const liftDist = lift * height; // subject-relative travel

          // Same reveal layout as the band modes: unit i starts at i*offset
          // and completes over `window`; the LAST unit finishes at scroll=1.
          const window = 1 / (1 + (n - 1) * stagger);
          const offset = stagger * window;

          // Face arrives across the FIRST window — visible scaffold for rows.
          const wFace = clamp(scroll / Math.max(1e-4, window), 0, 1);
          for (const snap of faceMats) {
            if (!snap.mat.transparent) snap.mat.transparent = true;
            snap.mat.opacity = wFace * snap.opacity;
          }

          for (let i = 0; i < n; i++) {
            const w = clamp((scroll - i * offset) / Math.max(1e-4, window), 0, 1);
            const drop = liftDist * (1 - easeOut(w));
            for (const rec of units[i]) {
              for (const snap of rec.mats) {
                if (!snap.mat.transparent) snap.mat.transparent = true;
                snap.mat.opacity = w * snap.opacity;
              }
              rec.mesh.position.y = rec.basePosition.y - drop * rec.liftScale;
            }
          }
          return;
        }

        // Band modes (texture-bands / color-bands).
        const n = bands.length;
        if (n === 0) return;
        const liftDist = lift * height; // subject-relative travel

        // Reveal layout (unchanged semantics): band i starts at i*offset and
        // completes over `window`; with offset = stagger*window the LAST band
        // finishes exactly at scroll=1 ⇒ window*(1 + (n-1)*stagger) = 1.
        const window = 1 / (1 + (n - 1) * stagger);
        const offset = stagger * window;

        for (let i = 0; i < n; i++) {
          const b = bands[i];
          const w = clamp((scroll - i * offset) / Math.max(1e-4, window), 0, 1);
          // Opacity ramps up to the SUBJECT'S own opacity; the rise eases out
          // so each row decelerates into place.
          b.material.opacity = w * b.baseOpacity;
          b.mesh.position.y = b.settledY - liftDist * (1 - easeOut(w));
        }
      };

      return {
        // Stateful, scroll-driven: animate continuously. Map the master clock
        // to a scroll sweep when no live host scroll is present so the tile
        // plays.
        duration: () => Infinity,
        seek: (t) => {
          const ud = target.userData;
          const hasScroll = typeof ud.scroll === 'number' && Number.isFinite(ud.scroll as number);
          const scroll = hasScroll ? readScroll(ud) : clamp((t % 4) / 4, 0, 1);
          apply(scroll);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id !== 'bands') return;
          if (banded) buildBands(num(value, 5));
          else if (mode === 'children') groupUnits(num(value, 5));
        },
        dispose: () => {
          disposeBands();
          if (bandGroup.parent) bandGroup.parent.remove(bandGroup);
          if (banded) {
            subject.visible = prevVisible;
          } else if (mode === 'children') {
            // Hand every touched child + the face back EXACTLY as found.
            for (const rec of childRecs) {
              rec.mesh.position.copy(rec.basePosition);
              for (const snap of rec.mats) {
                snap.mat.opacity = snap.opacity;
                snap.mat.transparent = snap.transparent;
              }
            }
            for (const snap of faceMats) {
              snap.mat.opacity = snap.opacity;
              snap.mat.transparent = snap.transparent;
            }
          } else {
            subject.position.y = baseY;
          }
        },
      };
    },
  ),
};
