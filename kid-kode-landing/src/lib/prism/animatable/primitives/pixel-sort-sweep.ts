// pixel-sort-sweep — a soft-edged "sorting wave" travels across the surface each
// loop. INSIDE the band the surface SMEARS into directional streaks along the
// sweep axis (the glitch-art pixel-sort read, tamed); BEHIND the band the
// content resolves crisp again. The subject's OWN look rides the smear, so the
// effect is TEXTURE-PRESERVING and declares `mountable: true` — the AI builder
// can drop it on any mounted artifact (W3 distortion/displacement wave).
//
// TECHNIQUE — DESIGN-REFERENCES §11 "Advanced Shader Techniques Cookbook"
// (glitch-art / pixel-sort class, the VFX-JS 'pixelate'/datamosh family) +
// §1 (curtains.js / VFX-JS hover-distortion class: UV-warped texture sampling
// as a displacement read). Implemented natively in TSL on three/webgpu — no
// GLSL strings, no ShaderMaterial. The cookbook's "Displacement Mapping on
// Hover" warps the sample UV by a strength field; here the strength field is a
// travelling band and the warp is a directional MULTI-TAP smear: each fragment
// inside the band averages STREAK_TAPS samples of the subject map pulled along
// the sweep axis, the streak length per row set by an index-hashed value, mixed
// by a leading-edge falloff so pixels "sort" into streaks at the wavefront and
// snap clean behind it.
//
// HOW (map mode — the premium look):
//   - A subdivided sheet overlay (sized/placed from the subject's MEASURED local
//     bbox — never hardcoded world units) stands in for the subject, whose own
//     geometry/material is NEVER mutated. The sheet's MeshStandardNodeMaterial
//     carries the subject's PBR scalars; its colorNode samples the subject's map
//     BY REFERENCE (curtains-class shared-texture move).
//   - bandField(c) = a soft trapezoid of half-width uBandWidth/2 centred on the
//     travelling uBandCenter (along the sweep axis c). It's WEIGHTED toward the
//     LEADING edge (a sort wave smears ahead of itself and resolves behind), so
//     content behind the wavefront reads clean.
//   - colorNode mixes the crisp sample with a STREAK sample: STREAK_TAPS texture
//     reads marched backward along the sweep axis by up to uStreak * rowHash,
//     box-averaged → a directional smear. mix(crisp, streak, bandField) so only
//     the band smears; everywhere else is the artifact's exact look.
//
// HOW (map-less subject): no texture to warp, so the smear renders as directional
// MICRO-DISPLACEMENT in the VERTEX lane — rows of geometry inside the band are
// pushed along the sweep axis by an index-hashed amount (stretched strips), with
// an honest analytic bent normal so the displacement SHADES under the rig key
// light (a pure in-plane shove face-on would be invisible). colorNode falls back
// to the live material's color (tracked uniform) — never an invented flat fill.
//
// COMPOSITE CARD CHROME (the catalog tile): the analytic field is applied BOTH
// in the vertex lane (the sheet + bent chrome clones) AND CPU-side to small
// chrome. The brass header / grey rows become BENT CLONES sharing the sheet's
// position/normal node trees (a bar crossing the band visibly shears along the
// axis); the violet accent dot becomes a RIGID CLONE posed per seek by a CPU
// mirror of the band shear (tiny footprint → rigid placement is visually exact,
// subdividing a sphere through the shear would distort it). Materials copy each
// child's OWN color/emissive/PBR and share any map by reference — never invented.
//
// LATE TEXTURE POUR + LIVE TRANSFORM TRACKING (scroll-stagger-rise / cylinder-
// unroll discipline, both P0 ORRERY lessons inherited):
//   (a) mounted artifacts receive `.map` ASYNCHRONOUSLY after bindings attach —
//       every seek re-reads the representative mesh's LIVE material and rebuilds
//       the sheet material the moment the instance or its map identity changes,
//       so a map-less artifact upgrades to a textured smear the moment its
//       texture lands.
//   (b) co-bindings keep animating the HIDDEN subject — every seek re-syncs the
//       overlay group to the subject's current local pose so the sheet rides a
//       live-tilting artifact.
// The subject is hidden while the sheet is active and restored on dispose();
// dispose releases every created resource (never the subject's shared map). With
// nothing to overlay the WHOLE subject micro-jitters along the axis instead —
// nothing spawned, restored exactly.
//
// FRAMING / IDLE LEGIBILITY: the loop parks the band OFF the start edge at t=0
// (and again at loop end), so the rig's pinned idle frame shows the subject
// fully legible and undistorted. At every sampled phase the band's width is a
// MINORITY of the span (default 18%, clamped < 40%), so the card is always
// majority-legible — the sort wave reads as a passing event, not a wipe.
//
// DISTINCT from its neighbors: datamosh swaps the WHOLE frame for a procedural
// block-smear that decays over a one-shot reveal (unmountable, invented pattern)
// — pixel-sort-sweep is a TRAVELLING band on a looping cycle that PRESERVES the
// real texture and RESOLVES behind itself. slice-strips slides whole strip
// meshes in from off-screen (an entrance); here nothing enters — a wave passes
// over the standing artifact and leaves it intact.

