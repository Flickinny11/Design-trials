// morph-into-card — the element folds itself into a neat floating chip:
// shrinking into a rounded pill that glides into a corner of its own footprint,
// then unfurling back to full size. HARD / mask / state-driven. §14
// DESIGN-REFERENCES (View Transitions API named-transition element morphing):
// the element-to-container morph drives BOTH a TSL rounded-rect SDF mask whose
// corner radius grows (rect -> pill silhouette) AND a transform shrink/travel
// toward a corner, exactly like a `view-transition-name` pair morphing a hero
// card into its minimized chip.
//
// Driving: state-first. Each seek reads `target.userData.state` (or `.hover`)
// — truthy folds toward the chip, falsy unfurls — integrating progress toward
// the target at 1/duration per second (deterministic for a given seek
// sequence). When no state input exists (catalog tile, conformance harness)
// it falls back to a self-running time loop: fold-in, chip hold, unfurl, full
// hold (hold legs are CHIP_HOLD seconds).
//
// SUBJECT LOOK IS SACRED: the masked node material samples the live source
// material's `.map` when present (Texture shared by reference) tinted by its
// color, and falls back to the source color alone — never an invented fill.
// Every seek re-checks the live material and rebuilds/rebinds if the material
// instance or its `.map` changed (mounted artifacts pour textures
// asynchronously after attach).
//
// MASK SPACE (ghost-plate fix, 2026-06-12): the SDF mask evaluates in the
// face mesh's GEOMETRY-LOCAL XY space (positionLocal / measured geometry half
// extents), NOT uv space. The card face is a RoundedBox — a 3D solid whose
// side walls and edge fillets carry their own uv islands; a uv-space mask
// left those faces unmasked, so the docked chip sat inside a faint full-size
// rect ghost (the box's silhouette). Position-space masking clips every face
// of the solid consistently: outside the pill the alpha truly reaches 0.
//
// CHROME CO-TREATMENT (proven pattern, metaball-merge): chrome children are
// snapshotted (opacity + transparent) and each seek their opacity is driven by
// the SDF mask coverage CPU-evaluated at the child's centre (projected into
// the face's mask space) times a dock fade — the chrome conceptually travels
// INTO the chip, fully dissolved by the time it docks. Never a flat residue
// floating at the old rect bounds.
//
// CHIP IDENTITY (legibility fix): the docked chip is the subject's surviving
// identity, so it must not dim toward the background. As the chip forms, the
// face gains a self-illumination lift of ITS OWN colour (uLift) plus a brass
// rim along the pill boundary (uRim) — brass sampled from the subject's own
// header chrome when present (subject-derived), falling back to the design
// world's brass-400. No invented colours.
//
// Observables (CPU + uniform): subject.scale shrinks base -> chipScale,
// subject.position travels to the chosen corner of the MEASURED footprint
// (geometry bounds in the subject's local frame — never hardcoded world
// units), `uRadius`/`uLift`/`uRim` (stashed on target.userData.morphIntoCard)
// animate the silhouette + chip glow, and chrome opacity follows coverage.
//
// DISTINCT from pill-morph (morphs aspect/radius IN PLACE, time-driven — this
// one TRAVELS into a corner and is state-driven, integrating toward a target)
// and from card-fold (a hinge-crease unfold squashing one scale axis — this
// one keeps the card's proportions, rounding its silhouette while it shrinks
// and glides; no crease, no axis squash).

import { Color, Mesh, type Material, type Object3D, type Texture } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  abs,
  float,
  length,
  max,
  min,
  positionLocal,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import {
  clamp,
  num,
  str,
  type EaseName,
  type PrimitiveDefinition,
} from '../contract';

/** Hold time (seconds) at each end of the time-fallback loop. */
export const CHIP_HOLD = 0.6;

/** Face self-illumination lift (× its own colour) when fully docked. */
export const LIFT_MAX = 4.0;
/** Brass rim intensity along the pill boundary when fully docked. */
export const RIM_MAX = 1.6;

