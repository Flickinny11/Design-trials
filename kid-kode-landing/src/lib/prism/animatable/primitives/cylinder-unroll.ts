// cylinder-unroll — the surface arrives rolled into a tight scroll and unrolls
// flat like parchment, the roll edge travelling across as it lays down. HARD /
// transform / GPU vertex-lane TSL primitive (DESIGN-REFERENCES §3, "Vertex
// displacement" via positionNode).
//
// HOW: a subdivided sheet overlay (64x64 PlaneGeometry sized + placed from the
// subject's MEASURED local bbox — never hardcoded world units) stands in for
// the subject, whose own geometry is NEVER mutated. The sheet's
// MeshStandardNodeMaterial bends every vertex in the vertex lane: vertices
// beyond the moving unroll front wrap onto a cylinder of radius r tangent at
// the front —
//
//   cFrom <= front : flat (laid down)
//   cFrom  > front : theta = (cFrom - front)/r
//                    inPlane = front + sin(theta) * rEff
//                    lift    = (1 - cos(theta)) * rEff, applied BEHIND the
//                              sheet (-z)
//
// with rEff = r * (1 + spiral*theta), a gentle Archimedean spiral so multiple
// wraps layer like real rolled paper instead of z-fighting on one circle.
//
// THE WRAP ROLLS *BEHIND* THE SHEET (advocate fix, 2026-06-12): the catalog
// camera sits in front of the sheet, so a wrap that lifted TOWARD it was
// perspective-MAGNIFIED — the roll rendered taller than the sheet silhouette
// and spanned the whole tile. Rolling away (-z) means perspective only ever
// SHRINKS the wrap, so it stays inside the sheet's own silhouette at every
// radius. The roll radius is additionally bounded: schema range is a small
// fraction of the measured span (0.04..0.2) and a hard clamp (0.02..0.25 of
// span) covers hand-fed params, so even the loosest scroll (max spiral growth)
// stays well inside the silhouette's scale.
//
// OVERSHOOT ENGAGES MID-LAY (advocate fix — control was dead at the pinned
// t=1s controls state, which sits mid-sweep): 'overshoot' is the paper's
// curl-springiness and now shapes the frame at EVERY phase, not just the tail:
//   (1) spiral looseness — uSpiral = SPIRAL*(1 + 4*over): springier paper rolls
//       looser, visibly fattening the on-screen scroll mid-lay;
//   (2) settle-curl bump — a sin(pi*u) wave of amplitude over*0.85*r rides the
//       just-laid band behind the front (width 0.16*span), bowing it back
//       toward the roll (-z). Its analytic slope feeds the bent normal, so the
//       band SHADES under the rig key light (a z-only bump face-on would be
//       nearly invisible — the shading is what makes the control read);
//   (3) the original tail bell — the far edge bows past flat (negative-z dip)
//       across [LAY_END..1] while the settle-curl fades out, landing exactly
//       flat at t = duration.
//
// HONEST PBR SHADING (advocate fix — the wrap rendered as a flat unlit fill):
// an analytic bent normal (the surface tangent rotates by -theta in the
// travel/z plane, plus the settle-curl slope) feeds normalNode. Because a
// custom normalNode BYPASSES three's automatic DoubleSide back-face normal
// flip, the visible back faces of the wrap pointed away from every light and
// collapsed to ambient+emissive (the flat tan the advocate flagged). The
// normal is now multiplied by faceDirection, so both sides of the curl shade
// honestly — the roll shows real cylinder shading under the rig key/fill/env.
// buildMaterial also carries envMapIntensity (with roughness/metalness/
// emissive/opacity) so the sheet picks up the same IBL sheen as the hidden
// subject.
//
// THE SUBJECT'S OWN LOOK IS SACRED (scroll-stagger-rise pattern, both P0
// ORRERY lessons inherited):
//   (a) LATE TEXTURE POUR — mounted artifacts receive `.map` ASYNCHRONOUSLY
//       after bindings attach. Every seek re-reads the representative mesh's
//       LIVE material; when the material instance OR its map identity differs
//       from what the sheet was built from, the sheet's material is rebuilt —
//       colorNode samples the live texture BY REFERENCE, or falls back to the
//       live material's color (a tracked uniform), NEVER an invented fill.
//   (b) LIVE TRANSFORM TRACKING — co-bindings keep animating the hidden
//       subject; every seek re-syncs the overlay group to the subject's
//       current local pose so the sheet rides a live-tilting artifact.
// The subject is hidden while the sheet is active and restored on dispose();
// dispose also releases the created geometry/material (never the subject's
// shared resources). With nothing to overlay (no geometry/material/parent)
// the WHOLE subject lays down instead — nothing spawned, restored exactly.
//
// CHROME CO-TREATMENT (advocate must-fix, 2026-06-12 — the tile read as a
// featureless tan slab because the declared subject was a chrome-less 'plane';
// the subject is now the catalog CARD and its full composite look rides the
// roll):
//   - The SHEET carries the PANEL: sized/placed from the representative mesh's
//     geometry bbox (mesh-local → subject-local, the genie-suck measure — a
//     world-AABB double-inflates under tilt), colorNode/PBR poured from the
//     live panel material, plus a rounded-corner SDF opacity mask (radius read
//     from RoundedBoxGeometry.parameters — 0 for plain rects, so mounted
//     rectangular artifacts are untouched) so the silhouette IS the card's.
//   - WIDE CHROME (header bar + content rows) becomes BENT CLONES: per child,
//     a subdivided flat plane (its front-face footprint) whose geometry is
//     baked into the sheet's frame, sharing the SAME bend position/normal node
//     trees — a bar crossing the unroll front visibly curls around the roll.
//     Materials copy the child's own color/emissive/PBR scalars and share any
//     map BY REFERENCE — never an invented fill.
//   - SMALL CHROME (the accent dot) becomes a RIGID CLONE: the child's real
//     geometry shared by reference + a material clone, POSED per seek by a CPU
//     mirror of the bend (same front/radius/spiral/curl/dip math), riding the
//     wrap along the bent surface normal. Tiny footprint → rigid placement is
//     visually exact; subdividing a sphere through the bend would distort it.
//   - The bend itself is z-aware: bentPos = surface(c) + bentNormal * localZ,
//     so geometry proud of the face (chrome) stays proud of the CURVED surface
//     through the wrap. For the sheet (localZ = 0) this is the identity of the
//     proven r2 choreography — nothing about the passing roll/overshoot/normal
//     behaviour changed.
//   Chrome clones are created once from the subject's children (catalog card
//   chrome is static); the late-pour rebuild path covers the panel/sheet only.
//
// DISTINCT from its neighbors: corner-peel rotates the RIGID card about a
// pinned corner (no surface curvature); origami-fold opens alternating
// accordion PLEATS (zig-zag creases, no travelling roll); melt sags downward
// in dripping tongues (no front, no wrap). cylinder-unroll is the only one
// where a moving front lays a genuinely CURVED wrap down flat.

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
  abs as tslAbs,
  clamp as tslClamp,
  cos,
  faceDirection,
  float,
  max as tslMax,
  min as tslMin,
  mix,
  positionLocal,
  pow,
  sin,
  smoothstep,
  sqrt as tslSqrt,
  texture as tslTexture,
  transformNormalToView,
  uniform,
  vec3,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { clamp, num, phase, str, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.6, max: 5, step: 0.1, default: 2.2, unit: 's' },
  // Roll radius as a FRACTION of the unroll span — scale-free, so the scroll
  // reads identically on a 1.8-unit catalog plane and a 40-unit mounted hero.
  // Bounded to 0.2 so the wrap (including max spiral growth at full overshoot)
  // never exceeds the sheet silhouette's scale (advocate must-fix).
  { id: 'radius', label: 'Roll Radius', type: 'knob', min: 0.04, max: 0.2, step: 0.005, default: 0.12 },
  {
    id: 'direction',
    label: 'Direction',
    type: 'dropdown',
    options: [
      { value: 'left', label: 'From Left' },
      { value: 'right', label: 'From Right' },
      { value: 'top', label: 'From Top' },
      { value: 'bottom', label: 'From Bottom' },
    ],
    default: 'left',
  },
  { id: 'overshoot', label: 'Curl Overshoot', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.25 },
] as const;