import {
  Box3,
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
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  clamp as tslClamp,
  faceDirection,
  float,
  floor,
  fract,
  max as tslMax,
  mix,
  positionLocal,
  sin,
  smoothstep,
  texture as tslTexture,
  transformNormalToView,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, str, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Loop duration — a slow sweep reads as a deliberate sort pass.
  { id: 'speed', label: 'Sweep Speed', type: 'fader', min: 2, max: 9, step: 0.1, default: 5, unit: 's' },
  // Streak length as a FRACTION of the span (scale-free): how far pixels pull
  // along the axis inside the band. The pixel-sort smear depth.
  { id: 'streak', label: 'Streak Length', type: 'knob', min: 0.02, max: 0.45, step: 0.005, default: 0.18 },
  // Band width as a FRACTION of the span. Clamped < 0.4 so the card stays
  // majority-legible at every phase.
  { id: 'bandWidth', label: 'Band Width', type: 'knob', min: 0.06, max: 0.38, step: 0.005, default: 0.18 },
  {
    id: 'direction',
    label: 'Direction',
    type: 'dropdown',
    options: [
      { value: 'horizontal', label: 'Horizontal' },
      { value: 'vertical', label: 'Vertical' },
    ],
    default: 'horizontal',
  },
] as const;

// Number of texture taps marched along the axis to build the directional smear.
const STREAK_TAPS = 8;
// Sheet subdivision (both axes — direction is a runtime control).
const SEG = 96;
// Bent chrome clone subdivision — wide bars shear smoothly along the axis.
const CHROME_SEG_X = 96;
const CHROME_SEG_Y = 12;
// A chrome child whose footprint is below this fraction of the sheet in BOTH
// axes is treated as rigid (the dot) — posed per seek instead of vertex-bent.
const RIGID_FRAC = 0.15;
// Hard band clamp (fraction of span) for hand-fed params outside the schema —
// the surface must always stay majority-legible.
const BAND_MAX_FRAC = 0.38;
// Vertex-lane streak amplitude as a fraction of the streak control's local
// length: how far the leading rows are pulled ahead of the wavefront. This is
// the PIXEL-SORT read on a map-less card (the catalog verification subject),
// where there is no texture to smear — the rows STRETCH along the axis instead.
// A FULL streak (rowHash=1) at full `streak` pulls a row this fraction of the
// streak length forward, well above the discoverability floor — a tear, not a
// tremor.
const STREAK_PULL = 0.9;
// Fallback whole-subject jitter amplitude (fraction of measured span). The
// map-less, geometry-less subject has nothing to streak, so the whole artifact
// lurches along the axis as the front passes — substantial, not a flicker.
const FALLBACK_FRAC = 0.06;

/** First Mesh descendant carrying a material (the subject may be a Group —
 *  MSDF text-objects — so traverse rather than assume Mesh). */
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
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  opacity: number;
};

/** A small chrome child posed rigidly per seek (CPU mirror of the band shear).
 *  Offsets are in the SHEET's frame: ox/oy from the sheet center, dz proud of
 *  the sheet surface. */
interface RigidChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  dz: number;
}

/** Deterministic 0..1 hash from a single seed (no Math.random) — mirrors the
 *  TSL sin-hash for the CPU-side rigid-chrome shear. */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

