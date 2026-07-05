import 'server-only';

// P3 ASSETS (C) — FLAGGED AI image generation hook.
//
// Mirror of src/server/text-fill/generate.ts in spirit: the Add Object
// pipeline's cloud-generation half, shipped as a FLAGGED HOOK. There is no
// FAL key in this environment, so `generateImages` returns
// `{ wired: false, images: [] }` today. The full request/response types are
// declared below so wiring the real endpoint later is a drop-in (replace the
// body of `generateImages`; no caller changes).
//
// INTENDED ENDPOINT (re-verify at wiring time):
//   - prompt → IMAGE generation (natural-language object description like
//     "a brass pocket watch on black" → a standalone image asset destined for
//     a node's `visual.sourceAsset`). The artifact field stays
//     `visual.sourceAsset` — upload, URL, and generation all end as a URL.
//   - fal.ai-hosted FLUX-family text-to-image endpoint (the harness side).
//     RE-VERIFY the best current prompt→image model id at wiring time
//     (FLUX.2-class vs whatever has superseded it) before hardcoding one —
//     same re-verify rule the text-fill hook carries.
//   - Production output must never bake letterforms into the image: the
//     negative prompt includes "no text, no letters, no labels"
//     (carried-forward rule; real text is MSDF, INV-R11).
//   - Wired responses persist each generated image through the SAME
//     content-hash asset store the upload route uses (POST /api/prism/assets
//     write path), so generated and uploaded assets share one
//     `/prism-mock/uploads/<hash>.<ext>` URL space and dimensions are probed
//     identically. Each `GeneratedImage.url` points at the persisted asset at
//     NATIVE resolution (sharpness directive: no downscaling).
//   - Auth via server-side FAL_KEY only (capability-reference resolution
//     stays server-only — INV-19; raw keys never reach the graph or the
//     client bundle).
//
// Server discipline matches src/server/text-fill/generate.ts: 'server-only'
// marker first, `@/` alias imports are fine under src/server/** (the
// relative-imports-only dep-guard scopes to src/lib/prism/**).

/** Default number of images a wired endpoint will return per prompt. */
export const IMAGE_GEN_DEFAULT_COUNT = 1;
/** Upper bound on per-request images (cost guard once wired). */
export const IMAGE_GEN_MAX_COUNT = 4;

/** Wire request the route hands to this hook (and, once wired, the shape the
 *  generation call is built from). */
export interface ImageGenerateRequest {
  /** Natural-language object description ("a brass pocket watch on black"). */
  prompt: string;
  /** How many images to generate; clamped to 1..IMAGE_GEN_MAX_COUNT,
   *  default IMAGE_GEN_DEFAULT_COUNT. */
  count?: number;
}

/** One generated image, persisted through the content-hash asset store. The
 *  shape intentionally matches the upload route's success payload (url +
 *  native dimensions) so a generated asset and an uploaded asset are
 *  interchangeable as a node's `visual.sourceAsset`. */
export interface GeneratedImage {
  url: string;
  width: number;
  height: number;
  /** Optional human label ("Brass pocket watch #1"). Plain language only —
   *  never a machine id. */
  label?: string;
}

/** Cloud endpoint not wired (today's permanent answer in this environment).
 *  `images` is always `[]` — the Add Object panel's real paths are upload
 *  and URL (src/components/editor/add-tools/upload-image.ts). */
export interface ImageGenerateUnwired {
  wired: false;
  images: GeneratedImage[];
}

/** Shape the hook returns once the FLUX-family endpoint is wired: one entry
 *  per persisted generated image. */
export interface ImageGenerateWired {
  wired: true;
  images: GeneratedImage[];
}

export type ImageGenerateResponse = ImageGenerateUnwired | ImageGenerateWired;

/** Clamp a requested count into the wired endpoint's legal range. Exported so
 *  the eventual wiring (and tests) share one rule. */
export function clampImageCount(count?: number): number {
  if (count === undefined || !Number.isFinite(count)) return IMAGE_GEN_DEFAULT_COUNT;
  return Math.min(IMAGE_GEN_MAX_COUNT, Math.max(1, Math.floor(count)));
}

/**
 * Generate AI image assets for `prompt`.
 *
 * FLAGGED HOOK: returns `{ wired: false, images: [] }` unconditionally today.
 * The signature, request normalization, and response union are final — wiring
 * the real endpoint later replaces only the body below (call the FLUX-family
 * text-to-image endpoint with the normalized prompt + clamped count, persist
 * each result through the content-hash asset store, return
 * `{ wired: true, images }`).
 */
export async function generateImages(
  prompt: string,
  count?: number,
): Promise<ImageGenerateResponse> {
  // Normalize exactly as the wired path will, so behavior is stable across
  // the wiring change. The values are intentionally unused today.
  const request: ImageGenerateRequest = {
    prompt: prompt.trim(),
    count: clampImageCount(count),
  };
  void request;

  return { wired: false as const, images: [] };
}
