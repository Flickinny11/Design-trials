// metaball-merge — liquid metaballs swim in from the card's edges and
// smooth-union into the full card, like mercury coalescing. HARD / mask
// primitive. Swaps the card panel's material for a MeshStandardNodeMaterial
// whose opacityNode is an SDF metaball field (DESIGN-REFERENCES §11 "Liquid /
// Metaball Effect"): each ball is a circle SDF length(uv - pos_i) - r_i and
// the field is folded with opSmoothUnion(d1, d2, k) so approaching balls grow
// liquid necks before merging. Ball positions are CPU-driven uniforms updated
// every seek along deterministic edge→interior paths keyed by index hash (no
// Math.random anywhere): phase 0 = scattered droplets at the card edges,
// phase 1 = the union + a closing seal bias covers the full rect. A warm
// brass rim (|field| band) rides the liquid front; alpha comes straight from
// the smooth-union field.
//
// SUBJECT LOOK CARRIED (mask-category hard rule): the colorNode samples the
// live source material's texture map through a rebindable TextureNode
// (texture shared by reference; a 1×1 white owned fallback when map-less)
// multiplied by the source material's own color — never an invented fill.
// Every seek re-checks the mesh's LIVE material: a texture poured
// asynchronously onto the source rebinds, and a wholesale material swap is
// adopted as the new source (color/emissive/roughness/metalness re-carried,
// slot re-taken). dispose() hands back the LATEST live source material.
//
// DISTINCT from splat-reveal (discrete blobs growing IN PLACE via a hard max
// union — here the balls TRAVEL in from the edges and smooth-blend with
// gooey necks), from paint-spread (one center-out bloom — here N independent
// swimming droplets), and from liquefy-reveal (a summed 1/d goo field
// wobbling in place — here a true SDF opSmoothUnion with traveling balls and
// a brass front glow).

import {
  Color,
  DataTexture,
  Mesh,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  abs,
  clamp as tslClamp,
  float,
  length,
  mix,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { clamp, num, type ControlValue, type PrimitiveDefinition } from '../contract';

const TAU = Math.PI * 2;
const MAX_BALLS = 7;
const R_BASE = 0.3; // settled ball radius in uv units (before per-ball size)
const FAR = 2.5; // SDF distance an inactive ball contributes (beyond any blend)

/** Deterministic index hash (the standard sin-fract hash — no Math.random). */
const hash01 = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// Landing x positions in a low-discrepancy order (center, left, right, …) so
// ANY active prefix of balls spreads across the card before merging.
const END_X = [0.5, 0.2, 0.8, 0.34, 0.66, 0.1, 0.9] as const;

interface BallSpec {
  start: readonly [number, number]; // off-card edge launch point
  end: readonly [number, number]; // interior landing point
  perp: readonly [number, number]; // unit perpendicular to the travel line
  size: number; // per-ball radius multiplier
  freq: number; // swim wobble frequency
  phase: number; // swim wobble phase
}

// Deterministic ball paths keyed by index hash: ball i launches from edge
// i % 4 (left/right/top/bottom) at a hashed parametric position and lands on
// a stratified interior point (END_X order × alternating y bands), so the
// droplets converge from all four sides.
const BALLS: ReadonlyArray<BallSpec> = Array.from({ length: MAX_BALLS }, (_, i) => {
  const edge = i % 4;
  const et = 0.16 + 0.68 * hash01(i * 4 + 1);
  const start: readonly [number, number] =
    edge === 0 ? [-0.24, et] : edge === 1 ? [1.24, et] : edge === 2 ? [et, 1.24] : [et, -0.24];
  const yBand = i % 2 === 0 ? 0.36 : 0.64;
  const end: readonly [number, number] = [END_X[i], yBand + (hash01(i * 7 + 3) - 0.5) * 0.16];
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len = Math.hypot(dx, dy) || 1;
  return {
    start,
    end,
    perp: [-dy / len, dx / len] as const,
    size: 0.82 + 0.36 * hash01(i * 13 + 5),
    freq: 1.25 + 1.5 * hash01(i * 17 + 9),
    phase: TAU * hash01(i * 23 + 11),
  };
});

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 4, step: 0.1, default: 1.8, unit: 's' },
  { id: 'balls', label: 'Balls', type: 'knob', min: 3, max: 7, step: 1, default: 5 },
  { id: 'blend', label: 'Blend', type: 'knob', min: 0.05, max: 0.6, step: 0.01, default: 0.28 },
  { id: 'speed', label: 'Swim Speed', type: 'knob', min: 0.2, max: 3, step: 0.05, default: 1 },
  { id: 'glow', label: 'Edge Glow', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.85 },
] as const;

const activeCount = (v: ControlValue | undefined): number =>
  Math.min(MAX_BALLS, Math.max(3, Math.round(num(v, 5))));

