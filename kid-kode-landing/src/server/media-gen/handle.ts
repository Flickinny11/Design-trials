import 'server-only';

// CANVAS-FINAL — Prism Media Generator: the shared request handler.
//
// One place for: model resolution (catalog) → BUILD-BUDGET guard → fal-reachable
// input resolution → provider lane call → persist outputs through the content-
// hash asset store → credit metering → honest payload. Both the legacy
// /api/prism/image-gen route and the unified /api/prism/media-gen route call
// this, so there is exactly one generation code path.
//
// The client payload carries Prism-branded model id + label + credits + the
// per-generation cost — NEVER the upstream endpoint ("fal" is never surfaced).

import { getModel, modelForKind } from './catalog';
import { getProvider } from './index';
import {
  BudgetExceededError,
  guardBudget,
  recordGeneration,
  getCreditMeter,
  type CreditMeter,
} from './credits';
import { storeRemoteAsset, toFalReachableUrl } from '@/server/assets/store';
import type { ArtifactComposeSpec, GenQuality } from './types';
import type { PrismModel, PrismModelPublic } from './catalog';

export type GenerateKind = 'image' | 'edit' | '3d' | 'video' | 'code';

export interface GenerateRequest {
  kind: GenerateKind;
  prompt?: string;
  quality?: GenQuality;
  count?: number;
  width?: number;
  height?: number;
  /** Single input image (edit / video / single-image 3D). A local /prism-mock
   *  path or a remote URL — resolved to fal-reachable before the call. */
  imageUrl?: string;
  /** Up to 4 view images for 3D (front/back/left/right). */
  imageUrls?: string[];
  durationSeconds?: number;
  /** Plain-language purpose for the ledger (not surfaced to the user). */
  purpose?: string;
}

export interface GeneratedImagePublic {
  url: string;
  width?: number;
  height?: number;
}

export interface GenerateResult {
  ok: true;
  kind: GenerateKind;
  model: PrismModelPublic;
  images?: GeneratedImagePublic[];
  meshUrl?: string;
  previewUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
  compose?: ArtifactComposeSpec;
  summary?: string;
  /** Credits this generation cost (in-product meter unit). */
  credits: number;
  meter: CreditMeter;
}

export class GenerateError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'GenerateError';
  }
}

function resolveModel(req: GenerateRequest): PrismModel {
  switch (req.kind) {
    case 'image':
      return modelForKind('image', req.quality);
    case 'edit':
      return getModel('prism-edit')!;
    case '3d':
      return getModel('prism-3d')!;
    case 'video':
      return getModel('prism-video')!;
    case 'code':
      return getModel('prism-compose')!;
    default:
      throw new GenerateError('Unknown generation type.', 400);
  }
}

function publicOf(m: PrismModel): PrismModelPublic {
  return { id: m.id, label: m.label, blurb: m.blurb, kind: m.kind, quality: m.quality, credits: m.credits };
}

export async function handleGenerate(req: GenerateRequest): Promise<GenerateResult> {
  const model = resolveModel(req);

  // BUILD-BUDGET guard (real USD) — refuse before spending past the hard stop.
  try {
    await guardBudget(model.usdEstimate);
  } catch (e) {
    if (e instanceof BudgetExceededError) throw new GenerateError(e.message, 503);
    throw e;
  }

  const provider = getProvider();
  let result: GenerateResult;
  try {
    if (req.kind === 'image') {
      if (!req.prompt?.trim()) throw new GenerateError('Describe the picture you want.', 400);
      const out = await provider.generateImage({
        prompt: req.prompt.trim(),
        quality: req.quality,
        width: req.width,
        height: req.height,
        count: req.count,
      });
      const images = await persistImages(out.images);
      result = baseResult(req.kind, model, { images });
    } else if (req.kind === 'edit') {
      if (!req.prompt?.trim()) throw new GenerateError('Describe how to change it.', 400);
      if (!req.imageUrl) throw new GenerateError('Pick a picture to modify.', 400);
      const reachable = await toFalReachableUrl(req.imageUrl);
      const out = await provider.editImage({ prompt: req.prompt.trim(), imageUrl: reachable, count: req.count });
      const images = await persistImages(out.images);
      result = baseResult(req.kind, model, { images });
    } else if (req.kind === '3d') {
      const inputs = (req.imageUrls && req.imageUrls.length > 0)
        ? req.imageUrls
        : req.imageUrl ? [req.imageUrl] : [];
      if (inputs.length === 0) throw new GenerateError('Add a picture to turn into 3D.', 400);
      const reachable = await Promise.all(inputs.map((u) => toFalReachableUrl(u)));
      const out = await provider.imageTo3D({ imageUrls: reachable, prompt: req.prompt, quality: req.quality });
      const stored = await storeRemoteAsset(out.meshUrl, 'mesh');
      let previewUrl: string | undefined;
      if (out.previewUrl) {
        try { previewUrl = (await storeRemoteAsset(out.previewUrl, 'image')).url; } catch { /* preview optional */ }
      }
      result = baseResult(req.kind, model, { meshUrl: stored.url, previewUrl });
    } else if (req.kind === 'video') {
      if (!req.imageUrl) throw new GenerateError('Pick a starting picture for the clip.', 400);
      const reachable = await toFalReachableUrl(req.imageUrl);
      const out = await provider.generateVideo({ prompt: req.prompt, imageUrl: reachable, durationSeconds: req.durationSeconds });
      const stored = await storeRemoteAsset(out.videoUrl, 'video');
      result = baseResult(req.kind, model, { videoUrl: stored.url, posterUrl: req.imageUrl });
    } else {
      // code
      if (!req.prompt?.trim()) throw new GenerateError('Describe the element to compose.', 400);
      const out = await provider.generateCode({ prompt: req.prompt.trim() });
      result = baseResult(req.kind, model, { compose: out.spec, summary: out.summary });
    }
  } catch (e) {
    // Record the failed attempt (no charge), then surface honestly.
    await recordGeneration({
      at: new Date().toISOString(),
      prismModelId: model.id,
      credits: model.credits,
      usdEstimate: model.usdEstimate,
      ok: false,
      purpose: req.purpose ?? `${req.kind} generation (failed)`,
    });
    if (e instanceof GenerateError) throw e;
    const msg = e instanceof Error ? e.message : 'Generation failed.';
    throw new GenerateError(msg, 502);
  }

  // Record the successful generation in both ledgers.
  const meter = await recordGeneration({
    at: new Date().toISOString(),
    prismModelId: model.id,
    credits: model.credits,
    usdEstimate: model.usdEstimate,
    ok: true,
    purpose: req.purpose ?? `${req.kind} generation`,
  });
  result.meter = meter;
  return result;
}

async function persistImages(images: Array<{ url: string; width?: number; height?: number }>): Promise<GeneratedImagePublic[]> {
  const stored = await Promise.all(
    images.map(async (img): Promise<GeneratedImagePublic | null> => {
      try {
        const s = await storeRemoteAsset(img.url, 'image');
        return { url: s.url, width: s.width ?? img.width, height: s.height ?? img.height };
      } catch {
        return null;
      }
    }),
  );
  const ok = stored.filter((s): s is GeneratedImagePublic => s !== null);
  if (ok.length === 0) throw new GenerateError('The generated image could not be saved.', 502);
  return ok;
}

function baseResult(
  kind: GenerateKind,
  model: PrismModel,
  extra: Partial<GenerateResult>,
): GenerateResult {
  return {
    ok: true,
    kind,
    model: publicOf(model),
    credits: model.credits,
    meter: getCreditMeter(),
    ...extra,
  };
}
