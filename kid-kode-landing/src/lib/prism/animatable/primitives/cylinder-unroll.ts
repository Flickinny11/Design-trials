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
//                    lift    = (1 - cos(theta)) * rEff
//
// with rEff = r * (1 + 0.045*theta), a gentle Archimedean spiral so multiple
// wraps layer like real rolled paper instead of z-fighting on one circle. The
// front sweeps the span over the first ~82% of the duration (easeInOut); the
// remaining tail is a subtle paper-curl OVERSHOOT — the far edge bows past
// flat (a sin(pi*x) bell on a negative z dip, weighted toward the last-laid
// edge) and settles exactly flat at t = duration. An analytic bent normal
// (the surface tangent rotates by theta in the travel/z plane) feeds
// normalNode so the roll shades honestly under the rig lighting. Uniform-
// driven; deterministic; one shader graph serves all four directions via
// axis/sign/start uniforms — no rebuild on direction change.
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
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  clamp as tslClamp,
  cos,
  float,
  max as tslMax,
  min as tslMin,
  mix,
  positionLocal,
  pow,
  sin,
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
  { id: 'radius', label: 'Roll Radius', type: 'knob', min: 0.05, max: 0.35, step: 0.005, default: 0.13 },
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
// Spiral gain per radian of wrap — separates stacked wraps like paper layers.
const SPIRAL = 0.045;
// Sheet subdivision (both axes — direction is a runtime control).
const SEG = 64;
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
  opacity: number;
};