const R_MIN = 0.02; // resting corner radius (near-square silhouette)
const MASK_SOFT = 0.035; // SDF edge softness (in half-short-side units)
const RIM_W = 0.12; // rim band half-width around the silhouette boundary
const CHROME_SOFT = 0.16; // CPU coverage softness for chrome centres
const DOCK_START = 0.55; // raw progress where chrome starts dissolving in
const DOCK_END = 0.95; // raw progress where chrome is fully inside the chip
const DT_MAX = 0.25; // state-integration step clamp (driver hiccup guard)
const FALLBACK_HALF = { hx: 0.87, hy: 0.56 }; // catalog card, degenerate-subject guard
const BRASS_FALLBACK = '#cd9f55'; // design-system brass-400 (Observatory Brass)

const SCHEMA = [
  { id: 'chipScale', label: 'Chip Size', type: 'knob', min: 0.12, max: 0.6, step: 0.01, default: 0.28 },
  { id: 'radiusAmount', label: 'Rounding', type: 'knob', min: 0, max: 1, step: 0.01, default: 1 },
  {
    id: 'corner',
    label: 'Corner',
    type: 'dropdown',
    options: [
      { value: 'top-left', label: 'Top Left' },
      { value: 'top-right', label: 'Top Right' },
      { value: 'bottom-left', label: 'Bottom Left' },
      { value: 'bottom-right', label: 'Bottom Right' },
    ],
    default: 'bottom-right',
  },
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 2.5, step: 0.1, default: 0.9, unit: 's' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'backOut',
    options: ['easeInOut', 'easeOut', 'backOut', 'expoOut'],
  },
] as const;

const CORNER_SIGNS: Record<string, readonly [number, number]> = {
  'top-left': [-1, 1],
  'top-right': [1, 1],
  'bottom-left': [-1, -1],
  'bottom-right': [1, -1],
};

/** Rounded-rect SDF (CPU mirror of the TSL mask). Coordinates in mask space:
 *  half extents (ax, ay), corner radius r — negative inside, 0 on the
 *  boundary, positive outside. Exported so tests can prove the geometry the
 *  mask + chrome coverage share. */