// The front finishes its sweep here; the tail [LAY_END..1] is the curl-settle.
const LAY_END = 0.82;
// Base spiral gain per radian of wrap — separates stacked wraps like paper.
const SPIRAL = 0.045;
// Overshoot loosens the spiral: uSpiral = SPIRAL * (1 + SPIRAL_OVER_GAIN*over).
const SPIRAL_OVER_GAIN = 4;
// Settle-curl bump: amplitude = over * CURL_AMP * radius, band = DECAY_FRAC*span.
const CURL_AMP = 0.85;
const DECAY_FRAC = 0.16;
// Hard radius clamp (fraction of span) for hand-fed params outside the schema.
const RADIUS_MIN = 0.02;
const RADIUS_MAX = 0.25;
// Sheet subdivision (both axes — direction is a runtime control).
const SEG = 64;
// Bent chrome clone subdivision — wide bars cross the tightest curl smoothly.
const CHROME_SEG_X = 64;
const CHROME_SEG_Y = 16;
// A chrome child whose footprint is below this fraction of the sheet in BOTH
// axes is treated as rigid (the dot) — posed per seek instead of vertex-bent.
const RIGID_FRAC = 0.15;
// Fallback lay-down swing (radians) when no overlay can be built.
const LAY_ANGLE = 1.25;
const FLAP = 0.3;

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