export const cylinderUnrollPrimitive: PrimitiveDefinition = {
  name: 'cylinder-unroll',
  label: 'Cylinder Unroll',
  category: 'transform',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The surface arrives rolled into a tight scroll and unrolls flat like parchment, the roll edge travelling across as it lays down.',
  create: defineAnimatable(
    { name: 'cylinder-unroll', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      // ── Measure the subject in ITS OWN local frame (no hardcoded units) ──
      subject.updateWorldMatrix(true, true);
      const worldBox = new Box3().setFromObject(subject);
      const localBox = worldBox.isEmpty()
        ? null
        : worldBox.clone().applyMatrix4(new Matrix4().copy(subject.matrixWorld).invert());

      const repMesh = findRepresentativeMesh(subject);
      /** The representative mesh's CURRENT first material — read live, never
       *  cached: the mounted plane factory pours `.map` asynchronously and
       *  applyImageSpec may swap the material after this primitive attaches. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };

      const canOverlay = Boolean(localBox && liveSourceMaterial() && subject.parent);

      // ── Fallback state ('lay' mode: whole subject swings down flat) ──────
      const baseRotX = subject.rotation.x;
      const prevVisible = subject.visible;

      // ── Bend uniforms (one graph serves all directions) ──────────────────
      const uFront = uniform(0); // unroll front, distance from the start edge
      const uRadius = uniform(0.2); // absolute local-unit radius (set per seek)
      const uOver = uniform(0); // signed overshoot dip amplitude
      const uAxis = uniform(0); // 0 = travel along local x, 1 = local y
      const uStart = uniform(0); // start-edge coordinate on the travel axis
      const uDirSign = uniform(1); // +1 start at the min edge, -1 at the max
      const uSpan = uniform(1); // travel-axis extent
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint

      // Sheet extents (subject-local), filled when the overlay is built.
      let halfW = 0.5;
      let halfH = 0.5;

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

      // ── The TSL vertex-lane bend (built ONCE, shared across rebuilds) ────
      // cFrom: distance from the start edge along the travel axis (>= 0).
      const cAlong = mix(positionLocal.x, positionLocal.y, uAxis);
      const cFrom = cAlong.sub(uStart).mul(uDirSign);
      const rSafe = tslMax(uRadius, float(1e-3));
      const theta = tslMax(cFrom.sub(uFront), float(0)).div(rSafe);
      const rEff = rSafe.mul(theta.mul(float(SPIRAL)).add(1));
      const laid = tslMin(cFrom, uFront);
      const cNew = laid.add(sin(theta).mul(rEff));
      const lift = cos(theta).oneMinus().mul(rEff);
      // Curl overshoot: a negative z bow weighted toward the last-laid edge.
      const dip = uOver.mul(pow(tslClamp(cFrom.div(tslMax(uSpan, float(1e-3))), 0, 1), 2));
      const cBack = cNew.mul(uDirSign).add(uStart);
      const bentPos = vec3(
        mix(cBack, positionLocal.x, uAxis),
        mix(positionLocal.y, cBack, uAxis),
        positionLocal.z.add(lift).add(dip),
      );
      // Analytic bent normal: the surface tangent rotates by theta in the
      // (travel, z) plane, so n = (-dirSign*sin(theta), cos(theta)) there.
      const nTravel = sin(theta).negate().mul(uDirSign);
      const bentNormal = vec3(
        mix(nTravel, float(0), uAxis),
        mix(float(0), nTravel, uAxis),
        cos(theta),
      ).normalize();

      // ── Overlay sheet (scroll-stagger-rise hide/overlay pattern) ─────────
      const overlay = new Group();
      overlay.name = 'cylinder-unroll-overlay';
      let sheet: Mesh | null = null;

      // What the current sheet material was built FROM — compared against the
      // live source each seek (async texture pour / material swap → rebuild).
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      /** Build a node material carrying the subject's OWN look: colorNode
       *  samples the live texture by reference, or the live color via the
       *  tracked uColor uniform — never an invented fill. */
      const buildMaterial = (): MeshStandardNodeMaterial => {
        const src = liveSourceMaterial();
        builtSrcMat = src;
        builtSrcMap = (src?.map as Texture | null | undefined) ?? null;
        const mat = new MeshStandardNodeMaterial();
        if (src) {
          if (typeof src.roughness === 'number') mat.roughness = src.roughness;
          if (typeof src.metalness === 'number') mat.metalness = src.metalness;
          if (src.emissive) mat.emissive.copy(src.emissive);
          if (typeof src.emissiveIntensity === 'number') {
            mat.emissiveIntensity = src.emissiveIntensity;
          }
          mat.opacity = src.opacity;
          mat.transparent = src.transparent || src.opacity < 1;
          if (src.color) uColor.value.copy(src.color);
        }
        // The rolled wrap shows its back face to the camera.
        mat.side = DoubleSide;
        const m = mat as unknown as {
          colorNode: unknown;
          positionNode: unknown;
          normalNode: unknown;
        };
        m.colorNode = builtSrcMap ? tslTexture(builtSrcMap) : uColor;
        m.positionNode = bentPos;
        m.normalNode = transformNormalToView(bentNormal);
        return mat;
      };

      if (canOverlay && localBox) {
        const w = localBox.max.x - localBox.min.x || 1;
        const h = localBox.max.y - localBox.min.y || 1;
        halfW = w / 2;
        halfH = h / 2;
        sheet = new Mesh(new PlaneGeometry(w, h, SEG, SEG), buildMaterial());
        sheet.name = 'cylinder-unroll-sheet';
        sheet.position.set(
          (localBox.min.x + localBox.max.x) / 2,
          (localBox.min.y + localBox.max.y) / 2,
          localBox.max.z, // the artifact's front face
        );
        overlay.add(sheet);
        // Sibling of the subject carrying its exact local pose (a hidden
        // parent hides its children, so the sheet cannot live under it).
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);
        subject.parent!.add(overlay);
        // The sheet IS the subject now — hide the original until dispose().
        subject.visible = false;
        applyDirection(str(params.direction, 'left'));
        uRadius.value = clamp(num(params.radius, 0.13), 0.02, 0.45) * (uSpan.value as number);
      }

      // Publish the driven uniforms for the host + headless tests (the
      // water-droplet pattern: no GPU to read pixels from in node).
      target.userData.cylinderUnroll = {
        uFront, uRadius, uOver, uAxis, uStart, uDirSign, uSpan, uColor,
      };

      let lastT = 0;

      const apply = (t: number) => {
        lastT = t;
        const dur = num(params.duration, 2.2);
        const p = phase(t, dur);
        // Front sweep finishes at LAY_END; the tail is the overshoot settle.
        const lay = ease('easeInOut', Math.min(p / LAY_END, 1));
        const bell = p > LAY_END ? Math.sin(Math.PI * ((p - LAY_END) / (1 - LAY_END))) : 0;
        const over = clamp(num(params.overshoot, 0.25), 0, 1);

        if (!canOverlay || !sheet) {
          // Fallback: nothing to overlay — the WHOLE subject swings down flat
          // (never placeholder geometry), with the same overshoot flap.
          subject.rotation.x = baseRotX - LAY_ANGLE * (1 - lay) + FLAP * over * bell;
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
        const span = uSpan.value as number;
        uRadius.value = clamp(num(params.radius, 0.13), 0.02, 0.45) * span;
        uFront.value = lay * span;
        uOver.value = -over * bell * (uRadius.value as number);
      };

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
            subject.visible = prevVisible;
          } else {
            subject.rotation.x = baseRotX;
          }
        },
      };
    },
  ),
};
