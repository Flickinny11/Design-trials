import 'server-only';

// CANVAS-FINAL — Prism Media Generator: shared types + the provider contract.
//
// This is Prism's OWN in-house media generation surface (canvas-spec §12 +
// PRISM-ENGINE-SPEC-V3 provider/credential-vault model). The backing provider
// is pluggable: fal is the default, a user may later bring their own key for
// another platform (BYOK, see byok.ts). The PROVIDER NAME IS NEVER SURFACED to
// the user UI — the client only ever sees Prism-branded model ids (catalog.ts).
//
// Providers return RAW upstream results (e.g. fal-hosted URLs). The API routes
// persist those through the content-hash asset store (src/server/assets/store)
// so a generated artifact and an uploaded artifact share one URL space and
// round-trip identically. Raw secret values (FAL_KEY) never leave the server
// (INV-19 / runtime INV-R13).

import type {
  AnimationBinding,
  MaterialSpec,
  MeshPrimitive,
} from '@/lib/prism-graph/types';

export type MediaKind = 'image' | 'mesh' | 'video' | 'edit' | 'code';

/** Quality lane within a media kind (maps to a Prism model in catalog.ts). */
export type GenQuality = 'standard' | 'studio';

// ── Inputs ─────────────────────────────────────────────────────────────────

export interface GenImageInput {
  prompt: string;
  /** 'standard' (fast) | 'studio' (highest quality). Default 'standard'. */
  quality?: GenQuality;
  /** Square-ish default; the wizard may request a target box. */
  width?: number;
  height?: number;
  /** Optional style-lock / variation reference image URL. */
  imageUrl?: string;
  /** 1..4 (clamped). Default 1. */
  count?: number;
}

export interface GenEditInput {
  /** The image being modified (a persisted URL). */
  imageUrl: string;
  /** Natural-language modification ("make it brass", "add a glow"). */
  prompt: string;
  count?: number;
}

export interface Gen3DInput {
  /** 1..4 view images (front/back/left/right). Single-image is the default and
   *  preferred path (modern single-shot beats multi-view stitching). */
  imageUrls: string[];
  /** Optional text guidance. */
  prompt?: string;
  quality?: GenQuality;
}

export interface GenVideoInput {
  prompt?: string;
  /** First-frame / drive image (image→video). */
  imageUrl?: string;
  /** Requested clip length in seconds (clamped by the model). */
  durationSeconds?: number;
}

export interface GenCodeInput {
  /** Natural-language description of a procedural element. */
  prompt: string;
}

// ── Outputs (raw upstream — routes persist before returning to the client) ──

export interface RawImage {
  url: string;
  width?: number;
  height?: number;
}
export interface GenImageOutput {
  images: RawImage[];
}
export interface Gen3DOutput {
  meshUrl: string;
  format: 'glb';
  /** Optional rendered preview image from the upstream model. */
  previewUrl?: string;
}
export interface GenVideoOutput {
  videoUrl: string;
  /** Optional poster / first frame. */
  posterUrl?: string;
}

/** The constrained, validated procedural-artifact spec the Code lane emits.
 *  "Code is scene composition" (engine invariant 8): a primitive shape +
 *  material + optional catalog animation — applied onto the EXISTING schema,
 *  NOT the out-of-scope full app-builder. Behavior wiring stays node-editor. */
export interface ArtifactComposeSpec {
  meshPrimitive: MeshPrimitive;
  materialSpec?: MaterialSpec;
  animationBindings?: AnimationBinding[];
}
export interface GenCodeOutput {
  spec: ArtifactComposeSpec;
  /** A short plain-language summary of what was composed (for the result card). */
  summary: string;
}

// ── Provider contract ────────────────────────────────────────────────────────

export interface MediaProvider {
  /** Stable internal id ('fal', 'byok:<platform>'). Never surfaced to the UI. */
  readonly providerId: string;
  generateImage(input: GenImageInput): Promise<GenImageOutput>;
  editImage(input: GenEditInput): Promise<GenImageOutput>;
  imageTo3D(input: Gen3DInput): Promise<Gen3DOutput>;
  generateVideo(input: GenVideoInput): Promise<GenVideoOutput>;
  generateCode(input: GenCodeInput): Promise<GenCodeOutput>;
}

// ── Credit accounting ────────────────────────────────────────────────────────

export interface CreditLedgerEntry {
  at: string;
  /** Prism-branded model id (catalog.ts) — never the upstream endpoint. */
  prismModelId: string;
  /** Prism credits charged for this generation (the in-product meter unit). */
  credits: number;
  /** Real USD this generation cost the backing provider (build-budget truth). */
  usdEstimate: number;
  ok: boolean;
  requestId?: string;
  purpose?: string;
}