export function chipMaskSdf(nx: number, ny: number, ax: number, ay: number, r: number): number {
  const qx = Math.abs(nx) - ax + r;
  const qy = Math.abs(ny) - ay + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function smoothstepCpu(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** First Mesh in the subject (the subject itself, or — for Group subjects like
 *  MSDF 'text-object' — its first Mesh descendant). */
function primaryMeshOf(subject: Object3D): Mesh | null {
  if ((subject as Mesh).isMesh) return subject as Mesh;
  let found: Mesh | null = null;
  subject.traverse((o) => {
    if (!found && (o as Mesh).isMesh) found = o as Mesh;
  });
  return found;
}

/** Half-extents of the subject measured in ITS OWN local frame: union of every
 *  descendant geometry's bounding box, offset by accumulated child positions
 *  (subject factories parent chrome with plain position offsets). Never
 *  hardcoded world units — the travel distance derives from this. */
function measureLocalHalfExtents(subject: Object3D): { hx: number; hy: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const walk = (o: Object3D, ox: number, oy: number): void => {
    const geo = (o as Mesh).isMesh ? (o as Mesh).geometry : undefined;
    if (geo) {
      if (!geo.boundingBox) geo.computeBoundingBox();
      const b = geo.boundingBox;
      if (b) {
        minX = Math.min(minX, ox + b.min.x);
        maxX = Math.max(maxX, ox + b.max.x);
        minY = Math.min(minY, oy + b.min.y);
        maxY = Math.max(maxY, oy + b.max.y);
      }
    }
    for (const c of o.children) walk(c, ox + c.position.x, oy + c.position.y);
  };
  walk(subject, 0, 0);
  if (!Number.isFinite(minX) || maxX - minX <= 0 || maxY - minY <= 0) {
    return { ...FALLBACK_HALF };
  }
  return { hx: (maxX - minX) / 2, hy: (maxY - minY) / 2 };
}

/** Half-extents of ONE mesh's own geometry (the mask lives in this space). */
function meshHalfExtents(mesh: Mesh | null): { hx: number; hy: number } {
  const geo = mesh?.geometry;
  if (!geo) return { ...FALLBACK_HALF };
  if (!geo.boundingBox) geo.computeBoundingBox();
  const b = geo.boundingBox;
  if (!b || b.max.x - b.min.x <= 1e-6 || b.max.y - b.min.y <= 1e-6) {
    return { ...FALLBACK_HALF };
  }
  return { hx: (b.max.x - b.min.x) / 2, hy: (b.max.y - b.min.y) / 2 };
}

type SourceLike = Material & {
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  map?: Texture | null;
};

export const morphIntoCardPrimitive: PrimitiveDefinition = {
  name: 'morph-into-card',
  label: 'Morph Into Card',
  category: 'mask',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'state',
  schema: SCHEMA,
  description:
    'The element folds itself into a neat floating chip — shrinking and gliding into a corner as its silhouette rounds into a pill — then unfurls back to full size.',
  create: defineAnimatable(
    { name: 'morph-into-card', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mesh = primaryMeshOf(subject);

      // ── Measured footprints (never hardcoded world units) ────────────────
      // Composite bounds (face + chrome) drive the corner travel; the face
      // mesh's OWN geometry bounds define the mask space (positionLocal is
      // geometry-local, so side walls/fillets of the RoundedBox clip too).
      const { hx, hy } = measureLocalHalfExtents(subject);
      const { hx: mhx, hy: mhy } = meshHalfExtents(mesh);
      // Mask space: positionLocal.xy / mhy -> x in ±aspectM, y in ±1.
      const aspectM = mhx / mhy;
      const shortHalf = Math.min(aspectM, 1); // pill radius = half short side

      // ── Transform bases ──────────────────────────────────────────────────
      const basePos = subject.position.clone();
      const baseScale = subject.scale.clone();

      // ── Chrome co-treatment (coverage-driven, metaball-merge pattern) ────
      // Snapshot opacity + transparent AND project each child's centre into
      // the face's mask space (accumulated local offsets / mhy) so coverage
      // can be CPU-evaluated against the same SDF the shader masks with.
      interface ChromeSnap {
        m: Material & { opacity: number };
        opacity: number;
        transparent: boolean;
        nx: number;
        ny: number;
      }
      const chrome: ChromeSnap[] = [];
      const collectChrome = (o: Object3D, ox: number, oy: number): void => {
        if (o !== mesh && (o as Mesh).isMesh && (o as Mesh).material) {
          const m = (o as Mesh).material;
          const arr = Array.isArray(m) ? m : [m];
          for (const mat of arr) {
            chrome.push({
              m: mat as Material & { opacity: number },
              opacity: (mat as Material & { opacity: number }).opacity,
              transparent: mat.transparent,
              nx: ox / mhy,
              ny: oy / mhy,
            });
            mat.transparent = true;
          }
        }
        for (const c of o.children) collectChrome(c, ox + c.position.x, oy + c.position.y);
      };
      collectChrome(subject, 0, 0);

      // ── Chip identity colour: the subject's own header brass when present
      // (subject-derived), else the design world's brass-400. Never invented.
      let brass = new Color(BRASS_FALLBACK);
      const header = subject.getObjectByName('card-header') as Mesh | undefined;
      const headerMat =
        header && !Array.isArray(header.material) ? (header.material as SourceLike) : null;
      if (headerMat?.color instanceof Color) brass = headerMat.color.clone();

      // ── Rounded-rect SDF mask in GEOMETRY-LOCAL position space ───────────
      // (shared by every rebuilt material). uRadius grows R_MIN ->
      // shortHalf*radiusAmount: at full amount the silhouette is a pill.
      const uRadius = uniform(R_MIN);
      const uLift = uniform(0);
      const uRim = uniform(0);
      const cN = positionLocal.xy.div(float(mhy));
      const q = abs(cN).sub(vec2(aspectM, 1)).add(uRadius);
      const sdf = length(max(q, vec2(0, 0)))
        .add(min(max(q.x, q.y), float(0)))
        .sub(uRadius);
      const maskN = float(1).sub(smoothstep(float(0), float(MASK_SOFT), sdf));
      const rimN = float(1).sub(smoothstep(float(0), float(RIM_W), abs(sdf)));

      // ── Masked material carrying the live subject look ───────────────────
      const buildMat = (src: SourceLike | null): MeshStandardNodeMaterial => {
        const m = new MeshStandardNodeMaterial({ transparent: true });
        const col = src?.color instanceof Color ? src.color : new Color('#1d212b');
        const map = src?.map ?? null;
        const colVec = vec3(col.r, col.g, col.b);
        // HARD RULE: sample the subject's own map when present (shared by
        // reference) tinted by its color; otherwise its color — never invented.
        (m as unknown as { colorNode: unknown }).colorNode = map
          ? texture(map).rgb.mul(colVec)
          : colVec;
        (m as unknown as { opacityNode: unknown }).opacityNode = maskN;
        // Emissive = source baseline ⊕ chip identity: the face's own colour
        // lifted (uLift) + the brass rim along the silhouette (uRim). The
        // docked chip stays legible — never dims toward the background.
        const emi = src?.emissive instanceof Color ? src.emissive : new Color('#12151d');
        const eI = src?.emissiveIntensity ?? 0.42;
        (m as unknown as { emissiveNode: unknown }).emissiveNode = vec3(
          emi.r * eI,
          emi.g * eI,
          emi.b * eI,
        )
          .add(colVec.mul(uLift))
          .add(vec3(brass.r, brass.g, brass.b).mul(rimN).mul(uRim));
        m.roughness = src?.roughness ?? 0.32;
        m.metalness = src?.metalness ?? 0.45;
        m.envMapIntensity = src?.envMapIntensity ?? 1.15;
        return m;
      };

      // Live-source tracking: `srcAssigned` is the restore value (may be an
      // array), `srcMat` the material we mirror, `srcMap` its last-seen map.
      let srcAssigned: Material | Material[] | null = mesh ? mesh.material : null;
      let srcMat: SourceLike | null = Array.isArray(srcAssigned)
        ? (srcAssigned[0] as SourceLike)
        : (srcAssigned as SourceLike | null);
      let srcMap: Texture | null = srcMat?.map ?? null;
      let mat = buildMat(srcMat);
      if (mesh) mesh.material = mat;

      /** Re-check the live material each seek: a mounted artifact may swap the
       *  material instance or pour `.map` in asynchronously after attach. */
      const ensureBound = (): void => {
        if (!mesh) return;
        const live = mesh.material;
        if (live !== mat) {
          srcAssigned = live;
          srcMat = Array.isArray(live) ? (live[0] as SourceLike) : (live as SourceLike);
          srcMap = srcMat?.map ?? null;
          const next = buildMat(srcMat);
          mesh.material = next;
          mat.dispose();
          mat = next;
        } else if (srcMat && (srcMat.map ?? null) !== srcMap) {
          srcMap = srcMat.map ?? null;
          const next = buildMat(srcMat);
          mesh.material = next;
          mat.dispose();
          mat = next;
        }
      };

      // ── Driving ──────────────────────────────────────────────────────────
      /** Truthy = fold to chip, falsy = unfurl, null = no state input. */
      const readState = (): boolean | null => {
        const ud = target.userData as Record<string, unknown>;
        const s = ud.state ?? ud.hover;
        if (typeof s === 'boolean') return s;
        if (typeof s === 'number' && Number.isFinite(s)) return s >= 0.5;
        if (typeof s === 'string') {
          return s === 'hover' || s === 'active' || s === 'on' || s === 'chip';
        }
        return null;
      };

      /** Time-fallback loop: fold-in / chip hold / unfurl / full hold. */
      const loopProgress = (t: number, dur: number): number => {
        const cycle = 2 * dur + 2 * CHIP_HOLD;
        const m = ((t % cycle) + cycle) % cycle;
        if (m < dur) return m / dur;
        if (m < dur + CHIP_HOLD) return 1;
        if (m < 2 * dur + CHIP_HOLD) return 1 - (m - dur - CHIP_HOLD) / dur;
        return 0;
      };

      let stateProgress = 0;
      let lastT: number | null = null;
      let lastSeekT = 0;

      // Observability stash (uniform handles + raw progress) for host/tests.
      const stash = { uRadius, uLift, uRim, progress: 0 };
      target.userData.morphIntoCard = stash;

      const apply = (t: number): void => {
        ensureBound();
        const dur = Math.max(num(params.duration, 0.9), 0.05);
        const st = readState();
        let raw: number;
        if (st === null) {
          raw = loopProgress(t, dur);
          lastT = t;
        } else {
          const dt = lastT === null ? 0 : clamp(t - lastT, 0, DT_MAX);
          lastT = t;
          stateProgress = clamp(stateProgress + ((st ? 1 : -1) * dt) / dur, 0, 1);
          raw = stateProgress;
        }
        stash.progress = raw;
        const p = ease(str(params.curve, 'backOut') as EaseName, raw); // may overshoot
        const pc = clamp(p, 0, 1);

        // Mask: corner radius rect -> pill. Chip identity glow rides pc.
        const amount = clamp(num(params.radiusAmount, 1), 0, 1);
        const rTarget = Math.max(R_MIN, shortHalf * amount);
        uRadius.value = R_MIN + (rTarget - R_MIN) * p;
        uLift.value = LIFT_MAX * pc;
        uRim.value = RIM_MAX * pc;

        // Transform: shrink to chipScale and travel into the chosen corner of
        // the measured footprint (chip corner lands on the card corner at p=1).
        const chip = clamp(num(params.chipScale, 0.28), 0.05, 1);
        const f = 1 - (1 - chip) * p;
        subject.scale.set(baseScale.x * f, baseScale.y * f, baseScale.z * f);
        const [sx, sy] =
          CORNER_SIGNS[str(params.corner, 'bottom-right')] ?? CORNER_SIGNS['bottom-right'];
        subject.position.x = basePos.x + sx * hx * baseScale.x * (1 - f);
        subject.position.y = basePos.y + sy * hy * baseScale.y * (1 - f);

        // Chrome co-treatment: opacity = base × mask coverage at the child's
        // centre × dock fade — the chrome travels INTO the chip and is fully
        // dissolved by the time it docks (no residue at the old rect bounds).
        const r = uRadius.value;
        const dock = 1 - smoothstepCpu(DOCK_START, DOCK_END, clamp(raw, 0, 1));
        for (const c of chrome) {
          const cov = 1 - smoothstepCpu(-CHROME_SOFT, CHROME_SOFT, chipMaskSdf(c.nx, c.ny, aspectM, 1, r));
          c.m.opacity = c.opacity * cov * dock;
        }
      };

      return {
        duration: () => Infinity, // stateful; time fallback loops
        seek: (t) => {
          lastSeekT = t;
          apply(t);
        },
        // Re-apply at the paused clock so control drives respond without a
        // new seek (CONTROLS gate pauses at t=1s and sweeps min -> max).
        onParamChange: () => apply(lastSeekT),
        dispose: () => {
          if (mesh && srcAssigned) mesh.material = srcAssigned; // latest live source
          subject.position.copy(basePos);
          subject.scale.copy(baseScale);
          for (const c of chrome) {
            c.m.opacity = c.opacity;
            c.m.transparent = c.transparent;
          }
          delete target.userData.morphIntoCard;
          mat.dispose(); // only our node material — never the subject's resources
        },
      };
    },
  ),
};