/** First Mesh descendant (the subject may be a Group, e.g. MSDF text). */
const findRepresentativeMesh = (subject: Object3D): Mesh | null => {
  let found: Mesh | null = null;
  subject.traverse((o) => {
    if (found) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.material) found = mesh;
  });
  return found;
};

type MappedMaterial = Material & {
  map?: Texture | null;
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
};

const firstMat = (m: Material | Material[] | undefined | null): MappedMaterial | null =>
  ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;

export const metaballMergePrimitive: PrimitiveDefinition = {
  name: 'metaball-merge',
  label: 'Metaball Merge',
  category: 'mask',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Liquid metaballs swim in from the edges and smooth-union into the full card, like mercury coalescing.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'metaball-merge', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject;
      const repMesh = subject ? findRepresentativeMesh(subject) : null;

      // ── Uniform handles (all CPU-driven; the shader is pure field math) ──
      const uBX = BALLS.map((b) => uniform(b.start[0]));
      const uBY = BALLS.map((b) => uniform(b.start[1]));
      const uActive = BALLS.map((_, i) => uniform(i < activeCount(params.balls) ? 1 : 0));
      const uRadius = uniform(R_BASE * 0.3);
      const uSeal = uniform(0);
      const uBlend = uniform(clamp(num(params.blend, 0.28), 0.05, 0.6));
      const uGlow = uniform(clamp(num(params.glow, 0.85), 0, 2));
      // Live-carried source appearance (color + emissive·intensity).
      const uCR = uniform(1);
      const uCG = uniform(1);
      const uCB = uniform(1);
      const uER = uniform(0);
      const uEG = uniform(0);
      const uEB = uniform(0);

      // Owned 1×1 white fallback so the texture lane is a no-op multiply when
      // the live source is map-less (catalog card) — color carries the look.
      const fallbackTex = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      fallbackTex.needsUpdate = true;
      const mapNode = texture(fallbackTex);

      // ── SDF metaball field (§11 cookbook): opSmoothUnion over circle SDFs ─
      // TSL intermediate-node type (the splat-reveal / liquefy-reveal gotcha):
      // narrow fluent return types fail when reassigning the accumulator.
      type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const smin = (a: TNode, b: TNode, k: TNode): TNode => {
        const h: TNode = tslClamp(float(0.5).add(b.sub(a).mul(0.5).div(k)), float(0), float(1));
        return mix(b, a, h).sub(k.mul(h).mul(h.oneMinus()));
      };

      const u = uv();
      let d: TNode = float(FAR);
      BALLS.forEach((spec, i) => {
        const ball: TNode = length(u.sub(vec2(uBX[i], uBY[i]))).sub(
          uRadius.mul(float(spec.size)),
        );
        // Inactive balls sit at FAR so the smooth union ignores them — the
        // Balls knob restructures the field live, no node-graph rebuild.
        const gated: TNode = mix(float(FAR), ball, uActive[i]);
        d = smin(d, gated, uBlend);
      });
      // Closing seal: a CPU-ramped bias that sweeps the liquid front past the
      // rect bounds so phase 1 covers the FULL card (alpha from the field).
      const sealed: TNode = d.sub(uSeal);
      const alpha = smoothstep(float(0.035), float(0), sealed);
      // Warm brass rim riding the liquid front (|field| band). Fades out as
      // the seal pushes the front beyond the rect — the settled card is clean.
      const rim = smoothstep(float(0.085), float(0), abs(sealed));

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = (mapNode as TNode).rgb.mul(
        vec3(uCR, uCG, uCB),
      );
      (mat as unknown as { opacityNode: unknown }).opacityNode = alpha;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = vec3(uER, uEG, uEB).add(
        vec3(0.83, 0.63, 0.36).mul(rim).mul(uGlow),
      );

      // ── Live source tracking (late texture pour / material swap) ─────────
      let srcRaw: Material | Material[] | null = repMesh ? repMesh.material : null;
      let srcMat: MappedMaterial | null = firstMat(srcRaw);
      let boundMap: Texture | null = null; // null = fallback bound

      const syncSource = () => {
        if (!repMesh) return;
        const liveRaw = repMesh.material;
        if (liveRaw !== mat) {
          // The host poured/swapped a fresh material after we attached —
          // adopt it as the new appearance source and take the slot back.
          srcRaw = liveRaw;
          srcMat = firstMat(liveRaw);
          repMesh.material = mat;
        }
        const liveMap = (srcMat?.map as Texture | null | undefined) ?? null;
        if (liveMap !== boundMap) {
          (mapNode as unknown as { value: Texture }).value = liveMap ?? fallbackTex;
          boundMap = liveMap;
        }
        if (srcMat) {
          if (srcMat.color instanceof Color) {
            uCR.value = srcMat.color.r;
            uCG.value = srcMat.color.g;
            uCB.value = srcMat.color.b;
          }
          if (srcMat.emissive instanceof Color) {
            const ei = srcMat.emissiveIntensity ?? 1;
            uER.value = srcMat.emissive.r * ei;
            uEG.value = srcMat.emissive.g * ei;
            uEB.value = srcMat.emissive.b * ei;
          }
          if (typeof srcMat.roughness === 'number') mat.roughness = srcMat.roughness;
          if (typeof srcMat.metalness === 'number') mat.metalness = srcMat.metalness;
        }
      };

      if (repMesh) repMesh.material = mat;
      syncSource();

      // ── Chrome co-fade: the card's child meshes arrive with the liquid ───
      // Snapshot opacity AND .transparent so dispose() hands everything back
      // exactly as found (the scroll-stagger-rise snapshot/restore pattern).
      interface ChromeSnap {
        mat: Material & { opacity: number };
        opacity: number;
        transparent: boolean;
      }
      const chromeSnaps: ChromeSnap[] = [];
      if (repMesh && subject) {
        subject.traverse((o) => {
          const m = o as Mesh;
          if (!m.isMesh || m === repMesh || !m.material) return;
          const list = Array.isArray(m.material) ? m.material : [m.material];
          for (const cm of list) {
            chromeSnaps.push({
              mat: cm as Material & { opacity: number },
              opacity: (cm as Material & { opacity: number }).opacity,
              transparent: cm.transparent,
            });
          }
        });
      }

      // Expose live handles on shared scratch (contract: userData is the
      // sanctioned host/primitive space) so the host — and the CPU-observable
      // tests — can read the animated state without a renderer.
      target.userData.metaballMerge = {
        uSeal,
        uRadius,
        uBlend,
        uGlow,
        uActive,
        ballX: uBX,
        ballY: uBY,
        mapNode,
        uColor: { r: uCR, g: uCG, b: uCB },
      };

      const duration = () => num(params.duration, 1.8);

      return {
        duration,
        seek: (t) => {
          const dur = duration();
          const p = dur <= 0 ? 1 : clamp(t / dur, 0, 1);
          const n = activeCount(params.balls);
          const speed = clamp(num(params.speed, 1), 0.2, 3);

          // Read params live so control changes apply without a rebuild.
          uBlend.value = clamp(num(params.blend, 0.28), 0.05, 0.6);
          uGlow.value = clamp(num(params.glow, 0.85), 0, 2);
          for (let i = 0; i < MAX_BALLS; i++) uActive[i].value = i < n ? 1 : 0;

          // Travel finishes around 72% of the timeline; growth by 85%; the
          // closing seal sweeps across the back half. Fewer balls compensate
          // with larger radii AND a deeper seal so phase 1 always covers.
          const travel = ease('easeInOut', clamp(p / 0.72, 0, 1));
          const grow = ease('easeOut', clamp(p / 0.85, 0, 1));
          uRadius.value = R_BASE * (0.3 + 0.7 * grow) * (1 + (5 - n) * 0.05);
          const sealT = clamp((p - 0.45) / 0.55, 0, 1);
          uSeal.value = (0.5 + (5 - n) * 0.07) * sealT * sealT;

          // Deterministic swim: lerp start→end plus a perpendicular sine
          // wobble (keyed by index hash) that damps to zero as each ball
          // arrives — droplets settle exactly on their landing points.
          for (let i = 0; i < MAX_BALLS; i++) {
            const spec = BALLS[i];
            const wob = Math.sin(p * speed * TAU * spec.freq + spec.phase) * 0.085 * (1 - travel);
            uBX[i].value = spec.start[0] + (spec.end[0] - spec.start[0]) * travel + spec.perp[0] * wob;
            uBY[i].value = spec.start[1] + (spec.end[1] - spec.start[1]) * travel + spec.perp[1] * wob;
          }

          // Chrome arrives once the liquid is pooling over the card body.
          const chromeT = ease('easeInOut', clamp((p - 0.3) / 0.55, 0, 1));
          for (const s of chromeSnaps) {
            if (!s.mat.transparent) s.mat.transparent = true;
            s.mat.opacity = chromeT * s.opacity;
          }

          // Late texture pour / material swap — rebind from the live source.
          syncSource();
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'blend') uBlend.value = clamp(num(value, 0.28), 0.05, 0.6);
          else if (id === 'glow') uGlow.value = clamp(num(value, 0.85), 0, 2);
          else if (id === 'balls') {
            const n = activeCount(value);
            for (let i = 0; i < MAX_BALLS; i++) uActive[i].value = i < n ? 1 : 0;
          }
          // 'speed' and 'duration' are read live in seek().
        },
        dispose: () => {
          // Hand the slot back ONLY if we still own it (a swap the host made
          // after our last seek must not be clobbered).
          if (repMesh && srcRaw && repMesh.material === mat) repMesh.material = srcRaw;
          for (const s of chromeSnaps) {
            s.mat.opacity = s.opacity;
            s.mat.transparent = s.transparent;
          }
          delete target.userData.metaballMerge;
          mat.dispose();
          fallbackTex.dispose(); // owned fallback only — never the source's map
        },
      };
    },
  ),
};