/** A small chrome child posed rigidly per seek (CPU mirror of the bend).
 *  Offsets are in the SHEET's frame: ox/oy from the sheet center, dz proud of
 *  the sheet surface. */
interface RigidChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  dz: number;
}

export const cylinderUnrollPrimitive: PrimitiveDefinition = {
  name: 'cylinder-unroll',
  label: 'Cylinder Unroll',
  category: 'transform',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The surface arrives rolled into a tight scroll and unrolls flat like parchment, the roll edge travelling across as it lays down.',
  create: defineAnimatable(
    { name: 'cylinder-unroll', category: 'transform', schema: SCHEMA },
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
      // mapped mesh-local → subject-local directly — a world-AABB route
      // double-inflates whenever the subject is tilted at measure time. The
      // sheet's w/h covers the UNION of all meshes (so Group subjects keep
      // their full footprint) while its face z comes from the REPRESENTATIVE
      // mesh (the panel) — chrome proud of the face must not push the sheet
      // forward off the panel.
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

      // ── Fallback state ('lay' mode: whole subject swings down flat) ──────
      const baseRotX = subject.rotation.x;
      const prevVisible = subject.visible;

      // ── Bend uniforms (one graph serves all directions) ──────────────────
      const uFront = uniform(0); // unroll front, distance from the start edge
      const uRadius = uniform(0.2); // absolute local-unit radius (set per seek)
      const uOver = uniform(0); // signed tail-bell dip amplitude (<= 0)
      const uSpiral = uniform(SPIRAL); // spiral gain (overshoot loosens wraps)
      const uCurl = uniform(0); // settle-curl bump amplitude behind the front
      const uDecay = uniform(0.3); // settle-curl band width (local units)
      const uAxis = uniform(0); // 0 = travel along local x, 1 = local y
      const uStart = uniform(0); // start-edge coordinate on the travel axis
      const uDirSign = uniform(1); // +1 start at the min edge, -1 at the max
      const uSpan = uniform(1); // travel-axis extent
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uOpacity = uniform(1); // live source opacity (mask multiplies it)
      // Rounded-corner SDF mask (the card silhouette). uMaskR = 0 disables it.
      const uMaskHalfW = uniform(1);
      const uMaskHalfH = uniform(1);
      const uMaskR = uniform(0);
      const uMaskEdge = uniform(1e-3); // anti-alias half-width

      // Sheet extents (subject-local), filled when the overlay is built.
      let halfW = 0.5;
      let halfH = 0.5;
      let cornerR = 0; // representative RoundedBox corner radius (0 = rect)
      // Sheet placement in the overlay group's frame (= subject-local).
      let sheetX = 0;
      let sheetY = 0;
      let faceZ = 0;

      const applyDirection = (dir: string) => {
        switch (dir) {
          case 'right':
            uAxis.value = 0; uStart.value = halfW; uDirSign.value = -1; uSpan.value = halfW * 2;
            break;
          case 'top':
            uAxis.value = 1; uStart.value = halfH; uDirSign.value = -1; uSpan.value = halfH * 2;
            break;
          case 'bottom':
            uAxis.value = 1; uStart.value = -halfH; uDirSign.value = 1; uSpan.value = halfH * 2;
            break;
          case 'left':
          default:
            uAxis.value = 0; uStart.value = -halfW; uDirSign.value = 1; uSpan.value = halfW * 2;
        }
      };

      // ── The TSL vertex-lane bend (built ONCE, shared sheet + chrome) ─────
      // cFrom: distance from the start edge along the travel axis (>= 0).
      const cAlong = mix(positionLocal.x, positionLocal.y, uAxis);
      const cFrom = cAlong.sub(uStart).mul(uDirSign);
      const rSafe = tslMax(uRadius, float(1e-3));
      const theta = tslMax(cFrom.sub(uFront), float(0)).div(rSafe);
      const rEff = rSafe.mul(theta.mul(uSpiral).add(1));
      const laid = tslMin(cFrom, uFront);
      const cNew = laid.add(sin(theta).mul(rEff));
      // Wrap lift goes BEHIND the sheet (-z): perspective then only shrinks
      // the roll, so it can never tower past the sheet silhouette.
      const lift = cos(theta).oneMinus().mul(rEff);
      // Settle-curl bump: a sin(pi*u) wave on the just-laid band behind the
      // front, bowing back toward the roll (-z). u in [0..1] across the band.
      const dSafe = tslMax(uDecay, float(1e-3));
      const behind = tslMax(uFront.sub(cFrom), float(0));
      const uBand = tslClamp(behind.div(dSafe), 0, 1);
      const PI_F = float(Math.PI);
      const bump = sin(uBand.mul(PI_F)).mul(uCurl);
      // Tail bell dip: the far edge bows past flat (uOver <= 0), weighted
      // toward the last-laid edge.
      const dip = uOver.mul(pow(tslClamp(cFrom.div(tslMax(uSpan, float(1e-3))), 0, 1), 2));
      const cBack = cNew.mul(uDirSign).add(uStart);
      // Analytic bent normal. Backward roll = tangent rotates by -theta in the
      // (travel, z) plane, so n = (+sin(theta), cos(theta)) there. The settle-
      // curl contributes its slope dz/dc = uCurl*pi*cos(pi*u)/decay, gated to
      // the open band (0 < u < 1) so the wrap and the deep-laid flat stay
      // untouched; n_travel accumulates -dz/dc.
      const inBand = tslClamp(behind.mul(float(1e4)), 0, 1)
        .mul(tslClamp(float(1).sub(uBand).mul(float(1e4)), 0, 1));
      const dzdcBump = uCurl.mul(PI_F).div(dSafe).mul(cos(uBand.mul(PI_F))).mul(inBand);
      const nTravel = sin(theta).sub(dzdcBump).mul(uDirSign);
      const bentNormal = vec3(
        mix(nTravel, float(0), uAxis),
        mix(float(0), nTravel, uAxis),
        cos(theta),
      ).normalize();
      // Z-AWARE bend (chrome co-treatment): the surface point at localZ = 0,
      // offset along the bent normal by the vertex's own height — geometry
      // proud of the face (chrome bars) stays proud of the CURVED surface
      // through the wrap. For the sheet (localZ = 0) this is the identity of
      // the proven choreography.
      const surfacePos = vec3(
        mix(cBack, positionLocal.x, uAxis),
        mix(positionLocal.y, cBack, uAxis),
        dip.sub(lift).sub(bump),
      );
      const bentPos = (
        surfacePos as unknown as { add: (o: unknown) => unknown }
      ).add((bentNormal as unknown as { mul: (o: unknown) => unknown }).mul(positionLocal.z));
      // Custom normalNode bypasses three's automatic DoubleSide back-face
      // flip — multiply by faceDirection so both sides of the curl shade
      // honestly (shared by the sheet and every bent chrome clone).
      const bentNormalView = (
        transformNormalToView(bentNormal).normalize() as unknown as {
          mul: (n: unknown) => unknown;
        }
      ).mul(faceDirection);
      // Rounded-corner SDF mask in the sheet's frame: the card's silhouette.
      const qx = tslMax(tslAbs(positionLocal.x).sub(uMaskHalfW.sub(uMaskR)), float(0));
      const qy = tslMax(tslAbs(positionLocal.y).sub(uMaskHalfH.sub(uMaskR)), float(0));
      const cornerSdf = tslSqrt(qx.mul(qx).add(qy.mul(qy))).sub(uMaskR);
      const maskOpacity = smoothstep(float(0).sub(uMaskEdge), uMaskEdge, cornerSdf)
        .oneMinus()
        .mul(uOpacity);

      // ── Overlay sheet (scroll-stagger-rise hide/overlay pattern) ─────────
      const overlay = new Group();
      overlay.name = 'cylinder-unroll-overlay';
      let sheet: Mesh | null = null;
      const bentChrome: Mesh[] = [];
      const rigidChrome: RigidChromeClone[] = [];

      // What the current sheet material was built FROM — compared against the
      // live source each seek (async texture pour / material swap → rebuild).
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      /** Build a node material carrying the subject's OWN look: colorNode
       *  samples the live texture by reference, or the live color via the
       *  tracked uColor uniform — never an invented fill. PBR scalars
       *  (roughness/metalness/envMapIntensity/emissive) are copied so the
       *  sheet shades identically to the hidden subject under the rig
       *  lights. */
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
        // The rolled wrap shows its back face to the camera.
        mat.side = DoubleSide;
        const m = mat as unknown as {
          colorNode: unknown;
          positionNode: unknown;
          normalNode: unknown;
          opacityNode: unknown;
        };
        m.colorNode = builtSrcMap ? tslTexture(builtSrcMap) : uColor;
        m.positionNode = bentPos;
        m.normalNode = bentNormalView;
        // Card silhouette: only when the source is a RoundedBox (cornerR > 0)
        // — plain rectangular artifacts keep their exact footprint.
        if (cornerR > 0) {
          m.opacityNode = maskOpacity;
          mat.transparent = true;
          mat.alphaTest = 0.01; // discard the masked corners (incl. depth)
        }
        return mat;
      };

      /** A bent chrome clone's material: the child's OWN color/emissive/PBR
       *  scalars copied, any map shared BY REFERENCE — never an invented
       *  fill. Shares the sheet's bend position/normal trees (the same
       *  uniforms drive everything). */
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
        // Card silhouette radius — straight off the representative geometry's
        // own constructor parameters (0 / absent = plain rect, no mask).
        const repParams = (repMesh?.geometry as { parameters?: { radius?: number } } | undefined)
          ?.parameters;
        cornerR = Math.min(
          Math.max(typeof repParams?.radius === 'number' ? repParams.radius : 0, 0),
          Math.min(halfW, halfH),
        );
        uMaskHalfW.value = halfW;
        uMaskHalfH.value = halfH;
        uMaskR.value = cornerR;
        uMaskEdge.value = Math.max(cornerR * 0.05, 1e-3);

        sheet = new Mesh(new PlaneGeometry(w, h, SEG, SEG), buildMaterial());
        sheet.name = 'cylinder-unroll-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        overlay.add(sheet);

        // ── Chrome clones: every non-representative mesh child rides the
        // roll. Wide bars bend in the vertex lane; the tiny dot is posed
        // rigidly per seek (CPU mirror). Geometry footprints are measured in
        // the subject's local frame, then baked into the SHEET's frame so the
        // shared bend trees see real sheet coordinates.
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
              // Small chrome (the dot): rigid clone — REAL geometry by
              // reference (never disposed by us), material clone (ours).
              const m = new Mesh(child.geometry as BufferGeometry, srcMat.clone());
              m.name = `cylinder-unroll-chrome-rigid:${child.name || 'mesh'}`;
              overlay.add(m);
              rigidChrome.push({
                mesh: m,
                ox,
                oy,
                dz: (childBox.min.z + childBox.max.z) / 2 - faceZ,
              });
            } else {
              // Wide chrome (header/rows): a subdivided flat bar at the
              // child's front-face footprint, geometry BAKED into the sheet
              // frame so the shared bend trees apply directly.
              const geo = new PlaneGeometry(cw, ch, CHROME_SEG_X, CHROME_SEG_Y);
              geo.translate(ox, oy, childBox.max.z - faceZ);
              const m = new Mesh(geo, buildChromeMaterial(srcMat));
              m.name = `cylinder-unroll-chrome-bent:${child.name || 'mesh'}`;
              m.position.set(sheetX, sheetY, faceZ); // sheet frame = geometry frame
              overlay.add(m);
              bentChrome.push(m);
            }
          });
        }

        // Sibling of the subject carrying its exact local pose (a hidden
        // parent hides its children, so the sheet cannot live under it).
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);
        subject.parent!.add(overlay);
        // The sheet IS the subject now — hide the original until dispose().
        subject.visible = false;
      }

      /** CPU mirror of the TSL bend for the rigid chrome clones: pose each
       *  small child's clone on the bent surface (same front/radius/spiral/
       *  curl/dip math), offset along the bent surface normal by its own
       *  proud height. */
      const placeRigidChrome = () => {
        if (!rigidChrome.length) return;
        const front = uFront.value;
        const r = Math.max(uRadius.value, 1e-3);
        const spiral = uSpiral.value;
        const curl = uCurl.value;
        const decay = Math.max(uDecay.value, 1e-3);
        const over = uOver.value;
        const span = Math.max(uSpan.value, 1e-3);
        const axis = uAxis.value;
        const start = uStart.value;
        const dirSign = uDirSign.value;
        for (const c of rigidChrome) {
          const along = axis === 0 ? c.ox : c.oy;
          const lat = axis === 0 ? c.oy : c.ox;
          const cFromV = (along - start) * dirSign;
          let cNewV = Math.min(cFromV, front);
          let liftV = 0;
          let nT = 0;
          let nZ = 1;
          if (cFromV > front) {
            const th = (cFromV - front) / r;
            const rE = r * (1 + th * spiral);
            cNewV = front + Math.sin(th) * rE;
            liftV = (1 - Math.cos(th)) * rE;
            nT = Math.sin(th);
            nZ = Math.cos(th);
          }
          const behindV = Math.max(front - cFromV, 0);
          const uB = clamp(behindV / decay, 0, 1);
          const bumpV = Math.sin(uB * Math.PI) * curl;
          const inBandV = behindV > 1e-6 && uB < 1 - 1e-6 ? 1 : 0;
          const dzdcV = ((curl * Math.PI) / decay) * Math.cos(uB * Math.PI) * inBandV;
          let nTravelV = (nT - dzdcV) * dirSign;
          const nLen = Math.hypot(nTravelV, nZ) || 1;
          nTravelV /= nLen;
          const nZn = nZ / nLen;
          const dipV = over * Math.pow(clamp(cFromV / span, 0, 1), 2);
          const cBackV = cNewV * dirSign + start;
          const tPos = cBackV + c.dz * nTravelV;
          const zPos = dipV - liftV - bumpV + c.dz * nZn;
          c.mesh.position.set(
            sheetX + (axis === 0 ? tPos : lat),
            sheetY + (axis === 0 ? lat : tPos),
            faceZ + zPos,
          );
        }
      };

      // Publish the driven uniforms for the host + headless tests (the
      // water-droplet pattern: no GPU to read pixels from in node).
      target.userData.cylinderUnroll = {
        uFront, uRadius, uOver, uSpiral, uCurl, uDecay,
        uAxis, uStart, uDirSign, uSpan, uColor,
      };

      let lastT = 0;

      const apply = (t: number) => {
        lastT = t;
        const dur = num(params.duration, 2.2);
        const p = phase(t, dur);
        // Front sweep finishes at LAY_END; the tail is the overshoot settle.
        const lay = ease('easeInOut', Math.min(p / LAY_END, 1));
        const tail = p > LAY_END ? (p - LAY_END) / (1 - LAY_END) : 0;
        const bell = tail > 0 ? Math.sin(Math.PI * tail) : 0;
        const over = clamp(num(params.overshoot, 0.25), 0, 1);

        if (!canOverlay || !sheet) {
          // Fallback: nothing to overlay — the WHOLE subject swings down flat
          // (never placeholder geometry). Overshoot engages mid-lay here too:
          // springier paper swings through a wider arc, plus the tail flap.
          const swing = LAY_ANGLE * (1 + 0.35 * over);
          subject.rotation.x = baseRotX - swing * (1 - lay) + FLAP * over * bell;
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

        applyDirection(str(params.direction, 'left'));
        const span = uSpan.value;
        const radius = clamp(num(params.radius, 0.12), RADIUS_MIN, RADIUS_MAX) * span;
        uRadius.value = radius;
        uFront.value = lay * span;
        // Overshoot shapes the frame at EVERY phase (dead-control fix):
        // (1) spiral looseness — springier paper rolls looser;
        uSpiral.value = SPIRAL * (1 + SPIRAL_OVER_GAIN * over);
        // (2) settle-curl bump behind the front, fading out across the tail
        //     so t = duration lands exactly flat;
        const curlFade = tail > 0 ? 1 - ease('easeInOut', tail) : 1;
        uCurl.value = over * CURL_AMP * radius * curlFade;
        uDecay.value = Math.max(span * DECAY_FRAC, 1e-3);
        // (3) the original tail bell — far edge bows past flat, then settles.
        uOver.value = -over * bell * radius;

        // Rigid chrome (the dot) re-poses on the bent surface every frame.
        placeRigidChrome();
      };

      // Deterministic initial state (the rig pins idle at t=0).
      apply(0);

      return {
        duration: () => num(params.duration, 2.2),
        seek: (t) => apply(t),
        // Re-apply at the live time so paused control tweaks (the CONTROLS
        // gate drives one control at t=1s) take effect without a new seek.
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
              // Geometry is the SUBJECT's, shared by reference — never
              // disposed here. The cloned material is ours.
              (c.mesh.material as Material).dispose();
            }
            rigidChrome.length = 0;
            subject.visible = prevVisible;
          } else {
            subject.rotation.x = baseRotX;
          }
        },
      };
    },
  ),
};