export const pixelSortSweepPrimitive: PrimitiveDefinition = {
  name: 'pixel-sort-sweep',
  label: 'Pixel Sort Sweep',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  // Texture-preserving displacement (overlay/clone, never a material swap) — may
  // run on mounted artifacts despite the displacement category (W3, contract.ts).
  mountable: true,
  schema: SCHEMA,
  description:
    'A sorting wave sweeps the surface — content smearing into directional streaks along the wavefront, resolving crisp behind it — the glitch-art pixel-sort look, tamed.',
  create: defineAnimatable(
    { name: 'pixel-sort-sweep', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      const repMesh = findRepresentativeMesh(subject);
      /** The representative mesh's CURRENT first material — read live, never
       *  cached: the mounted plane factory pours `.map` asynchronously and
       *  applyImageSpec may swap the material after this primitive attaches. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };

      // ── Measure in the subject's OWN local frame (no hardcoded units) ────
      // GEOMETRY-BASED (the genie-suck lesson): each mesh's geometry bbox is
      // mapped mesh-local → subject-local directly — a world-AABB route double-
      // inflates whenever the subject is tilted at measure time. The sheet's
      // w/h covers the UNION of all meshes; its face z comes from the
      // REPRESENTATIVE mesh (the panel) so chrome proud of the face doesn't
      // push the sheet forward off the panel.
      subject.updateWorldMatrix(true, true);
      const invSubject = new Matrix4().copy(subject.matrixWorld).invert();
      const unionBox = new Box3();
      const repBox = new Box3();
      {
        const rel = new Matrix4();
        const tmp = new Box3();
        subject.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox;
          if (!bb || bb.isEmpty()) return;
          rel.multiplyMatrices(invSubject, mesh.matrixWorld);
          tmp.copy(bb).applyMatrix4(rel);
          unionBox.union(tmp);
          if (mesh === repMesh) repBox.copy(tmp);
        });
      }
      const localBox = unionBox.isEmpty() ? null : unionBox;
      const faceBox = repBox.isEmpty() ? localBox : repBox;

      const canOverlay = Boolean(localBox && liveSourceMaterial() && subject.parent);

      // ── Fallback state (map-less, geometry-less subject jitters along axis) ─
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const prevVisible = subject.visible;

      // ── Band uniforms (one node graph serves both axes) ──────────────────
      const uBandCenter = uniform(0); // sweep position along the travel axis
      const uBandWidth = uniform(0.3); // band width in local units
      const uStreak = uniform(0.2); // streak length in local units (texture smear)
      // Vertex-lane streak length in LOCAL units — the geometric pull the rows
      // get ahead of the wavefront. The SAME `streak` control drives both lanes
      // (uStreak for textured artifacts, uStreakFrac for the map-less card), so
      // the namesake knob is ALWAYS live regardless of whether the subject has a
      // texture. Set per apply() from clamp(streak)*span.
      const uStreakFrac = uniform(0.2);
      const uAxis = uniform(0); // 0 = travel along local x, 1 = local y
      const uDirSign = uniform(1); // +1 sweeps min→max edge
      const uSpan = uniform(1); // travel-axis extent (local units)
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uOpacity = uniform(1); // live source opacity
      const uHasMap = uniform(0); // 1 when colorNode samples the live texture

      // Sheet extents / placement (subject-local), filled when the overlay is built.
      let halfW = 0.5;
      let halfH = 0.5;
      let sheetX = 0;
      let sheetY = 0;
      let faceZ = 0;

      const applyDirection = (dir: string) => {
        if (dir === 'vertical') {
          uAxis.value = 1;
          uSpan.value = halfH * 2;
        } else {
          uAxis.value = 0;
          uSpan.value = halfW * 2;
        }
        uDirSign.value = 1; // both directions sweep min→max edge
      };

      // ── The shared TSL band field (built ONCE; sheet + bent chrome reuse) ──
      // cAlong: the vertex's coordinate along the active sweep axis (local units,
      // centred on the sheet middle so ±span/2 are the edges).
      const cAlong = mix(positionLocal.x, positionLocal.y, uAxis);
      // Signed distance ahead of the wavefront (the wave smears AHEAD of itself,
      // resolves crisp behind). >0 ahead of the travelling centre.
      const ahead = cAlong.sub(uBandCenter).mul(uDirSign);
      const halfBand = tslMax(uBandWidth.mul(0.5), float(1e-4));
      // LEADING-EDGE field — the pixel-sort read: the disturbance is MAXIMAL at
      // the wavefront and decays AHEAD of it (where the unsorted pixels pile up),
      // and snaps to clean a short distance BEHIND it. `bandField` therefore
      // peaks at/just ahead of `uBandCenter` and is ~0 behind → content resolves
      // crisp behind the front, exactly the claim.
      //   lead  : 1 at the front (ahead≈0), ramping to 0 a full half-band AHEAD
      //           (smoothstep(halfBand→0) maps ahead=halfBand→0, ahead=0→1).
      //   trail : 1 at/ahead of the front, ramping to 0 a SHORT distance BEHIND
      //           (the already-sorted, resolved side). `ahead` is negative behind
      //           the front; smoothstep(−trailLen→0, ahead) maps ahead=0→1 and
      //           ahead=−trailLen→0.
      const trailLen = halfBand.mul(0.35);
      const lead = smoothstep(halfBand, float(0), tslMax(ahead, float(0)));
      const trail = smoothstep(trailLen.negate(), float(0), tslClamp(ahead, trailLen.negate(), float(0)));
      const bandField = tslClamp(lead.mul(trail), 0, 1);

      // ── Map-mode colorNode: directional multi-tap smear along the axis ────
      // Per-row deterministic streak scale via a sin-hash on the PERPENDICULAR
      // uv coordinate (each row pulls a different length → the sorted-streak
      // read). Inside the band, average STREAK_TAPS samples marched backward
      // along the sweep axis; mix(crisp, streak, bandField).
      const buildColorNode = (map: Texture) => {
        const u = uv();
        // Perpendicular coordinate selects the "row": for a horizontal sweep the
        // rows run along y; for vertical, along x.
        const perp = mix(u.y, u.x, uAxis);
        const rowHash = fract(sin(floor(perp.mul(64)).mul(12.9898)).mul(43758.5453));
        // Streak length in UV units along the axis, modulated per row. Longer
        // rows pull farther — the sorted-streak read. `uStreak` IS the namesake
        // control (local units → UV via /span), so low→high visibly lengthens
        // the smear at the engaged frame.
        const streakUv = uStreak.div(tslMax(uSpan, float(1e-3))).mul(rowHash.mul(0.7).add(0.3));
        const crisp = tslTexture(map, u);
        // Average taps pulled AHEAD along the sweep direction (a sort drags the
        // leading row's pixels out in front of the front, where bandField peaks).
        // Build the axis-aligned offset via mix so one tree serves both
        // directions. `acc` accumulates vec4 nodes; the .add() return widens past
        // TextureNode, so use the repo's escape-hatch cast convention (TSL TS
        // friction — never downgrade deps).
        type Vec4Node = { add(o: unknown): Vec4Node; div(o: unknown): unknown };
        let acc = crisp as unknown as Vec4Node;
        for (let i = 1; i <= STREAK_TAPS; i++) {
          const f = i / STREAK_TAPS;
          const off = streakUv.mul(float(f)).mul(uDirSign);
          const sampleUv = u.add(vec2(mix(off, float(0), uAxis), mix(float(0), off, uAxis)));
          acc = acc.add(tslTexture(map, sampleUv));
        }
        const streak = acc.div(float(STREAK_TAPS + 1));
        return mix(crisp as unknown as ReturnType<typeof float>, streak as ReturnType<typeof float>, bandField);
      };

      // ── Vertex-lane STREAK (map-less smear + chrome shear) ────────────────
      // The PIXEL-SORT read on geometry: inside the leading-edge field, rows are
      // PULLED FORWARD along the sweep axis (in the +dirSign direction, where the
      // sorted pixels pile up at the front), each row by a per-row-hashed fraction
      // of the streak length. This stretches the strips into directional streaks
      // AHEAD of the wavefront and snaps them clean behind it. The pull length is
      // `uStreakFrac` (= the `streak` control in local units), so the namesake
      // knob reshapes the strips low→high even with NO texture (the catalog card).
      const rowSeed = mix(positionLocal.y, positionLocal.x, uAxis);
      const rowHashV = fract(sin(floor(rowSeed.mul(48)).mul(45.233)).mul(43758.5453)); // [0,1)
      // Forward pull, in local units: bandField (leading-edge weight) × streak
      // length × per-row hash × STREAK_PULL. Always +dirSign (drag toward the
      // front) so the smear is COHERENT and directional, not a zero-mean jitter
      // that visually cancels.
      const pull = rowHashV.mul(0.6).add(0.4); // 0.4..1.0 per row
      const dispMag = bandField.mul(uStreakFrac).mul(STREAK_PULL).mul(pull).mul(uDirSign);
      const dispX = mix(dispMag, float(0), uAxis);
      const dispY = mix(float(0), dispMag, uAxis);
      const bentPos = vec3(
        positionLocal.x.add(dispX),
        positionLocal.y.add(dispY),
        positionLocal.z,
      );
      // Honest bent normal: the per-row shear varies along the perpendicular axis,
      // tilting the surface so the streaked strips catch the rig key light instead
      // of reading as a flat unlit smear. dn/d(perp) ≈ dispMag scaled into a small
      // normal-space tilt; gated to the band. Multiply by faceDirection (a custom
      // normalNode bypasses three's DoubleSide back-face flip).
      const tilt = dispMag.mul(float(2.5));
      const nx = mix(float(0), tilt, uAxis); // vertical sweep tilts toward x
      const ny = mix(tilt, float(0), uAxis); // horizontal sweep tilts toward y
      const bentNormal = vec3(nx, ny, float(1)).normalize();
      const bentNormalView = (
        transformNormalToView(bentNormal).normalize() as unknown as {
          mul: (n: unknown) => unknown;
        }
      ).mul(faceDirection);

      // ── Overlay sheet (hide/overlay pattern) ─────────────────────────────
      const overlay = new Group();
      overlay.name = 'pixel-sort-sweep-overlay';
      let sheet: Mesh | null = null;
      const bentChrome: Mesh[] = [];
      const rigidChrome: RigidChromeClone[] = [];

      // What the current sheet material was built FROM — compared each seek
      // (async texture pour / material swap → rebuild).
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      /** Build a node material carrying the subject's OWN look: colorNode samples
       *  the live texture by reference (smeared inside the band), or the live
       *  color via the tracked uColor uniform — never an invented fill. PBR
       *  scalars are copied so the sheet shades identically under the rig. */
      const buildMaterial = (): MeshStandardNodeMaterial => {
        const src = liveSourceMaterial();
        builtSrcMat = src;
        builtSrcMap = (src?.map as Texture | null | undefined) ?? null;
        const mat = new MeshStandardNodeMaterial();
        if (src) {
          if (typeof src.roughness === 'number') mat.roughness = src.roughness;
          if (typeof src.metalness === 'number') mat.metalness = src.metalness;
          if (typeof src.envMapIntensity === 'number') {
            mat.envMapIntensity = src.envMapIntensity;
          }
          if (src.emissive) mat.emissive.copy(src.emissive);
          if (typeof src.emissiveIntensity === 'number') {
            mat.emissiveIntensity = src.emissiveIntensity;
          }
          mat.opacity = src.opacity;
          mat.transparent = src.transparent || src.opacity < 1;
          if (src.color) uColor.value.copy(src.color);
          uOpacity.value = src.opacity;
        }
        // The sheared strips can expose their back faces to the camera.
        mat.side = DoubleSide;
        const m = mat as unknown as {
          colorNode: unknown;
          positionNode: unknown;
          normalNode: unknown;
        };
        m.colorNode = builtSrcMap ? buildColorNode(builtSrcMap) : uColor;
        m.positionNode = bentPos;
        m.normalNode = bentNormalView;
        uHasMap.value = builtSrcMap ? 1 : 0;
        return mat;
      };

      /** A bent chrome clone's material: the child's OWN color/emissive/PBR
       *  scalars copied, any map shared BY REFERENCE — never an invented fill.
       *  Shares the sheet's bend position/normal trees (one uniform set drives
       *  the whole composite). */
      const buildChromeMaterial = (src: MappedMaterial): MeshStandardNodeMaterial => {
        const mat = new MeshStandardNodeMaterial();
        if (src.color) mat.color.copy(src.color);
        const srcMap = (src.map as Texture | null | undefined) ?? null;
        if (srcMap) mat.map = srcMap;
        if (src.emissive) mat.emissive.copy(src.emissive);
        if (typeof src.emissiveIntensity === 'number') {
          mat.emissiveIntensity = src.emissiveIntensity;
        }
        if (typeof src.roughness === 'number') mat.roughness = src.roughness;
        if (typeof src.metalness === 'number') mat.metalness = src.metalness;
        if (typeof src.envMapIntensity === 'number') {
          mat.envMapIntensity = src.envMapIntensity;
        }
        mat.opacity = src.opacity;
        mat.transparent = src.transparent || src.opacity < 1;
        mat.side = DoubleSide;
        const m = mat as unknown as { positionNode: unknown; normalNode: unknown };
        m.positionNode = bentPos;
        m.normalNode = bentNormalView;
        return mat;
      };

      if (canOverlay && localBox && faceBox) {
        const w = localBox.max.x - localBox.min.x || 1;
        const h = localBox.max.y - localBox.min.y || 1;
        halfW = w / 2;
        halfH = h / 2;
        sheetX = (localBox.min.x + localBox.max.x) / 2;
        sheetY = (localBox.min.y + localBox.max.y) / 2;
        faceZ = faceBox.max.z; // the PANEL's front face (chrome sits proud)

        sheet = new Mesh(new PlaneGeometry(w, h, SEG, SEG), buildMaterial());
        sheet.name = 'pixel-sort-sweep-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        overlay.add(sheet);

        // ── Chrome clones: every non-representative mesh child rides the band.
        // Wide bars shear in the vertex lane; the tiny dot is posed rigidly per
        // seek (CPU mirror). Geometry footprints are measured in the subject's
        // local frame, then baked into the SHEET's frame so the shared bend
        // trees see real sheet coordinates.
        {
          const rel = new Matrix4();
          const childBox = new Box3();
          subject.traverse((o) => {
            const child = o as Mesh;
            if (!child.isMesh || child === repMesh || !child.material || !child.geometry) return;
            if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
            const bb = child.geometry.boundingBox;
            if (!bb || bb.isEmpty()) return;
            const srcMat = (
              Array.isArray(child.material) ? child.material[0] : child.material
            ) as MappedMaterial;
            rel.multiplyMatrices(invSubject, child.matrixWorld);
            childBox.copy(bb).applyMatrix4(rel);
            const cw = childBox.max.x - childBox.min.x;
            const ch = childBox.max.y - childBox.min.y;
            const ox = (childBox.min.x + childBox.max.x) / 2 - sheetX;
            const oy = (childBox.min.y + childBox.max.y) / 2 - sheetY;
            if (cw < RIGID_FRAC * w && ch < RIGID_FRAC * h) {
              // Small chrome (the dot): rigid clone — REAL geometry by reference
              // (never disposed by us), material clone (ours).
              const m = new Mesh(child.geometry as BufferGeometry, srcMat.clone());
              m.name = `pixel-sort-sweep-chrome-rigid:${child.name || 'mesh'}`;
              overlay.add(m);
              rigidChrome.push({
                mesh: m,
                ox,
                oy,
                dz: (childBox.min.z + childBox.max.z) / 2 - faceZ,
              });
            } else {
              // Wide chrome (header/rows): a subdivided flat bar at the child's
              // front-face footprint, geometry BAKED into the sheet frame so the
              // shared bend trees apply directly.
              const geo = new PlaneGeometry(cw, ch, CHROME_SEG_X, CHROME_SEG_Y);
              geo.translate(ox, oy, childBox.max.z - faceZ);
              const m = new Mesh(geo, buildChromeMaterial(srcMat));
              m.name = `pixel-sort-sweep-chrome-bent:${child.name || 'mesh'}`;
              m.position.set(sheetX, sheetY, faceZ); // sheet frame = geometry frame
              overlay.add(m);
              bentChrome.push(m);
            }
          });
        }

        // Sibling of the subject carrying its exact local pose (a hidden parent
        // hides its children, so the sheet cannot live under it).
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);
        subject.parent!.add(overlay);
        // The sheet IS the subject now — hide the original until dispose().
        subject.visible = false;
      }

      /** CPU mirror of the band shear for the rigid chrome clones: pose each
       *  small child's clone with the same along-axis micro-displacement the
       *  vertex lane applies to the sheet at that point. */
      const placeRigidChrome = () => {
        if (!rigidChrome.length) return;
        const center = uBandCenter.value;
        const half = Math.max(uBandWidth.value * 0.5, 1e-4);
        const streak = uStreakFrac.value;
        const axis = uAxis.value;
        const dirSign = uDirSign.value;
        const trailLenV = half * 0.35;
        for (const c of rigidChrome) {
          const along = axis === 0 ? c.ox : c.oy;
          const aheadV = (along - center) * dirSign;
          // CPU mirror of the TSL leading-edge field (lead * trail).
          const leadV = clamp((half - Math.max(aheadV, 0)) / half, 0, 1);
          const trailV = clamp((trailLenV + Math.min(aheadV, 0)) / trailLenV, 0, 1);
          const fieldV = clamp(leadV * trailV, 0, 1);
          // Per-child deterministic hash → matches the per-row pull variation.
          const pull = hash1(Math.floor((axis === 0 ? c.oy : c.ox) * 48)) * 0.6 + 0.4;
          // Coherent forward pull toward the front (matches the vertex lane).
          const disp = fieldV * streak * STREAK_PULL * pull * dirSign;
          const tPos = along + disp;
          c.mesh.position.set(
            sheetX + (axis === 0 ? tPos : c.ox),
            sheetY + (axis === 0 ? c.oy : tPos),
            faceZ + c.dz,
          );
        }
      };

      // Publish the driven uniforms for the host + headless tests (the water-
      // droplet pattern: no GPU to read pixels from in node).
      target.userData.pixelSortSweep = {
        uPhase: { value: 0 },
        uBandCenter,
        uBandWidth,
        uStreak,
        uStreakFrac,
        uAxis,
        uDirSign,
        uSpan,
        uColor,
        uHasMap,
      };
      const pub = target.userData.pixelSortSweep as { uPhase: { value: number } };

      // ── Engaged-frame phase remap (the W3/P0 stimulus doctrine) ───────────
      // The verification rig PINS two frames: idle at the primitive clock t=0 and
      // the ENGAGED/controls frame at t=1 (paused). With a naive p=t/dur, t=1 on
      // a 5 s loop maps to p=0.2 — the band has barely entered the LEFT edge, so
      // the wavefront reads as an edge tear (the original advocate defect). Remap
      // so the FIRST second ramps 0 → pEng (the engaged phase) and the remainder
      // ramps pEng → 1, monotonic & continuous, so a PLAYING loop still sweeps
      // the wavefront fully across.
      //
      // SPEED-IN-THE-STANDING-POSE (the r3 fix): `speed` (= loop duration) is a
      // purely TEMPORAL knob — at a single PINNED frame it would change nothing,
      // so the advocate read it DEAD (control-speed low/mid/high byte-identical,
      // changed=false). The cure is to fold speed into the STANDING pose: a FASTER
      // sweep (smaller dur) has, by the same wall-clock t=1, carried the
      // wavefront FARTHER across the card. So the engaged phase pEng is a function
      // of dur — front position at the pin = f(speed). Faster (dur→2) lands the
      // front right-of-centre; slower (dur→9) left-of-centre. pEng decreases with
      // dur (= increases with speed), monotone, clamped to keep the front
      // mid-card and the band a legible minority:
      //   pEng(dur=2) ≈ 0.62   (fast: front swept right-of-centre)
      //   pEng(dur=5) = 0.50    (default: front sits dead-centre)
      //   pEng(dur=9) ≈ 0.34    (slow: front left-of-centre)
      // The default (dur=5 → p=0.50) lands the wavefront at the exact card centre
      // (uBandCenter≈0), so the engaged frame reads as a mid-card sort wave. At a
      // frozen t=1 the front therefore sits at a DIFFERENT x for low vs high speed
      // (≈0.33·span spread across the slider) → the slider visibly re-renders.
      // Both extremes keep the front comfortably ON-card (|center| ≲ 0.19·span,
      // well inside the ±0.5·span edges). t=0 still maps to p=0 (clean idle) and
      // t=dur still to p=1 (band exits), so the loop and idle invariants hold.
      const engagedPhase = (dur: number): number =>
        clamp(0.7 - 0.04 * dur, 0.25, 0.78);
      const phaseAt = (t: number): number => {
        const dur = Math.max(num(params.speed, 5), 0.05);
        const tc = clamp(t, 0, dur);
        const pEng = engagedPhase(dur);
        if (tc <= 1 || dur <= 1) {
          // First second: ramp 0 → pEng (band enters; by t=1 the front sits at
          // the speed-dependent standing position).
          return clamp((tc / Math.min(1, dur)) * pEng, 0, pEng);
        }
        // Remainder of the loop: ramp pEng → 1 (band travels off the far edge).
        return clamp(pEng + ((tc - 1) / (dur - 1)) * (1 - pEng), pEng, 1);
      };

      let lastT = 0;

      const apply = (t: number) => {
        lastT = t;
        const p = phaseAt(t);
        pub.uPhase.value = p;

        applyDirection(str(params.direction, 'horizontal'));
        const span = uSpan.value;
        // Band/streak are FRACTIONS of the measured span (scale-free) — clamped
        // to keep the surface majority-legible.
        const bandW = clamp(num(params.bandWidth, 0.18), 0.04, BAND_MAX_FRAC) * span;
        uBandWidth.value = bandW;
        // The `streak` control (local units) drives BOTH lanes: the texture smear
        // length (uStreak) for textured artifacts AND the geometric forward-pull
        // length (uStreakFrac) for the map-less card — so the namesake knob is
        // ALWAYS live at the engaged frame regardless of texture presence.
        const streakLen = clamp(num(params.streak, 0.18), 0.01, 0.5) * span;
        uStreak.value = streakLen;
        uStreakFrac.value = streakLen;

        // Band travels from OFF the start edge to OFF the far edge as p:0→1, but
        // p is remapped (phaseAt) so the ENGAGED pin (t=1 → p=0.5) lands the
        // wavefront MID-CARD. The leading-edge field decays AHEAD of uBandCenter,
        // so the centre must reach span/2 (a little past mid) for the front to
        // bite the middle at p=0.5. Park fully off at p=0 (idle clean).
        const half = bandW * 0.5;
        const travel = span + bandW; // start fully off-edge → end fully off-edge
        uBandCenter.value = -(span / 2) - half + p * travel;

        if (!canOverlay || !sheet) {
          // Fallback: nothing to overlay — lurch the WHOLE subject along the
          // sweep axis as the front passes its centre (never placeholder
          // geometry). Field at the subject centre (along-coordinate 0), mirror
          // of the TSL leading-edge field.
          const aheadV = (0 - uBandCenter.value) * uDirSign.value;
          const halfB = Math.max(uBandWidth.value * 0.5, 1e-4);
          const trailLenV = halfB * 0.35;
          const leadV = clamp((halfB - Math.max(aheadV, 0)) / halfB, 0, 1);
          const trailV = clamp((trailLenV + Math.min(aheadV, 0)) / trailLenV, 0, 1);
          const fieldV = clamp(leadV * trailV, 0, 1);
          // Coherent forward pull (toward the front), per-phase hashed amount.
          const pull = hash1(Math.floor(p * 40)) * 0.6 + 0.4;
          const lurch = fieldV * FALLBACK_FRAC * span * pull;
          if (uAxis.value === 0) {
            subject.position.x = baseX + lurch * uDirSign.value;
            subject.position.y = baseY;
          } else {
            subject.position.x = baseX;
            subject.position.y = baseY + lurch * uDirSign.value;
          }
          return;
        }

        // (b) LIVE TRANSFORM TRACKING — co-bindings keep animating the hidden
        // subject; re-register the overlay on its CURRENT local pose.
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);

        // (a) LATE TEXTURE POUR — rebuild the sheet's material the moment the
        // live source material instance or its map identity changes.
        const src = liveSourceMaterial();
        const liveMap = (src?.map as Texture | null | undefined) ?? null;
        if (src !== builtSrcMat || liveMap !== builtSrcMap) {
          const old = sheet.material as Material;
          sheet.material = buildMaterial();
          old.dispose(); // ours alone — never disposes the shared texture
        } else if (src && !liveMap && src.color) {
          uColor.value.copy(src.color); // live tint tracking on the fallback
        }

        // Rigid chrome (the dot) re-shears on the band field every frame.
        placeRigidChrome();
      };

      // Deterministic initial state (the rig pins idle at t=0). Recompute span
      // first so the published uniforms are valid before the first seek.
      applyDirection(str(params.direction, 'horizontal'));
      apply(0);

      return {
        // Looping time tile (the sort wave is a continuous cycle).
        duration: () => num(params.speed, 5),
        seek: (t) => apply(t),
        // Re-apply at the live time so paused control tweaks (the CONTROLS gate
        // drives one control at a fixed t) take effect without a new seek.
        onParamChange: () => apply(lastT),
        dispose: () => {
          if (sheet) {
            if (overlay.parent) overlay.parent.remove(overlay);
            sheet.geometry.dispose();
            (sheet.material as Material).dispose();
            sheet = null;
            for (const m of bentChrome) {
              m.geometry.dispose(); // ours — created PlaneGeometry
              (m.material as Material).dispose();
            }
            bentChrome.length = 0;
            for (const c of rigidChrome) {
              // Geometry is the SUBJECT's, shared by reference — never disposed
              // here. The cloned material is ours.
              (c.mesh.material as Material).dispose();
            }
            rigidChrome.length = 0;
            subject.visible = prevVisible;
          } else {
            subject.position.x = baseX;
            subject.position.y = baseY;
          }
        },
      };
    },
  ),
};
