import 'server-only';

// CANVAS-FINAL — Prism Media Generator: branded model catalog.
//
// The user UI sees ONLY these Prism-branded model ids + labels. The upstream
// endpoint (the `backing` field) is a SERVER-ONLY mapping and must never reach
// the client bundle or any user-facing string (guardrail: never surface
// "fal"). The API routes look a Prism model id up here, call the backing
// endpoint, and return the Prism id + credit cost — not the backing id.
//
// `credits` is the in-product meter unit (1 credit ≈ $0.01 of provider cost,
// rounded up to a clean number). `usdEstimate` is the real provider cost used
// by the build-budget guard (credits.ts) — kept honest, never faked.
//
// Model picks RE-VERIFIED June 2026 (canvas-spec §20): proven in-repo (June
// showcase generation scripts) + web-confirmed current. Update here when a
// better model ships — single source of truth for the whole generator.

import type { GenQuality, MediaKind } from './types';

export interface PrismModel {
  /** Prism-branded id surfaced to the client (e.g. 'prism-image-standard'). */
  id: string;
  /** Short user-facing label (e.g. 'Standard'). */
  label: string;
  /** Plain-language blurb for the picker (no machine ids, no "fal"). */
  blurb: string;
  kind: MediaKind;
  quality?: GenQuality;
  /** SERVER-ONLY upstream endpoint. NEVER serialized to the client. */
  backing: string;
  /** In-product meter cost (Prism credits per generation). */
  credits: number;
  /** Real provider USD per generation (build-budget truth; honest estimate). */
  usdEstimate: number;
}

// The canonical model set. `backing` is the fal endpoint id (server-only).
const MODELS: readonly PrismModel[] = Object.freeze([
  {
    id: 'prism-image-standard',
    label: 'Standard',
    blurb: 'Fast, high-quality image generation. Great for most elements.',
    kind: 'image',
    quality: 'standard',
    backing: 'fal-ai/flux-2',
    credits: 2,
    usdEstimate: 0.015,
  },
  {
    id: 'prism-image-studio',
    label: 'Studio',
    blurb: 'Studio-grade photorealism for hero imagery. Slower, richer.',
    kind: 'image',
    quality: 'studio',
    backing: 'fal-ai/flux-2-pro',
    credits: 8,
    usdEstimate: 0.075,
  },
  {
    id: 'prism-edit',
    label: 'Modify',
    blurb: 'Re-imagine an existing picture from a description.',
    kind: 'edit',
    backing: 'fal-ai/flux/dev/image-to-image',
    credits: 3,
    usdEstimate: 0.02,
  },
  {
    id: 'prism-3d',
    label: 'Prism 3D',
    blurb: 'Turn a picture into a real 3D model you can spin and light.',
    kind: 'mesh',
    backing: 'fal-ai/hunyuan3d-v3/image-to-3d',
    credits: 8,
    usdEstimate: 0.075,
  },
  {
    id: 'prism-video',
    label: 'Prism Motion',
    blurb: 'Bring a still to life as a short looping clip.',
    kind: 'video',
    backing: 'fal-ai/kling-video/v3/pro/image-to-video',
    credits: 60,
    usdEstimate: 0.6,
  },
  {
    id: 'prism-compose',
    label: 'Prism Compose',
    blurb: 'Describe a shape and finish; Prism composes a 3D element for you.',
    kind: 'code',
    backing: 'fal-ai/any-llm',
    credits: 1,
    usdEstimate: 0.005,
  },
]);

/** Fallback 3D endpoints tried in order when the primary is unavailable
 *  (proven in scripts/generate-prism-mock-mesh.mjs). Server-only. */
export const MESH_FALLBACK_BACKINGS: readonly string[] = Object.freeze([
  'fal-ai/hunyuan3d-v3/image-to-3d',
  'fal-ai/trellis',
  'fal-ai/hyper3d/rodin',
]);

export function getModel(id: string): PrismModel | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelForKind(kind: MediaKind, quality?: GenQuality): PrismModel {
  const matches = MODELS.filter((m) => m.kind === kind);
  if (quality) {
    const q = matches.find((m) => m.quality === quality);
    if (q) return q;
  }
  // Default: the first (standard) model of the kind.
  const first = matches[0];
  if (!first) throw new Error(`no Prism model for kind '${kind}'`);
  return first;
}

/** Client-safe projection of a model: the upstream `backing` is stripped. The
 *  picker renders from these — they carry no provider identity. */
export interface PrismModelPublic {
  id: string;
  label: string;
  blurb: string;
  kind: MediaKind;
  quality?: GenQuality;
  credits: number;
}

export function publicModel(m: PrismModel): PrismModelPublic {
  return {
    id: m.id,
    label: m.label,
    blurb: m.blurb,
    kind: m.kind,
    quality: m.quality,
    credits: m.credits,
  };
}

/** The full client-safe catalog (for the picker). */
export function publicCatalog(): PrismModelPublic[] {
  return MODELS.map(publicModel);
}
